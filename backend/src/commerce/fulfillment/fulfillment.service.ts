import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  FulfillmentShortageAction,
  Prisma,
  SalesOrderStatus,
} from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { StockReservationService } from '../../inventory/services/stock-reservation.service';
import { StorefrontReservationService } from '../checkout/storefront-reservation.service';
import { OrderStateMachineService } from '../orders/order-state-machine.service';
import { PickStorefrontItemDto } from './dto/pick-item.dto';
import { ReportStorefrontShortageDto } from './dto/report-shortage.dto';

export function pickLineResolved(input: {
  orderedBaseQty: number;
  pickedBaseQty: number;
  shortageBaseQty: number;
  shortageAction?: FulfillmentShortageAction | null;
}): boolean {
  const accounted =
    input.pickedBaseQty + input.shortageBaseQty >=
    input.orderedBaseQty - 0.0000001;
  if (!accounted) return false;
  if (input.shortageBaseQty <= 0.0000001) return true;
  return input.shortageAction === FulfillmentShortageAction.REMOVE_ITEM;
}

@Injectable()
export class StorefrontFulfillmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: StorefrontReservationService,
    private readonly states: OrderStateMachineService,
    private readonly stockReservations: StockReservationService,
    private readonly audit: AuditLogService,
  ) {}

  async list(
    branchId: string,
    status: SalesOrderStatus | undefined,
    pagination: PaginationDto,
  ) {
    const queueStatuses: SalesOrderStatus[] = [
      SalesOrderStatus.PLACED,
      SalesOrderStatus.PICKING,
      SalesOrderStatus.PARTIALLY_FULFILLED,
      SalesOrderStatus.PACKED,
      SalesOrderStatus.OUT_FOR_DELIVERY,
    ];
    const where: Prisma.SalesOrderWhereInput = {
      source: 'STOREFRONT',
      branchId,
      status: status && queueStatuses.includes(status)
        ? status
        : { in: queueStatuses },
    };

    const [items, total] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'asc' },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  skuCode: true,
                  barcode: true,
                  imageUrl: true,
                },
              },
              unit: true,
              fulfillmentPick: true,
            },
          },
          customer: {
            select: { id: true, phone: true, fullName: true },
          },
        },
      }),
      this.prisma.salesOrder.count({ where }),
    ]);

    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
    };
  }

  async detail(orderId: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: orderId, source: 'STOREFRONT' },
      include: {
        items: {
          include: {
            product: true,
            unit: true,
            fulfillmentPick: true,
          },
        },
        customer: {
          select: { id: true, phone: true, fullName: true },
        },
        fulfillmentLocation: true,
        reservations: {
          where: { status: 'ACTIVE' },
          include: { items: true },
        },
        statusEvents: { orderBy: { createdAt: 'asc' } },
        commercePayments: true,
        invoice: true,
        deliveryItems: {
          include: {
            delivery: true,
            invoice: true,
          },
        },
      },
    });
    if (!order) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Storefront order not found.', 404);
    }
    return order;
  }

  async startPicking(orderId: string, actorUserId: string) {
    await this.prisma.$transaction(
      async (tx) => {
        const transitioned = await this.states.transition(tx, {
          orderId,
          toStatus: SalesOrderStatus.PICKING,
          actorType: 'STAFF',
          actorUserId,
          reasonCode: 'PICKING_STARTED',
        });

        const items = await tx.salesOrderItem.findMany({
          where: { salesOrderId: orderId },
        });
        if (items.length === 0) {
          throw new AppError(
            ErrorCodes.VALIDATION_ERROR,
            'Order has no items to pick.',
            422,
          );
        }

        await tx.fulfillmentPickItem.createMany({
          data: items.map((item) => ({
            salesOrderItemId: item.id,
            orderedQuantity: item.quantity,
            orderedBaseQty: item.baseQuantity,
          })),
          skipDuplicates: true,
        });

        await tx.stockReservation.updateMany({
          where: {
            salesOrderId: transitioned.id,
            status: 'ACTIVE',
          },
          data: { expiresAt: null },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.detail(orderId);
  }

  async pickItem(
    orderId: string,
    orderItemId: string,
    dto: PickStorefrontItemDto,
    actorUserId: string,
  ) {
    await this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "SalesOrder"
          WHERE id = ${orderId}
          FOR UPDATE
        `;
        if (!locked[0]) {
          throw new AppError(ErrorCodes.NOT_FOUND, 'Order not found.', 404);
        }

        const order = await tx.salesOrder.findUnique({ where: { id: orderId } });
        if (
          !order ||
          order.source !== 'STOREFRONT' ||
          ![
            SalesOrderStatus.PICKING,
            SalesOrderStatus.PARTIALLY_FULFILLED,
          ].includes(order.status)
        ) {
          throw new AppError(
            ErrorCodes.INVALID_ORDER_TRANSITION,
            'Order must be in picking before items can be updated.',
            409,
          );
        }

        const item = await tx.salesOrderItem.findFirst({
          where: { id: orderItemId, salesOrderId: orderId },
          include: { fulfillmentPick: true },
        });
        if (!item?.fulfillmentPick) {
          throw new AppError(
            ErrorCodes.NOT_FOUND,
            'Picking line was not initialized.',
            404,
          );
        }

        const pick = item.fulfillmentPick;
        const orderedBase = Number(pick.orderedBaseQty);
        const requested = dto.pickedBaseQuantity;
        const shortage = Number(pick.shortageBaseQty);
        if (requested > orderedBase + 0.0000001) {
          throw new AppError(
            ErrorCodes.VALIDATION_ERROR,
            'Picked quantity cannot exceed ordered quantity.',
            422,
          );
        }
        if (requested + shortage > orderedBase + 0.0000001) {
          throw new AppError(
            ErrorCodes.VALIDATION_ERROR,
            'Picked plus shortage quantity exceeds the ordered quantity.',
            422,
          );
        }

        const orderedQty = Number(pick.orderedQuantity);
        const pickedQuantity =
          orderedBase > 0
            ? (orderedQty * requested) / orderedBase
            : 0;

        await tx.fulfillmentPickItem.update({
          where: { salesOrderItemId: orderItemId },
          data: {
            pickedBaseQty: requested,
            pickedQuantity,
            pickedById: actorUserId,
            isResolved: pickLineResolved({
              orderedBaseQty: orderedBase,
              pickedBaseQty: requested,
              shortageBaseQty: shortage,
              shortageAction: pick.shortageAction,
            }),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.detail(orderId);
  }

  async reportShortage(
    orderId: string,
    orderItemId: string,
    dto: ReportStorefrontShortageDto,
    actorUserId: string,
  ) {
    await this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "SalesOrder"
          WHERE id = ${orderId}
          FOR UPDATE
        `;
        if (!locked[0]) {
          throw new AppError(ErrorCodes.NOT_FOUND, 'Order not found.', 404);
        }

        const order = await tx.salesOrder.findUnique({ where: { id: orderId } });
        if (
          !order ||
          order.source !== 'STOREFRONT' ||
          ![
            SalesOrderStatus.PICKING,
            SalesOrderStatus.PARTIALLY_FULFILLED,
          ].includes(order.status) ||
          !order.branchId
        ) {
          throw new AppError(
            ErrorCodes.INVALID_ORDER_TRANSITION,
            'Order is not in an active picking state.',
            409,
          );
        }

        const item = await tx.salesOrderItem.findFirst({
          where: { id: orderItemId, salesOrderId: orderId },
          include: { fulfillmentPick: true },
        });
        if (!item?.fulfillmentPick) {
          throw new AppError(ErrorCodes.NOT_FOUND, 'Picking line not found.', 404);
        }

        const pick = item.fulfillmentPick;
        const orderedBase = Number(pick.orderedBaseQty);
        const pickedBase = Number(pick.pickedBaseQty);
        if (
          dto.shortageBaseQuantity + pickedBase >
          orderedBase + 0.0000001
        ) {
          throw new AppError(
            ErrorCodes.VALIDATION_ERROR,
            'Shortage plus picked quantity exceeds ordered quantity.',
            422,
          );
        }

        if (dto.action === FulfillmentShortageAction.CONTACT_CUSTOMER) {
          await tx.fulfillmentPickItem.update({
            where: { salesOrderItemId: orderItemId },
            data: {
              shortageBaseQty: dto.shortageBaseQuantity,
              shortageAction: dto.action,
              isResolved: false,
              note: dto.note,
              pickedById: actorUserId,
            },
          });
          return;
        }

        if (
          pickedBase > 0.0000001 ||
          Math.abs(dto.shortageBaseQuantity - orderedBase) > 0.0000001
        ) {
          throw new AppError(
            ErrorCodes.VALIDATION_ERROR,
            'P0 item removal supports only a fully unavailable, unpicked line.',
            422,
          );
        }

        const remainingLines = await tx.salesOrderItem.count({
          where: {
            salesOrderId: orderId,
            id: { not: orderItemId },
            baseQuantity: { gt: 0 },
          },
        });
        if (remainingLines === 0) {
          throw new AppError(
            ErrorCodes.VALIDATION_ERROR,
            'The final order line cannot be removed; cancel the order instead.',
            422,
          );
        }

        await this.reservations.releaseOrderItem(tx, {
          salesOrderId: orderId,
          salesOrderItemId: orderItemId,
          branchId: order.branchId,
          createdById: actorUserId,
          reason: dto.note ?? 'Item unavailable during storefront picking',
        });

        await tx.salesOrderItem.update({
          where: { id: orderItemId },
          data: {
            quantity: 0,
            baseQuantity: 0,
            lineTotal: 0,
            notes: dto.note ?? 'Removed during picking due to shortage',
          },
        });

        await tx.fulfillmentPickItem.update({
          where: { salesOrderItemId: orderItemId },
          data: {
            shortageBaseQty: orderedBase,
            shortageAction: FulfillmentShortageAction.REMOVE_ITEM,
            isResolved: true,
            note: dto.note,
            pickedById: actorUserId,
          },
        });

        const totals = await tx.salesOrderItem.aggregate({
          where: { salesOrderId: orderId },
          _sum: { lineTotal: true },
        });
        const subtotal = Number(totals._sum.lineTotal ?? 0);
        const grandTotal = Math.max(
          0,
          subtotal -
            Number(order.discountTotal) -
            Number(order.couponDiscount) +
            Number(order.taxTotal) +
            Number(order.deliveryFee) +
            Number(order.handlingFee),
        );

        await tx.salesOrder.update({
          where: { id: orderId },
          data: { subtotal, grandTotal },
        });
        await tx.commercePayment.updateMany({
          where: {
            salesOrderId: orderId,
            status: { in: ['PENDING', 'AUTHORIZED'] },
          },
          data: { amount: grandTotal },
        });

        if (order.status === SalesOrderStatus.PICKING) {
          await this.states.transition(tx, {
            orderId,
            toStatus: SalesOrderStatus.PARTIALLY_FULFILLED,
            actorType: 'STAFF',
            actorUserId,
            reasonCode: 'ITEM_REMOVED_SHORTAGE',
            note: dto.note,
            metadata: { salesOrderItemId: orderItemId },
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.detail(orderId);
  }

  async pack(orderId: string, actorUserId: string) {
    await this.prisma.$transaction(
      async (tx) => {
        const order = await tx.salesOrder.findFirst({
          where: {
            id: orderId,
            source: 'STOREFRONT',
            status: {
              in: [
                SalesOrderStatus.PICKING,
                SalesOrderStatus.PARTIALLY_FULFILLED,
              ],
            },
          },
          include: {
            items: { include: { fulfillmentPick: true } },
          },
        });
        if (!order) {
          throw new AppError(
            ErrorCodes.INVALID_ORDER_TRANSITION,
            'Order must be in picking before it can be packed.',
            409,
          );
        }

        const unresolved = order.items.filter((item) => {
          const pick = item.fulfillmentPick;
          if (!pick) return true;
          if (Number(item.baseQuantity) <= 0.0000001) {
            return !pick.isResolved;
          }
          return (
            !pick.isResolved ||
            Number(pick.pickedBaseQty) + 0.0000001 <
              Number(item.baseQuantity)
          );
        });
        if (unresolved.length > 0) {
          throw new AppError(
            ErrorCodes.VALIDATION_ERROR,
            'All retained order lines must be fully picked or explicitly resolved before packing.',
            422,
            { unresolvedItemIds: unresolved.map((item) => item.id) },
          );
        }

        await this.states.transition(tx, {
          orderId,
          toStatus: SalesOrderStatus.PACKED,
          actorType: 'STAFF',
          actorUserId,
          reasonCode: 'ORDER_PACKED',
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.detail(orderId);
  }

  async dispatch(orderId: string, actorUserId: string) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "SalesOrder"
          WHERE id = ${orderId}
          FOR UPDATE
        `;
        if (!locked[0]) {
          throw new AppError(ErrorCodes.NOT_FOUND, 'Order not found.', 404);
        }

        const order = await tx.salesOrder.findUnique({
          where: { id: orderId },
          include: {
            items: true,
            reservations: {
              where: { status: 'ACTIVE' },
              include: {
                items: {
                  include: { salesOrderItem: true },
                },
              },
            },
            deliveryItems: {
              include: { delivery: true, invoice: true },
            },
          },
        });

        if (!order || order.source !== 'STOREFRONT') {
          throw new AppError(
            ErrorCodes.NOT_FOUND,
            'Storefront order not found.',
            404,
          );
        }

        if (
          order.status === SalesOrderStatus.OUT_FOR_DELIVERY ||
          order.status === SalesOrderStatus.DELIVERED
        ) {
          return {
            branchId: order.branchId ?? undefined,
            alreadyDispatched: true,
          };
        }

        if (
          order.status !== SalesOrderStatus.PACKED ||
          !order.branchId ||
          !order.fulfillmentLocationId
        ) {
          throw new AppError(
            ErrorCodes.INVALID_ORDER_TRANSITION,
            'Only a packed storefront order can be dispatched.',
            409,
          );
        }

        const reservationItems = order.reservations.flatMap(
          (reservation) => reservation.items,
        );
        if (reservationItems.length === 0) {
          throw new AppError(
            ErrorCodes.CONFLICT,
            'Packed order has no active inventory reservation.',
            409,
          );
        }

        const invoice = await tx.invoice.create({
          data: {
            branchId: order.branchId,
            invoiceNumber:
              `INV-WEB-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`,
            invoiceType: 'SALE',
            retailerId: null,
            warehouseId: null,
            sourceLocationId: order.fulfillmentLocationId,
            status: 'POSTED',
            paymentStatus: 'UNPAID',
            subtotal: order.subtotal,
            discountTotal:
              Number(order.discountTotal) + Number(order.couponDiscount),
            taxTotal: order.taxTotal,
            grandTotal: order.grandTotal,
            paidAmount: 0,
            dueAmount: order.grandTotal,
            createdById: actorUserId,
            postedById: actorUserId,
            postedAt: new Date(),
          },
        });

        for (const allocation of reservationItems) {
          const source = allocation.salesOrderItem;
          const orderedBase = Number(source.baseQuantity);
          if (orderedBase <= 0.0000001) continue;

          const fraction =
            Number(allocation.baseQuantity) / orderedBase;
          const quantity = Number(source.quantity) * fraction;
          const lineTotal = Number(source.lineTotal) * fraction;

          await tx.invoiceItem.create({
            data: {
              invoiceId: invoice.id,
              productId: source.productId,
              batchId: allocation.batchId,
              unitId: source.unitId,
              quantity,
              baseQuantity: allocation.baseQuantity,
              unitPrice: source.unitPrice,
              discountAmount: Number(source.discountAmount) * fraction,
              taxAmount: Number(source.taxAmount) * fraction,
              lineTotal,
            },
          });
        }

        await tx.salesOrder.update({
          where: { id: order.id },
          data: { invoiceId: invoice.id },
        });

        await this.stockReservations.consumeForOrder(tx, {
          salesOrderId: order.id,
          invoiceId: invoice.id,
          branchId: order.branchId,
          createdById: actorUserId,
        });

        await tx.financialLedgerEntry.create({
          data: {
            branchId: order.branchId,
            entryType: 'SALES_CREDIT',
            referenceType: 'INVOICE',
            referenceId: invoice.id,
            debitAmount: 0,
            creditAmount: order.grandTotal,
            createdById: actorUserId,
          },
        });

        const delivery = await tx.delivery.create({
          data: {
            deliveryNo:
              `DLV-WEB-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`,
            branchId: order.branchId,
            status: 'IN_TRANSIT',
            dispatchedAt: new Date(),
            notes: 'Storefront direct-customer delivery',
            createdById: actorUserId,
          },
        });

        await tx.deliveryItem.create({
          data: {
            deliveryId: delivery.id,
            retailerId: null,
            invoiceId: invoice.id,
            orderId: order.id,
          },
        });

        await this.states.transition(tx, {
          orderId: order.id,
          toStatus: SalesOrderStatus.OUT_FOR_DELIVERY,
          actorType: 'STAFF',
          actorUserId,
          reasonCode: 'ORDER_DISPATCHED',
          metadata: {
            invoiceId: invoice.id,
            deliveryId: delivery.id,
          },
        });

        return {
          branchId: order.branchId,
          alreadyDispatched: false,
          invoiceId: invoice.id,
          deliveryId: delivery.id,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!result.alreadyDispatched) {
      await this.audit.record({
        actorUserId,
        action: 'DELIVERY_UPDATED',
        entityType: 'SALES_ORDER',
        entityId: orderId,
        branchId: result.branchId,
        afterData: {
          status: 'OUT_FOR_DELIVERY',
          invoiceId: result.invoiceId,
          deliveryId: result.deliveryId,
        },
      });
    }

    return this.detail(orderId);
  }

  async deliver(orderId: string, actorUserId: string) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "SalesOrder"
          WHERE id = ${orderId}
          FOR UPDATE
        `;
        if (!locked[0]) {
          throw new AppError(ErrorCodes.NOT_FOUND, 'Order not found.', 404);
        }

        const order = await tx.salesOrder.findUnique({
          where: { id: orderId },
          include: {
            commercePayments: true,
            invoice: true,
            deliveryItems: { include: { delivery: true } },
          },
        });
        if (!order || order.source !== 'STOREFRONT') {
          throw new AppError(
            ErrorCodes.NOT_FOUND,
            'Storefront order not found.',
            404,
          );
        }

        if (order.status === SalesOrderStatus.DELIVERED) {
          return {
            branchId: order.branchId ?? undefined,
            alreadyDelivered: true,
          };
        }
        if (
          order.status !== SalesOrderStatus.OUT_FOR_DELIVERY ||
          !order.branchId ||
          !order.invoice
        ) {
          throw new AppError(
            ErrorCodes.INVALID_ORDER_TRANSITION,
            'Only an out-for-delivery storefront order can be delivered.',
            409,
          );
        }

        const payment = order.commercePayments.find(
          (candidate) => candidate.method === 'COD',
        );
        if (!payment) {
          throw new AppError(
            ErrorCodes.PAYMENT_FAILED,
            'COD payment record is missing.',
            409,
          );
        }
        if (
          !['PENDING', 'AUTHORIZED', 'PAID'].includes(payment.status)
        ) {
          throw new AppError(
            ErrorCodes.PAYMENT_FAILED,
            'COD payment is not collectible in its current state.',
            409,
          );
        }

        const now = new Date();
        if (payment.status !== 'PAID') {
          await tx.commercePayment.update({
            where: { id: payment.id },
            data: { status: 'PAID', paidAt: now },
          });
        }

        await tx.invoice.update({
          where: { id: order.invoice.id },
          data: {
            status: 'PAID',
            paymentStatus: 'PAID',
            paidAmount: order.grandTotal,
            dueAmount: 0,
          },
        });

        const cashEntry = await tx.financialLedgerEntry.findFirst({
          where: {
            referenceType: 'PAYMENT',
            referenceId: payment.id,
            entryType: 'CASH_DEBIT',
          },
          select: { id: true },
        });
        if (!cashEntry) {
          await tx.financialLedgerEntry.create({
            data: {
              branchId: order.branchId,
              entryType: 'CASH_DEBIT',
              referenceType: 'PAYMENT',
              referenceId: payment.id,
              debitAmount: order.grandTotal,
              creditAmount: 0,
              createdById: actorUserId,
            },
          });
        }

        const deliveryItem = order.deliveryItems.find(
          (candidate) => candidate.orderId === order.id,
        );
        if (!deliveryItem) {
          throw new AppError(
            ErrorCodes.NOT_FOUND,
            'Delivery record is missing for this order.',
            404,
          );
        }

        await tx.deliveryItem.update({
          where: { id: deliveryItem.id },
          data: { isDelivered: true },
        });
        await tx.delivery.update({
          where: { id: deliveryItem.deliveryId },
          data: {
            status: 'DELIVERED',
            completedAt: now,
          },
        });

        await this.states.transition(tx, {
          orderId: order.id,
          toStatus: SalesOrderStatus.DELIVERED,
          actorType: 'STAFF',
          actorUserId,
          reasonCode: 'ORDER_DELIVERED',
          metadata: {
            invoiceId: order.invoice.id,
            paymentId: payment.id,
            deliveryId: deliveryItem.deliveryId,
          },
        });

        return {
          branchId: order.branchId,
          alreadyDelivered: false,
          paymentId: payment.id,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!result.alreadyDelivered) {
      await this.audit.record({
        actorUserId,
        action: 'DELIVERY_COMPLETED',
        entityType: 'SALES_ORDER',
        entityId: orderId,
        branchId: result.branchId,
        afterData: {
          status: 'DELIVERED',
          paymentId: result.paymentId,
        },
      });
    }

    return this.detail(orderId);
  }

}
