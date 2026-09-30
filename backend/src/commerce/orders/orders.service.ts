import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { AuditLogService } from '../../audit/audit-log.service';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import { StorefrontSystemActorService } from '../common/storefront-system-actor.service';
import { StorefrontReservationService } from '../checkout/storefront-reservation.service';
import { CancelStorefrontOrderDto } from './dto/cancel-order.dto';
import { OrderStateMachineService } from './order-state-machine.service';

@Injectable()
export class CustomerOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: StorefrontReservationService,
    private readonly states: OrderStateMachineService,
    private readonly systemActor: StorefrontSystemActorService,
    private readonly audit: AuditLogService,
  ) {}

  async list(customerId: string, pagination: PaginationDto) {
    const where: Prisma.SalesOrderWhereInput = {
      source: 'STOREFRONT',
      customerId,
    };
    const [items, total] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  skuCode: true,
                  slug: true,
                  imageUrl: true,
                },
              },
              unit: true,
            },
          },
          commercePayments: true,
          fulfillmentLocation: {
            select: { id: true, name: true },
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

  async detail(customerId: string, orderId: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: {
        id: orderId,
        source: 'STOREFRONT',
        customerId,
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                skuCode: true,
                slug: true,
                imageUrl: true,
              },
            },
            unit: true,
          },
        },
        commercePayments: true,
        statusEvents: { orderBy: { createdAt: 'asc' } },
        fulfillmentLocation: {
          select: { id: true, name: true },
        },
      },
    });
    if (!order) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Order not found.', 404);
    }
    return order;
  }

  async tracking(customerId: string, orderId: string) {
    const order = await this.detail(customerId, orderId);
    return {
      id: order.id,
      orderNo: order.orderNo,
      status: order.status,
      placedAt: order.placedAt,
      pickingStartedAt: order.pickingStartedAt,
      packedAt: order.packedAt,
      outForDeliveryAt: order.outForDeliveryAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      timeline: order.statusEvents,
    };
  }

  async cancel(
    customerId: string,
    orderId: string,
    idempotencyKey: string | undefined,
    dto: CancelStorefrontOrderDto,
  ) {
    if (!idempotencyKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
      throw new AppError(
        ErrorCodes.IDEMPOTENCY_KEY_REQUIRED,
        'A UUID Idempotency-Key header is required.',
        422,
      );
    }

    const requestHash = createHash('sha256')
      .update(JSON.stringify({ customerId, orderId, reason: dto.reason }))
      .digest('hex');
    const actorUserId = await this.systemActor.getUserId();

    const result = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.idempotencyRecord.findUnique({
          where: {
            scope_key: {
              scope: 'commerce.order.cancel',
              key: idempotencyKey,
            },
          },
        });
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new AppError(
              ErrorCodes.IDEMPOTENCY_KEY_REUSED,
              'Idempotency key was already used for a different request.',
              409,
            );
          }
          if (existing.status === 'COMPLETED' && existing.responseBody) {
            return {
              response: existing.responseBody as Record<string, unknown>,
              replayed: true,
              branchId: undefined as string | undefined,
            };
          }
          throw new AppError(
            ErrorCodes.CONFLICT,
            'This cancellation is already processing.',
            409,
          );
        }

        await tx.idempotencyRecord.create({
          data: {
            scope: 'commerce.order.cancel',
            key: idempotencyKey,
            requestHash,
            expiresAt: new Date(Date.now() + 24 * 3600000),
          },
        });

        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "SalesOrder"
          WHERE id = ${orderId}
          FOR UPDATE
        `;
        if (!locked[0]) {
          throw new AppError(ErrorCodes.NOT_FOUND, 'Order not found.', 404);
        }

        const order = await tx.salesOrder.findFirst({
          where: {
            id: orderId,
            source: 'STOREFRONT',
            customerId,
          },
        });
        if (!order) {
          throw new AppError(ErrorCodes.NOT_FOUND, 'Order not found.', 404);
        }
        if (!['PLACED', 'CONFIRMED'].includes(order.status)) {
          throw new AppError(
            ErrorCodes.ORDER_NOT_CANCELLABLE,
            'Order can no longer be cancelled by the customer.',
            409,
          );
        }
        if (!order.branchId) {
          throw new AppError(
            ErrorCodes.INTERNAL_ERROR,
            'Storefront order has no fulfillment branch.',
            500,
          );
        }

        await this.reservations.releaseOrder(tx, {
          salesOrderId: order.id,
          branchId: order.branchId,
          createdById: actorUserId,
          reason: dto.reason,
        });

        const cancelled = await this.states.transition(tx, {
          orderId: order.id,
          toStatus: 'CANCELLED',
          actorType: 'CUSTOMER',
          customerId,
          cancellationReason: dto.reason,
          reasonCode: 'CUSTOMER_CANCELLED',
          note: dto.reason,
        });

        await tx.commercePayment.updateMany({
          where: {
            salesOrderId: order.id,
            status: { in: ['PENDING', 'AUTHORIZED'] },
          },
          data: { status: 'CANCELLED' },
        });

        const response = {
          id: cancelled.id,
          orderNo: cancelled.orderNo,
          status: cancelled.status,
          cancelledAt: cancelled.cancelledAt,
        };

        await tx.idempotencyRecord.update({
          where: {
            scope_key: {
              scope: 'commerce.order.cancel',
              key: idempotencyKey,
            },
          },
          data: {
            status: 'COMPLETED',
            responseStatus: 200,
            responseBody: response,
            resourceId: order.id,
            completedAt: new Date(),
          },
        });

        return { response, replayed: false, branchId: order.branchId };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!result.replayed) {
      await this.audit.record({
        actorUserId,
        action: 'SALES_ORDER_CANCELLED',
        entityType: 'SALES_ORDER',
        entityId: orderId,
        branchId: result.branchId,
        reason: dto.reason,
        afterData: { status: 'CANCELLED' },
      });
    }

    return result.response;
  }
}
