import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { RetailerNotificationService } from './retailer-notification.service';
import { InvoiceService } from '../sales/invoice.service';
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
  ) {}

  async placeOrder(retailerId: string, items: CreateOrderItemDto[], notes?: string) {
    const retailer = await this.prisma.retailer.findUnique({ where: { id: retailerId } });
    if (!retailer) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Retailer not found.', 404);
    }

    const orderNo = `RET-ORDER-${Date.now()}`;

    const order = await this.prisma.$transaction(async (tx) => {
      const o = await tx.salesOrder.create({
        data: {
          orderNo,
          branchId: retailer.branchId,
          retailerId: retailer.id,
          salesRepId: undefined,
          createdById: undefined,
          notes: notes || null,
          subtotal: 0,
          grandTotal: 0,
          status: 'DRAFT',
        },
      });

      let subtotal = 0;
      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) {
          throw new AppError(ErrorCodes.NOT_FOUND, `Product ${item.productId} not found.`, 404);
        }

        const unitPrice = Number(product.mrp || 0);

        await tx.salesOrderItem.create({
          data: {
            salesOrderId: o.id,
            productId: item.productId,
            batchId: item.batchId || null,
            unitId: item.unitId,
            quantity: item.quantity,
            baseQuantity: item.quantity,
            unitPrice,
            lineTotal: item.quantity * unitPrice,
            notes: null,
          },
        });

        subtotal += item.quantity * unitPrice;
      }

      await tx.salesOrder.update({
        where: { id: o.id },
        data: { subtotal, grandTotal: subtotal },
      });

      await tx.salesOrder.update({
        where: { id: o.id },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
      });

      return tx.salesOrder.findUnique({
        where: { id: o.id },
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
    });

    await this.notificationService.create({
      retailerId,
      branchId: retailer.branchId,
      type: 'ORDER_CONFIRMED',
      title: 'Order Confirmed',
      message: `Your order ${orderNo} has been placed successfully.`,
      entityType: 'SALES_ORDER' as ReferenceType,
      entityId: order.id,
    });

    await this.audit.record({
      actorUserId: retailerId,
      action: 'RETAILER_ORDER_PLACED',
      entityType: 'SALES_ORDER',
      entityId: order.id,
      branchId: retailer.branchId,
      afterData: { orderNo, grandTotal: Number(order.grandTotal) },
    });

    return order;
  }

  async listOrders(retailerId: string, pagination: PaginationDto) {
    const where = { retailerId };
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

    if (!['DRAFT', 'CONFIRMED'].includes(order.status)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Order cannot be cancelled in its current state.', 422);
    }

    await this.prisma.salesOrder.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    });

    await this.audit.record({
      actorUserId: retailerId,
      action: 'RETAILER_ORDER_CANCELLED',
      entityType: 'SALES_ORDER',
      entityId: orderId,
      branchId: order.branchId,
      afterData: { status: 'CANCELLED' },
    });

    return this.getOrder(retailerId, orderId);
  }
}
