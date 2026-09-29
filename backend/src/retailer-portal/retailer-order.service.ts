import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { RetailerNotificationService } from './retailer-notification.service';
import { InvoiceService } from '../sales/invoice.service';
import { SalesOrderService } from '../sales-orders/sales-order.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';
import { CreateOrderItemDto } from './dto/create-retailer-order.dto';
import { SalesOrderStatus, ReferenceType } from '@prisma/client';

@Injectable()
export class RetailerOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly notificationService: RetailerNotificationService,
    private readonly invoiceService: InvoiceService,
    private readonly salesOrderService: SalesOrderService,
  ) {}

  async placeOrder(retailerId: string, items: CreateOrderItemDto[], notes?: string, idempotencyKey?: string) {
    const retailer = await this.prisma.retailer.findUnique({ where: { id: retailerId } });
    if (!retailer) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Retailer not found.', 404);
    }

    if (!idempotencyKey) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Idempotency-Key is required.', 422);
    }
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { status: 'ACTIVE' },
      include: { inventoryLocation: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!warehouse?.inventoryLocation || warehouse.inventoryLocation.status !== 'ACTIVE') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Central Warehouse is not configured with an active inventory location.', 500);
    }
    const systemUserId = '99999999-9999-4999-a999-999999999999';
    const order = await this.salesOrderService.createOnline(
      {
        branchId: warehouse.branchId,
        salesRepId: systemUserId,
        retailerId: retailer.id,
        channel: 'DNP',
        idempotencyKey,
        notes,
        items: items.map((item) => ({
          productId: item.productId,
          unitId: item.unitId,
          batchId: item.batchId,
          quantity: item.quantity,
        })),
      } as any,
      systemUserId,
      idempotencyKey,
      { branchId: warehouse.branchId, retailerId: retailer.id, locationId: warehouse.inventoryLocation.id },
    );

    await this.notificationService.create({
      retailerId,
      branchId: retailer.branchId,
      type: 'ORDER_CONFIRMED',
      title: 'Order Confirmed',
      message: `Your order ${order.orderNo} has been placed successfully.`,
      entityType: 'SALES_ORDER' as ReferenceType,
      entityId: order.id,
    });

    await this.audit.record({
      actorUserId: systemUserId,
      action: 'RETAILER_ORDER_PLACED',
      entityType: 'SALES_ORDER',
      entityId: order.id,
      branchId: retailer.branchId,
      afterData: { orderNo: order.orderNo, grandTotal: Number(order.grandTotal) },
    });

    return order;
  }

  async listOrders(retailerId: string, pagination: PaginationDto) {
    const where: any = { retailerId };
    if (pagination.search) {
      where['orderNo'] = { contains: pagination.search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, skuCode: true } },
              batch: { select: { id: true, batchNumber: true } },
              unit: { select: { id: true, name: true, symbol: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.salesOrder.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async getOrder(retailerId: string, orderId: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: orderId, retailerId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, skuCode: true } },
            batch: { select: { id: true, batchNumber: true } },
            unit: { select: { id: true, name: true, symbol: true } },
          },
        },
      },
    });

    if (!order) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Order not found.', 404);
    }

    return order;
  }

  async cancelOrder(retailerId: string, orderId: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: orderId, retailerId },
    });

    if (!order) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Order not found.', 404);
    }

    if (order.status === 'CANCELLED') {
      return this.getOrder(retailerId, orderId);
    }
    if (!['DRAFT', 'CONFIRMED'].includes(order.status)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Order cannot be cancelled in its current state.', 422);
    }

    const systemUserId = '99999999-9999-4999-a999-999999999999';
    await this.salesOrderService.cancel(orderId, systemUserId);

    await this.audit.record({
      actorUserId: systemUserId,
      action: 'RETAILER_ORDER_CANCELLED',
      entityType: 'SALES_ORDER',
      entityId: orderId,
      branchId: order.branchId,
      afterData: { status: 'CANCELLED' },
    });

    return this.getOrder(retailerId, orderId);
  }
}
