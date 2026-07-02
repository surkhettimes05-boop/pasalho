import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { ConvertToInvoiceDto } from './dto/convert-to-invoice.dto';
import { InvoiceService } from '../sales/invoice.service';

@Injectable()
export class SalesOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async list(pagination: PaginationDto, branchId?: string, salesRepId?: string, status?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (salesRepId) where.salesRepId = salesRepId;
    if (status) where.status = status;
    if (pagination.search) {
      where.orderNo = { contains: pagination.search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          branch: { select: { id: true, name: true } },
          salesRep: { include: { user: { select: { id: true, fullName: true } } } },
          route: { select: { id: true, name: true, code: true } },
          retailer: { select: { id: true, shopName: true, ownerName: true, phone: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.salesOrder.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async findById(id: string) {
    const order = await this.prisma.salesOrder.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        salesRep: { include: { user: { select: { id: true, fullName: true } } } },
        route: { select: { id: true, name: true, code: true } },
        retailer: true,
        invoice: { select: { id: true, invoiceNumber: true, status: true, grandTotal: true } },
        createdBy: { select: { id: true, fullName: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, skuCode: true } },
            batch: { select: { id: true, batchNumber: true } },
            unit: { select: { id: true, name: true, symbol: true } },
          },
        },
      },
    });
    if (!order) throw new AppError(ErrorCodes.NOT_FOUND, 'Sales order not found.', 404);
    return order;
  }

  async create(dto: CreateSalesOrderDto, actorUserId: string) {
    const orderNo = `ORD-${Date.now()}`;

    let subtotal = 0;
    for (const item of dto.items) {
      subtotal += item.quantity * item.unitPrice;
    }

    const order = await this.prisma.$transaction(async (tx) => {
      const o = await tx.salesOrder.create({
        data: {
          orderNo,
          branchId: dto.branchId,
          salesRepId: dto.salesRepId,
          routeId: dto.routeId,
          retailerId: dto.retailerId,
          notes: dto.notes,
          subtotal,
          grandTotal: subtotal,
          createdById: actorUserId,
        },
      });

      for (const item of dto.items) {
        await tx.salesOrderItem.create({
          data: {
            salesOrderId: o.id,
            productId: item.productId,
            batchId: item.batchId,
            unitId: item.unitId,
            quantity: item.quantity,
            baseQuantity: item.baseQuantity,
            unitPrice: item.unitPrice,
            lineTotal: item.quantity * item.unitPrice,
            notes: item.notes,
          },
        });
      }

      return o;
    });

    await this.audit.record({
      actorUserId,
      action: 'SALES_ORDER_CREATED',
      entityType: 'SALES_ORDER',
      entityId: order.id,
      branchId: dto.branchId,
      afterData: { orderNo, grandTotal: subtotal },
    });

    return this.findById(order.id);
  }

  async confirm(id: string, actorUserId: string) {
    const order = await this.findById(id);
    if (order.status !== 'DRAFT') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Only DRAFT orders can be confirmed.', 422);
    }

    await this.prisma.salesOrder.update({
      where: { id },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
    });

    await this.audit.record({
      actorUserId,
      action: 'SALES_ORDER_CONFIRMED',
      entityType: 'SALES_ORDER',
      entityId: id,
      branchId: order.branchId,
      afterData: { status: 'CONFIRMED' },
    });

    return this.findById(id);
  }

  async cancel(id: string, actorUserId: string) {
    const order = await this.findById(id);
    if (!['DRAFT', 'CONFIRMED'].includes(order.status)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Order cannot be cancelled in its current state.', 422);
    }

    await this.prisma.salesOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await this.audit.record({
      actorUserId,
      action: 'SALES_ORDER_CANCELLED',
      entityType: 'SALES_ORDER',
      entityId: id,
      branchId: order.branchId,
      afterData: { status: 'CANCELLED' },
    });

    return this.findById(id);
  }

  async convertToInvoice(id: string, dto: ConvertToInvoiceDto, actorUserId: string) {
    const order = await this.findById(id);

    if (order.status !== 'CONFIRMED') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Only CONFIRMED orders can be converted to invoices.', 422);
    }

    if (order.invoiceId) {
      throw new AppError(ErrorCodes.CONFLICT, 'Order has already been converted to an invoice.', 409);
    }

    // Create invoice from order
    const invoice = await this.invoiceService.create(
      {
        branchId: order.branchId,
        retailerId: order.retailerId,
        warehouseId: dto.warehouseId,
        sourceLocationId: dto.sourceLocationId,
        items: order.items.map((item) => ({
          productId: item.productId,
          batchId: item.batchId ?? undefined,
          unitId: item.unitId,
          quantity: Number(item.quantity),
          baseQuantity: Number(item.baseQuantity),
          unitPrice: Number(item.unitPrice),
          discountAmount: 0,
          taxAmount: 0,
        })),
      },
      actorUserId,
    );

    // Link invoice to order
    await this.prisma.salesOrder.update({
      where: { id },
      data: { status: 'INVOICED', invoiceId: invoice.id },
    });

    await this.audit.record({
      actorUserId,
      action: 'SALES_ORDER_INVOICED',
      entityType: 'SALES_ORDER',
      entityId: id,
      branchId: order.branchId,
      afterData: { status: 'INVOICED', invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
    });

    return this.findById(id);
  }
}
