import { Injectable } from '@nestjs/common';
import { Prisma, ReferenceType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { ConvertToInvoiceDto } from './dto/convert-to-invoice.dto';
import { PublicCheckoutDto } from './dto/public-checkout.dto';
import { InvoiceService } from '../sales/invoice.service';
import { StockReservationService } from '../inventory/services/stock-reservation.service';

@Injectable()
export class SalesOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly invoiceService: InvoiceService,
    private readonly stockReservation: StockReservationService,
  ) {}

  async list(pagination: PaginationDto, branchId?: string, salesRepId?: string, status?: string, source?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (salesRepId) where.salesRepId = salesRepId;
    if (status) where.status = status;
    if (source) where.source = source;
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

  async create(dto: CreateSalesOrderDto, actorUserId: string, idempotencyKey?: string) {
    const orderNo = `ORD-${Date.now()}`;

    let result: { order: any; created: boolean };
    try {
      result = await this.prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.salesOrder.findUnique({ where: { idempotencyKey } });
        if (existing) return { order: existing, created: false };
      }

      const [branch, rep, retailer, route, location] = await Promise.all([
        tx.branch.findUnique({ where: { id: dto.branchId } }),
        tx.salesRep.findUnique({ where: { id: dto.salesRepId }, include: { user: true } }),
        tx.retailer.findUnique({ where: { id: dto.retailerId } }),
        dto.routeId ? tx.route.findUnique({ where: { id: dto.routeId } }) : null,
        tx.inventoryLocation.findFirst({ where: { branchId: dto.branchId, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } }),
      ]);
      if (!branch || !retailer || retailer.branchId !== dto.branchId || retailer.status !== 'ACTIVE') {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Branch or retailer is invalid or inactive.', 422);
      }
      if (!rep || rep.branchId !== dto.branchId || rep.status !== 'ACTIVE' || rep.userId !== actorUserId) {
        throw new AppError(ErrorCodes.FORBIDDEN, 'The requesting sales representative is not authorized for this branch.', 403);
      }
      if (!route || route.branchId !== dto.branchId || route.salesRepId !== dto.salesRepId || route.status !== 'ACTIVE') {
        throw new AppError(ErrorCodes.FORBIDDEN, 'The sales representative is not authorized for this route.', 403);
      }
      const stop = await tx.routeStop.findUnique({ where: { routeId_retailerId: { routeId: route.id, retailerId: dto.retailerId } } });
      if (!stop) throw new AppError(ErrorCodes.FORBIDDEN, 'The retailer is not assigned to this route.', 403);
      if (!location) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'No active inventory location exists for this branch.', 422);

      const validatedItems: Array<any> = [];
      let subtotal = 0;
      for (const item of dto.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId }, include: { productUnits: true } });
        if (!product || !product.isActive) throw new AppError(ErrorCodes.VALIDATION_ERROR, `Product ${item.productId} is missing or inactive.`, 422);
        if (!product.productUnits.some((unit) => unit.unitId === item.unitId)) throw new AppError(ErrorCodes.VALIDATION_ERROR, `Unit is not valid for product ${product.name}.`, 422);
        if (item.batchId) {
          const batch = await tx.batch.findUnique({ where: { id: item.batchId } });
          if (!batch || batch.productId !== product.id || batch.status !== 'ACTIVE') throw new AppError(ErrorCodes.VALIDATION_ERROR, `Batch is invalid for product ${product.name}.`, 422);
        }
        const conversionToBase = Number(product.productUnits.find((unit) => unit.unitId === item.unitId)!.conversionToBase);
        const baseQuantity = item.quantity * conversionToBase;
        const unitPrice = Number(product.sellingPrice ?? 0);
        const lineTotal = item.quantity * unitPrice;
        subtotal += lineTotal;
        validatedItems.push({ productId: product.id, batchId: item.batchId, unitId: item.unitId, quantity: item.quantity, baseQuantity, unitPrice, discountAmount: 0, taxAmount: 0, lineTotal, notes: item.notes });
      }
      const lockedRetailer = await tx.$queryRaw<Array<{ creditLimit: Prisma.Decimal }>>`SELECT "creditLimit" FROM "Retailer" WHERE id = ${dto.retailerId} FOR UPDATE`;
      const ledger = await tx.retailerLedgerEntry.findMany({ where: { retailerId: dto.retailerId }, select: { debitAmount: true, creditAmount: true } });
      const outstanding = ledger.reduce((total, entry) => total + Number(entry.debitAmount) - Number(entry.creditAmount), 0);
      if (outstanding + subtotal > Number(lockedRetailer[0].creditLimit)) throw new AppError(ErrorCodes.VALIDATION_ERROR, `Order exceeds available credit. Remaining: ${Number(lockedRetailer[0].creditLimit) - outstanding}.`, 422);

      const o = await tx.salesOrder.create({
        data: {
          orderNo,
          idempotencyKey,
          branchId: dto.branchId,
          salesRepId: dto.salesRepId,
          routeId: dto.routeId,
          retailerId: dto.retailerId,
          notes: dto.notes,
          subtotal,
          discountTotal: 0,
          taxTotal: 0,
          grandTotal: subtotal,
          createdById: actorUserId,
        },
      });

      for (const item of validatedItems) {
        await tx.salesOrderItem.create({
          data: {
            salesOrderId: o.id,
            ...item,
          },
        });
        await this.stockReservation.reserveStock({ branchId: dto.branchId, locationId: location.id, productId: item.productId, batchId: item.batchId, unitId: item.unitId, quantity: item.quantity, baseQuantity: item.baseQuantity, referenceType: ReferenceType.SALES_ORDER, referenceId: o.id, createdById: actorUserId, reason: 'Sales order reservation' }, tx, false);
      }

      return { order: o, created: true };
      });
    } catch (error) {
      if (idempotencyKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.salesOrder.findUnique({ where: { idempotencyKey } });
        if (existing) return this.findById(existing.id);
      }
      throw error;
    }

    if (result.created) {
      await this.audit.record({
        actorUserId,
        action: 'SALES_ORDER_CREATED',
        entityType: 'SALES_ORDER',
        entityId: result.order.id,
        branchId: dto.branchId ?? undefined,
        afterData: { orderNo, grandTotal: result.order.grandTotal },
      });
    }

    return this.findById(result.order.id);
  }

  async createPublicOrder(dto: PublicCheckoutDto) {
    const SYSTEM_USER_ID = '99999999-9999-4999-a999-999999999999';
    const orderNo = `ORD-${Date.now()}`;
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);

    const customerInfoStr = JSON.stringify({
      name: `${dto.firstName} ${dto.lastName}`,
      phone: dto.phone,
      address: dto.address,
    });

    // 1. Validate Products & Recalculate Subtotal & Check Stock
    let subtotal = 0;
    const validatedItems = [];

    for (const item of dto.items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId, isActive: true },
        include: { defaultUnit: true }
      });

      if (!product) {
        throw new AppError(ErrorCodes.NOT_FOUND, `Product not found or inactive: ${item.productId}`, 404);
      }

      if (product.stock < item.quantity) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, `Insufficient stock for ${product.name}. Available: ${product.stock}`, 422);
      }

      const unitPrice = Number(product.sellingPrice || product.mrp || 0);
      subtotal += item.quantity * unitPrice;

      validatedItems.push({
        productId: product.id,
        unitId: product.defaultUnitId,
        quantity: item.quantity,
        baseQuantity: item.quantity, // Simplified for storefront
        unitPrice: unitPrice,
        lineTotal: item.quantity * unitPrice,
      });
    }

    // 2. Idempotency Check: Exact same phone AND exact same total within last 5 mins
    const duplicate = await this.prisma.salesOrder.findFirst({
      where: {
        source: 'STOREFRONT',
        createdAt: { gte: fiveMinsAgo },
        notes: { contains: `"phone":"${dto.phone}"` },
        grandTotal: subtotal
      }
    });

    if (duplicate) {
      throw new AppError(ErrorCodes.CONFLICT, 'An identical order was already placed recently. Please wait a few minutes or check your order history.', 409);
    }

    // 3. Save Order inside a transaction
    const order = await this.prisma.$transaction(async (tx) => {
      const o = await tx.salesOrder.create({
        data: {
          orderNo,
          source: 'STOREFRONT',
          status: 'PLACED',
          notes: customerInfoStr,
          subtotal,
          grandTotal: subtotal,
          createdById: SYSTEM_USER_ID,
        },
      });

      for (const item of validatedItems) {
        await tx.salesOrderItem.create({
          data: {
            salesOrderId: o.id,
            productId: item.productId,
            unitId: item.unitId,
            quantity: item.quantity,
            baseQuantity: item.baseQuantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          },
        });
      }

      return o;
    });

    await this.audit.record({
      actorUserId: SYSTEM_USER_ID,
      action: 'SALES_ORDER_CREATED',
      entityType: 'SALES_ORDER',
      entityId: order.id,
      afterData: { orderNo, grandTotal: subtotal, source: 'STOREFRONT' },
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
      branchId: order.branchId ?? undefined,
      afterData: { status: 'CONFIRMED' },
    });

    return this.findById(id);
  }

  async updateStatus(id: string, status: 'PACKED' | 'DELIVERED', actorUserId: string) {
    const order = await this.findById(id);
    if (order.source !== 'STOREFRONT') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Only STOREFRONT orders can be progressed via this endpoint.', 422);
    }

    const validTransitions = {
      'PLACED': ['PACKED', 'CANCELLED'],
      'PACKED': ['DELIVERED', 'CANCELLED'],
    };

    const allowed = validTransitions[order.status] || [];
    if (!allowed.includes(status)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, `Cannot transition order from ${order.status} to ${status}.`, 422);
    }

    await this.prisma.salesOrder.update({
      where: { id },
      data: { status },
    });

    await this.audit.record({
      actorUserId,
      action: 'SALES_ORDER_CONFIRMED', // Using existing audit action for simplicity
      entityType: 'SALES_ORDER',
      entityId: id,
      branchId: order.branchId ?? undefined,
      afterData: { status },
    });

    return this.findById(id);
  }

  async cancel(id: string, actorUserId: string) {
    const order = await this.findById(id);
    if (!['DRAFT', 'CONFIRMED', 'PLACED', 'PACKED'].includes(order.status)) {
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
      branchId: order.branchId ?? undefined,
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

    if (!order.branchId || !order.retailerId) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Cannot convert a non-DNP order (missing branch or retailer) to an invoice.', 422);
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
      branchId: order.branchId ?? undefined,
      afterData: { status: 'INVOICED', invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
    });

    return this.findById(id);
  }
}
