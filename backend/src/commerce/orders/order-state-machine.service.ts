import { Injectable } from '@nestjs/common';
import {
  OrderStatusEventActor,
  Prisma,
  SalesOrderStatus,
} from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';

const ALLOWED: Partial<Record<SalesOrderStatus, SalesOrderStatus[]>> = {
  PLACED: [
    SalesOrderStatus.PICKING,
    SalesOrderStatus.CANCELLED,
    SalesOrderStatus.FAILED,
  ],
  CONFIRMED: [
    SalesOrderStatus.PICKING,
    SalesOrderStatus.CANCELLED,
  ],
  PICKING: [
    SalesOrderStatus.PACKED,
    SalesOrderStatus.PARTIALLY_FULFILLED,
    SalesOrderStatus.CANCELLED,
  ],
  PARTIALLY_FULFILLED: [
    SalesOrderStatus.PACKED,
    SalesOrderStatus.CANCELLED,
  ],
  PACKED: [
    SalesOrderStatus.OUT_FOR_DELIVERY,
    SalesOrderStatus.CANCELLED,
  ],
  OUT_FOR_DELIVERY: [
    SalesOrderStatus.DELIVERED,
    SalesOrderStatus.FAILED,
  ],
  FAILED: [SalesOrderStatus.REFUND_PENDING],
  REFUND_PENDING: [SalesOrderStatus.REFUNDED],
};

export function isStorefrontTransitionAllowed(
  from: SalesOrderStatus,
  to: SalesOrderStatus,
): boolean {
  return from === to || (ALLOWED[from] ?? []).includes(to);
}

@Injectable()
export class OrderStateMachineService {
  async transition(
    tx: Prisma.TransactionClient,
    input: {
      orderId: string;
      toStatus: SalesOrderStatus;
      actorType: OrderStatusEventActor;
      actorUserId?: string;
      customerId?: string;
      reasonCode?: string;
      note?: string;
      cancellationReason?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "SalesOrder"
      WHERE id = ${input.orderId}
      FOR UPDATE
    `;
    if (!locked[0]) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Order not found.', 404);
    }

    const order = await tx.salesOrder.findUnique({
      where: { id: input.orderId },
    });
    if (!order || order.source !== 'STOREFRONT') {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Storefront order not found.', 404);
    }

    if (order.status === input.toStatus) return order;
    if (!isStorefrontTransitionAllowed(order.status, input.toStatus)) {
      throw new AppError(
        ErrorCodes.INVALID_ORDER_TRANSITION,
        `Cannot transition storefront order from ${order.status} to ${input.toStatus}.`,
        409,
      );
    }

    const now = new Date();
    const data: Prisma.SalesOrderUncheckedUpdateInput = {
      status: input.toStatus,
    };

    if (input.toStatus === SalesOrderStatus.CONFIRMED) data.confirmedAt = now;
    if (input.toStatus === SalesOrderStatus.PICKING) data.pickingStartedAt = now;
    if (input.toStatus === SalesOrderStatus.PACKED) data.packedAt = now;
    if (input.toStatus === SalesOrderStatus.OUT_FOR_DELIVERY) {
      data.outForDeliveryAt = now;
    }
    if (input.toStatus === SalesOrderStatus.DELIVERED) data.deliveredAt = now;
    if (input.toStatus === SalesOrderStatus.CANCELLED) {
      data.cancelledAt = now;
      data.cancellationReason =
        input.cancellationReason ?? input.note ?? input.reasonCode ?? 'Cancelled';
    }

    const updated = await tx.salesOrder.update({
      where: { id: order.id },
      data,
    });

    await tx.orderStatusEvent.create({
      data: {
        salesOrderId: order.id,
        fromStatus: order.status,
        toStatus: input.toStatus,
        actorType: input.actorType,
        actorUserId: input.actorUserId,
        customerId: input.customerId,
        reasonCode: input.reasonCode,
        note: input.note,
        metadata: input.metadata,
      },
    });

    return updated;
  }
}
