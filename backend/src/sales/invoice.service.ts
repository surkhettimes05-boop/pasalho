import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { InventoryLedgerService } from '../inventory/services/inventory-ledger.service';
import { RetailerLedgerService } from '../finance/retailer-ledger/retailer-ledger.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { VoidInvoiceDto } from './dto/void-invoice.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly inventoryLedger: InventoryLedgerService,
    private readonly retailerLedger: RetailerLedgerService,
  ) {}

  async list(pagination: PaginationDto, branchId?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (pagination.search) {
      where.invoiceNumber = { contains: pagination.search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: { retailer: true, warehouse: true, createdBy: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async findById(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        items: { include: { product: true, batch: true, unit: true } },
        retailer: true,
        warehouse: true,
        createdBy: { select: { id: true, fullName: true } },
        payments: true,
      },
    });
    if (!invoice) throw new AppError(ErrorCodes.NOT_FOUND, 'Invoice not found.', 404);
    return invoice;
  }

  async create(dto: CreateInvoiceDto, actorUserId: string) {
    const invoiceNumber = `INV-${Date.now()}`;

    // Calculate totals
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;

    for (const item of dto.items) {
      const lineTotal = item.quantity * item.unitPrice - (item.discountAmount ?? 0) + (item.taxAmount ?? 0);
      subtotal += item.quantity * item.unitPrice;
      discountTotal += item.discountAmount ?? 0;
      taxTotal += item.taxAmount ?? 0;
    }

    const grandTotal = subtotal - discountTotal + taxTotal;

    const invoice = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          branchId: dto.branchId,
          invoiceNumber,
          retailerId: dto.retailerId,
          warehouseId: dto.warehouseId,
          sourceLocationId: dto.sourceLocationId,
          subtotal,
          discountTotal,
          taxTotal,
          grandTotal,
          dueAmount: grandTotal,
          createdById: actorUserId,
        },
      });

      for (const item of dto.items) {
        const lineTotal = item.quantity * item.unitPrice - (item.discountAmount ?? 0) + (item.taxAmount ?? 0);
        await tx.invoiceItem.create({
          data: {
            invoiceId: inv.id,
            productId: item.productId,
            batchId: item.batchId,
            unitId: item.unitId,
            quantity: item.quantity,
            baseQuantity: item.baseQuantity,
            unitPrice: item.unitPrice,
            discountAmount: item.discountAmount ?? 0,
            taxAmount: item.taxAmount ?? 0,
            lineTotal,
          },
        });
      }

      return inv;
    });

    await this.audit.record({
      actorUserId,
      action: 'INVOICE_CREATED',
      entityType: 'INVOICE',
      entityId: invoice.id,
      branchId: dto.branchId,
      afterData: { invoiceNumber, grandTotal },
    });

    return this.findById(invoice.id);
  }

  async post(id: string, actorUserId: string) {
    const invoice = await this.findById(id);

    if (invoice.status !== 'DRAFT') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Only DRAFT invoices can be posted.', 422);
    }

    // Validate batches before any writes
    for (const item of invoice.items) {
      if (item.batchId) {
        const batch = await this.prisma.batch.findUnique({ where: { id: item.batchId } });
        if (!batch) throw new AppError(ErrorCodes.NOT_FOUND, `Batch ${item.batchId} not found.`, 404);
        if (batch.status === 'EXPIRED') throw new AppError(ErrorCodes.EXPIRED_BATCH, 'Batch is expired and cannot be sold.', 422);
        if (batch.status === 'BLOCKED') throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Batch is blocked and cannot be sold.', 422);
      }
    }

    // Post inventory deductions — one event, one movement per line item
    await this.inventoryLedger.postEvent({
      eventType: 'SALE_DEDUCTED',
      branchId: invoice.branchId,
      referenceType: 'INVOICE',
      referenceId: invoice.id,
      createdById: actorUserId,
      idempotencyKey: `invoice-post-${invoice.id}`,
      movements: invoice.items.map((item) => ({
        locationId: invoice.sourceLocationId,
        productId: item.productId,
        batchId: item.batchId ?? undefined,
        unitId: item.unitId,
        stockState: 'AVAILABLE' as const,
        quantityDelta: -Number(item.quantity),
        baseQuantityDelta: -Number(item.baseQuantity),
        movementType: 'SALE_DEDUCTION' as const,
        reasonCode: 'INVOICE_SALE',
      })),
    });

    await this.prisma.$transaction(async (tx) => {
      // Mark invoice posted
      await tx.invoice.update({
        where: { id },
        data: {
          status: invoice.retailerId ? 'CREDIT_OPEN' : 'POSTED',
          paymentStatus: 'UNPAID',
          postedById: actorUserId,
          postedAt: new Date(),
        },
      });

      // Create retailer debit if credit sale
      if (invoice.retailerId) {
        await this.retailerLedger.createInvoiceDebit(tx, {
          branchId: invoice.branchId,
          retailerId: invoice.retailerId,
          invoiceId: invoice.id,
          amount: Number(invoice.grandTotal),
          createdById: actorUserId,
        });

        // Also create financial ledger entries
        await tx.financialLedgerEntry.create({
          data: {
            branchId: invoice.branchId,
            entryType: 'RECEIVABLE_DEBIT',
            referenceType: 'INVOICE',
            referenceId: invoice.id,
            debitAmount: Number(invoice.grandTotal),
            creditAmount: 0,
            createdById: actorUserId,
          },
        });

        await tx.financialLedgerEntry.create({
          data: {
            branchId: invoice.branchId,
            entryType: 'SALES_CREDIT',
            referenceType: 'INVOICE',
            referenceId: invoice.id,
            debitAmount: 0,
            creditAmount: Number(invoice.grandTotal),
            createdById: actorUserId,
          },
        });
      } else {
        // Cash sale
        await tx.invoice.update({ where: { id }, data: { status: 'POSTED' } });
      }
    });

    await this.audit.record({
      actorUserId,
      action: 'INVOICE_POSTED',
      entityType: 'INVOICE',
      entityId: id,
      branchId: invoice.branchId,
      afterData: { invoiceNumber: invoice.invoiceNumber, grandTotal: Number(invoice.grandTotal) },
    });

    return this.findById(id);
  }

  async void(id: string, dto: VoidInvoiceDto, actorUserId: string) {
    const invoice = await this.findById(id);

    if (!['POSTED', 'CREDIT_OPEN', 'PARTIALLY_PAID'].includes(invoice.status)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Invoice cannot be voided in its current state.', 422);
    }

    // Create reversal inventory event
    await this.inventoryLedger.postEvent({
      eventType: 'REVERSAL_EVENT',
      branchId: invoice.branchId,
      referenceType: 'INVOICE',
      referenceId: invoice.id,
      createdById: actorUserId,
      idempotencyKey: `invoice-void-${invoice.id}`,
      movements: invoice.items.map((item) => ({
        locationId: invoice.sourceLocationId,
        productId: item.productId,
        batchId: item.batchId ?? undefined,
        unitId: item.unitId,
        stockState: 'AVAILABLE' as const,
        quantityDelta: Number(item.quantity),      // reverse: positive
        baseQuantityDelta: Number(item.baseQuantity),
        movementType: 'REVERSAL' as const,
        reasonCode: 'INVOICE_VOID',
      })),
    });

    await this.prisma.invoice.update({
      where: { id },
      data: { status: 'VOIDED', voidedById: actorUserId, voidedAt: new Date(), voidReason: dto.reason },
    });

    await this.audit.record({
      actorUserId,
      action: 'INVOICE_VOIDED',
      entityType: 'INVOICE',
      entityId: id,
      branchId: invoice.branchId,
      reason: dto.reason,
      beforeData: { status: invoice.status },
      afterData: { status: 'VOIDED' },
    });

    return this.findById(id);
  }

  async cancel(id: string, actorUserId: string) {
    const invoice = await this.findById(id);
    if (invoice.status !== 'DRAFT') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Only DRAFT invoices can be cancelled.', 422);
    }

    await this.prisma.invoice.update({ where: { id }, data: { status: 'CANCELLED' } });

    await this.audit.record({
      actorUserId,
      action: 'INVOICE_CANCELLED',
      entityType: 'INVOICE',
      entityId: id,
      branchId: invoice.branchId,
    });

    return this.findById(id);
  }
}
