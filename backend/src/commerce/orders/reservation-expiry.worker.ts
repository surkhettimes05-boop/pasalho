import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { StorefrontSystemActorService } from '../common/storefront-system-actor.service';
import { StorefrontReservationService } from '../checkout/storefront-reservation.service';
import { OrderStateMachineService } from './order-state-machine.service';

@Injectable()
export class ReservationExpiryWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ReservationExpiryWorker.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: StorefrontReservationService,
    private readonly states: OrderStateMachineService,
    private readonly systemActor: StorefrontSystemActorService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      void this.runOnce().catch((error) => {
        this.logger.error(
          'Reservation expiry sweep failed',
          error instanceof Error ? error.stack : String(error),
        );
      });
    }, 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async runOnce() {
    const candidates = await this.prisma.stockReservation.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: new Date() },
        salesOrder: {
          source: 'STOREFRONT',
          status: 'PLACED',
        },
      },
      select: { id: true },
      take: 25,
      orderBy: { expiresAt: 'asc' },
    });
    if (candidates.length === 0) return { released: 0 };

    const actorUserId = await this.systemActor.getUserId();
    let released = 0;

    for (const candidate of candidates) {
      try {
        const didRelease = await this.prisma.$transaction(
          async (tx) => {
            const locked = await tx.$queryRaw<Array<{ id: string }>>`
              SELECT id FROM "StockReservation"
              WHERE id = ${candidate.id}
              FOR UPDATE
            `;
            if (!locked[0]) return false;

            const reservation = await tx.stockReservation.findUnique({
              where: { id: candidate.id },
              include: { salesOrder: true },
            });
            if (
              !reservation ||
              reservation.status !== 'ACTIVE' ||
              !reservation.expiresAt ||
              reservation.expiresAt > new Date() ||
              reservation.salesOrder.source !== 'STOREFRONT' ||
              reservation.salesOrder.status !== 'PLACED' ||
              !reservation.salesOrder.branchId
            ) {
              return false;
            }

            await this.reservations.releaseOrder(tx, {
              salesOrderId: reservation.salesOrderId,
              branchId: reservation.salesOrder.branchId,
              createdById: actorUserId,
              reason: 'Storefront reservation expired before picking',
            });

            await this.states.transition(tx, {
              orderId: reservation.salesOrderId,
              toStatus: 'FAILED',
              actorType: 'SYSTEM',
              actorUserId,
              reasonCode: 'RESERVATION_EXPIRED',
              note: 'Inventory reservation expired before store picking began.',
            });

            await tx.commercePayment.updateMany({
              where: {
                salesOrderId: reservation.salesOrderId,
                status: { in: ['PENDING', 'AUTHORIZED'] },
              },
              data: { status: 'CANCELLED' },
            });

            return true;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        if (didRelease) released += 1;
      } catch (error) {
        this.logger.error(
          `Could not expire reservation ${candidate.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return { released };
  }
}
