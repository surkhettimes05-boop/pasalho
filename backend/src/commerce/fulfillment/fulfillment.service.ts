import { Injectable } from '@nestjs/common';
import {
  FulfillmentShortageAction,
  Prisma,
  SalesOrderStatus,
} from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
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
}
