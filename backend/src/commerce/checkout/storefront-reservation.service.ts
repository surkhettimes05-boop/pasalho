import { Injectable } from '@nestjs/common';
import {
  Prisma,
  ReferenceType,
  StockReservationStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { StockReservationService } from '../../inventory/services/stock-reservation.service';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';

export type ReservationSnapshot = {
  id: string;
  batchId: string | null;
  unitId: string;
  quantity: number;
  baseQuantity: number;
};

export type ReservationAllocation = {
  snapshotId: string;
  batchId: string | null;
  unitId: string;
  quantity: number;
  baseQuantity: number;
};

export function allocateReservationSnapshots(
  snapshots: ReservationSnapshot[],
  requestedBaseQuantity: number,
): ReservationAllocation[] {
  let remaining = requestedBaseQuantity;
  const allocations: ReservationAllocation[] = [];

  for (const snapshot of snapshots) {
    if (remaining <= 0.0000001) break;
    if (snapshot.baseQuantity <= 0) continue;

    const baseQuantity = Math.min(remaining, snapshot.baseQuantity);
    const ratio =
      snapshot.baseQuantity > 0
        ? snapshot.quantity / snapshot.baseQuantity
        : 0;
    const quantity = Math.round(baseQuantity * ratio * 1_000_000) / 1_000_000;

    allocations.push({
      snapshotId: snapshot.id,
      batchId: snapshot.batchId,
      unitId: snapshot.unitId,
      quantity,
      baseQuantity,
    });
    remaining = Math.max(0, remaining - baseQuantity);
  }

  if (remaining > 0.0000001) {
    throw new AppError(
      ErrorCodes.INSUFFICIENT_STOCK,
      'Insufficient sellable inventory to complete the reservation.',
      422,
    );
  }

  return allocations;
}

@Injectable()
export class StorefrontReservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockReservation: StockReservationService,
  ) {}

  async reserveOrder(
    tx: Prisma.TransactionClient,
    input: {
      salesOrderId: string;
      branchId: string;
      locationId: string;
      createdById: string;
      expiresAt: Date;
      items: Array<{
        salesOrderItemId: string;
        productId: string;
        requestedBaseQuantity: number;
      }>;
    },
  ) {
    const existing = await tx.stockReservation.findFirst({
      where: {
        salesOrderId: input.salesOrderId,
        status: StockReservationStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (existing) {
      throw new AppError(
        ErrorCodes.CONFLICT,
        'Order already has an active inventory reservation.',
        409,
      );
    }

    const reservation = await tx.stockReservation.create({
      data: {
        salesOrderId: input.salesOrderId,
        branchId: input.branchId,
        locationId: input.locationId,
        createdById: input.createdById,
        expiresAt: input.expiresAt,
      },
    });

    for (const item of input.items) {
      const config = await tx.storeProductConfig.findUnique({
        where: {
          inventoryLocationId_productId: {
            inventoryLocationId: input.locationId,
            productId: item.productId,
          },
        },
        select: {
          isVisible: true,
          safetyStockBaseQty: true,
          maxOrderBaseQty: true,
        },
      });

      if (!config?.isVisible) {
        throw new AppError(
          ErrorCodes.PRODUCT_NOT_ORDERABLE,
          'Product is not enabled for this fulfillment store.',
          422,
        );
      }

      const requestedBase = item.requestedBaseQuantity;
      if (
        config.maxOrderBaseQty != null &&
        requestedBase > Number(config.maxOrderBaseQty) + 0.0000001
      ) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'Requested quantity exceeds the store order limit.',
          422,
        );
      }

      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          batchId: string | null;
          unitId: string;
          quantity: string;
          baseQuantity: string;
        }>
      >`
        SELECT
          s.id,
          s."batchId",
          s."unitId",
          s.quantity::text AS quantity,
          s."baseQuantity"::text AS "baseQuantity"
        FROM "InventorySnapshot" s
        LEFT JOIN "Batch" b ON b.id = s."batchId"
        WHERE s."locationId" = ${input.locationId}
          AND s."productId" = ${item.productId}
          AND s."stockState" = 'AVAILABLE'::"StockState"
          AND s."baseQuantity" > 0
          AND (
            s."batchId" IS NULL
            OR (
              b.status = 'ACTIVE'::"BatchStatus"
              AND (b."expiryDate" IS NULL OR b."expiryDate" > NOW())
            )
          )
        ORDER BY b."expiryDate" ASC NULLS LAST, s."updatedAt" ASC
        FOR UPDATE OF s
      `;

      const snapshots: ReservationSnapshot[] = rows.map((row) => ({
        id: row.id,
        batchId: row.batchId,
        unitId: row.unitId,
        quantity: Number(row.quantity),
        baseQuantity: Number(row.baseQuantity),
      }));

      const totalAvailable = snapshots.reduce(
        (total, snapshot) => total + snapshot.baseQuantity,
        0,
      );
      const safetyStock = Math.max(0, Number(config.safetyStockBaseQty));
      if (totalAvailable - safetyStock + 0.0000001 < requestedBase) {
        throw new AppError(
          ErrorCodes.INSUFFICIENT_STOCK,
          'Insufficient sellable inventory for this product.',
          422,
        );
      }

      const allocations = allocateReservationSnapshots(
        snapshots,
        requestedBase,
      );

      for (const allocation of allocations) {
        await this.stockReservation.reserveStock(
          {
            branchId: input.branchId,
            locationId: input.locationId,
            productId: item.productId,
            batchId: allocation.batchId ?? undefined,
            unitId: allocation.unitId,
            quantity: allocation.quantity,
            baseQuantity: allocation.baseQuantity,
            referenceType: ReferenceType.SALES_ORDER,
            referenceId: input.salesOrderId,
            createdById: input.createdById,
            reason: 'Storefront checkout reservation',
          },
          tx,
          false,
        );

        await tx.stockReservationItem.create({
          data: {
            reservationId: reservation.id,
            salesOrderItemId: item.salesOrderItemId,
            productId: item.productId,
            batchId: allocation.batchId,
            unitId: allocation.unitId,
            quantity: allocation.quantity,
            baseQuantity: allocation.baseQuantity,
          },
        });
      }
    }

    return tx.stockReservation.findUnique({
      where: { id: reservation.id },
      include: { items: true },
    });
  }

  async releaseOrder(
    tx: Prisma.TransactionClient,
    input: {
      salesOrderId: string;
      branchId: string;
      createdById: string;
      reason: string;
    },
  ) {
    const reservations = await tx.stockReservation.findMany({
      where: {
        salesOrderId: input.salesOrderId,
        status: StockReservationStatus.ACTIVE,
      },
      include: { items: true },
    });

    for (const reservation of reservations) {
      for (const item of reservation.items) {
        await this.stockReservation.releaseStock(
          {
            branchId: input.branchId,
            locationId: reservation.locationId,
            productId: item.productId,
            batchId: item.batchId ?? undefined,
            unitId: item.unitId,
            quantity: Number(item.quantity),
            baseQuantity: Number(item.baseQuantity),
            referenceType: ReferenceType.SALES_ORDER,
            referenceId: input.salesOrderId,
            createdById: input.createdById,
            reason: input.reason,
          },
          tx,
          false,
        );
      }

      await tx.stockReservation.update({
        where: { id: reservation.id },
        data: {
          status: StockReservationStatus.RELEASED,
          releasedAt: new Date(),
          expiresAt: null,
        },
      });
    }

    return { releasedReservationIds: reservations.map((reservation) => reservation.id) };
  }
}
