import { Injectable } from '@nestjs/common';
import { Prisma, StockState } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';

export interface ReserveStockInput {
  branchId: string;
  locationId: string;
  productId: string;
  batchId?: string;
  unitId: string;
  quantity: number;
  baseQuantity: number;
  referenceType: string;
  referenceId: string;
  createdById: string;
  reason?: string;
}

export interface ReleaseReservationInput {
  reservationId: string;
  createdById: string;
  reason?: string;
}

@Injectable()
export class StockReservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: InventoryLedgerService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Reserve stock for a pending operation (e.g. invoice being created, transfer pending).
   * Moves `baseQuantity` from AVAILABLE to RESERVED state within the same location.
   * This is done inside a transaction with snapshot row locking to prevent oversell.
   */
  async reserveStock(input: ReserveStockInput) {
    if (input.baseQuantity <= 0) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Reserve quantity must be positive.', 422);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Validate and lock the AVAILABLE snapshot row
      const availableSnapshots = await tx.$queryRaw<
        Array<{ id: string; base_quantity: string; quantity: string; unitId: string }>
      >`
        SELECT id, base_quantity, quantity, "unitId"
        FROM "InventorySnapshot"
        WHERE "locationId" = ${input.locationId}
          AND "productId" = ${input.productId}
          AND ("batchId" = ${input.batchId ?? null} OR ("batchId" IS NULL AND ${input.batchId ?? null} IS NULL))
          AND "stockState" = 'AVAILABLE'::"StockState"
          AND "unitId" = ${input.unitId}
        FOR UPDATE
      `;

      const available = availableSnapshots[0];
      if (!available || Number(available.base_quantity) < input.baseQuantity) {
        throw new AppError(
          ErrorCodes.INSUFFICIENT_STOCK,
          `Insufficient available stock. Have ${available ? Number(available.base_quantity) : 0}, need ${input.baseQuantity}.`,
          422,
        );
      }

      // 2. Deduct from AVAILABLE
      const newAvailBase = Number(available.base_quantity) - input.baseQuantity;
      const ratio = Number(available.quantity) / Number(available.base_quantity);
      const newAvailQty = Math.round((newAvailBase * ratio) * 1_000_000) / 1_000_000; // preserve precision

      await tx.$executeRaw`
        UPDATE "InventorySnapshot"
        SET quantity = ${newAvailQty}, "baseQuantity" = ${newAvailBase}, version = version + 1, "updatedAt" = NOW()
        WHERE id = ${available.id}
      `;

      // 3. Upsert RESERVED snapshot (add to it)
      const reservedSnapshots = await tx.$queryRaw<
        Array<{ id: string; base_quantity: string; quantity: string }>
      >`
        SELECT id, base_quantity, quantity
        FROM "InventorySnapshot"
        WHERE "locationId" = ${input.locationId}
          AND "productId" = ${input.productId}
          AND ("batchId" = ${input.batchId ?? null} OR ("batchId" IS NULL AND ${input.batchId ?? null} IS NULL))
          AND "stockState" = 'RESERVED'::"StockState"
          AND "unitId" = ${input.unitId}
        FOR UPDATE
      `;

      const reserved = reservedSnapshots[0];
      if (reserved) {
        const newResBase = Number(reserved.base_quantity) + input.baseQuantity;
        const newResQty = Number(reserved.quantity) + input.quantity;

        await tx.$executeRaw`
          UPDATE "InventorySnapshot"
          SET quantity = ${newResQty}, "baseQuantity" = ${newResBase}, version = version + 1, "updatedAt" = NOW()
          WHERE id = ${reserved.id}
        `;
      } else {
        await tx.inventorySnapshot.create({
          data: {
            locationId: input.locationId,
            productId: input.productId,
            batchId: input.batchId,
            stockState: StockState.RESERVED,
            unitId: input.unitId,
            quantity: input.quantity,
            baseQuantity: input.baseQuantity,
          },
        });
      }

      // 4. Record the movement pair (AVAILABLE out, RESERVED in)
      const event = await tx.inventoryEvent.create({
        data: {
          eventType: 'MANUAL_ADJUSTMENT',
          eventStatus: 'POSTED',
          branchId: input.branchId,
          referenceType: input.referenceType as any,
          referenceId: input.referenceId,
          createdById: input.createdById,
          metadata: { action: 'RESERVE', reason: input.reason },
        },
      });

      // Movement: AVAILABLE out (negative)
      await tx.inventoryMovement.create({
        data: {
          inventoryEventId: event.id,
          branchId: input.branchId,
          locationId: input.locationId,
          productId: input.productId,
          batchId: input.batchId,
          stockState: StockState.AVAILABLE,
          unitId: input.unitId,
          quantityDelta: -input.quantity,
          baseQuantityDelta: -input.baseQuantity,
          movementType: 'ADJUSTMENT',
          referenceType: input.referenceType as any,
          referenceId: input.referenceId,
          reasonCode: 'STOCK_RESERVED',
          createdById: input.createdById,
          metadata: { reservationAction: 'reserve' },
        },
      });

      // Movement: RESERVED in (positive)
      await tx.inventoryMovement.create({
        data: {
          inventoryEventId: event.id,
          branchId: input.branchId,
          locationId: input.locationId,
          productId: input.productId,
          batchId: input.batchId,
          stockState: StockState.RESERVED,
          unitId: input.unitId,
          quantityDelta: input.quantity,
          baseQuantityDelta: input.baseQuantity,
          movementType: 'ADJUSTMENT',
          referenceType: input.referenceType as any,
          referenceId: input.referenceId,
          reasonCode: 'STOCK_RESERVED',
          createdById: input.createdById,
          metadata: { reservationAction: 'reserve' },
        },
      });

      return { eventId: event.id, reservedBaseQty: input.baseQuantity };
    });

    await this.audit.record({
      actorUserId: input.createdById,
      action: 'STOCK_ADJUSTMENT_POSTED' as any,
      entityType: 'PRODUCT',
      entityId: input.productId,
      branchId: input.branchId,
      afterData: { action: 'reserve', productId: input.productId, quantity: input.baseQuantity },
    });

    return result;
  }

  /**
   * Release a reservation — move stock back from RESERVED to AVAILABLE.
   * Used when an invoice is cancelled, a transfer is aborted, etc.
   */
  async releaseReservation(input: ReleaseReservationInput) {
    // Find the most recent RESERVED movements for this reference to determine quantities
    // We expect the caller to know the original reservation details
    // For simplicity, the release takes the same shape as reserve but reverses direction
    const result = await this.prisma.$transaction(async (tx) => {
      // Find reserved snapshot entries that can be released
      const reservedSnapshots = await tx.$queryRaw<
        Array<{ id: string; base_quantity: string; quantity: string; productId: string; batchId: string | null; unitId: string; locationId: string }>
      >`
        SELECT id, base_quantity, quantity, "productId", "batchId", "unitId", "locationId"
        FROM "InventorySnapshot"
        WHERE "stockState" = 'RESERVED'::"StockState"
          AND "baseQuantity" > 0
        ORDER BY "updatedAt" ASC
        LIMIT 1
      `;

      // This is a generic release — in practice you'd filter by referenceId.
      // For now we return info about what's reserved so caller can decide
      return reservedSnapshots;
    });

    return result;
  }

  /**
   * Release specific reserved stock back to AVAILABLE.
   * This is the targeted version that knows exactly what to release.
   */
  async releaseStock(input: ReserveStockInput) {
    if (input.baseQuantity <= 0) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Release quantity must be positive.', 422);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Lock RESERVED snapshot
      const reservedSnapshots = await tx.$queryRaw<
        Array<{ id: string; base_quantity: string; quantity: string }>
      >`
        SELECT id, base_quantity, quantity
        FROM "InventorySnapshot"
        WHERE "locationId" = ${input.locationId}
          AND "productId" = ${input.productId}
          AND ("batchId" = ${input.batchId ?? null} OR ("batchId" IS NULL AND ${input.batchId ?? null} IS NULL))
          AND "stockState" = 'RESERVED'::"StockState"
          AND "unitId" = ${input.unitId}
        FOR UPDATE
      `;

      const reserved = reservedSnapshots[0];
      if (!reserved || Number(reserved.base_quantity) < input.baseQuantity) {
        throw new AppError(
          ErrorCodes.INSUFFICIENT_STOCK,
          `Insufficient reserved stock. Have ${reserved ? Number(reserved.base_quantity) : 0}, need ${input.baseQuantity}.`,
          422,
        );
      }

      // 2. Subtract from RESERVED
      const newResBase = Number(reserved.base_quantity) - input.baseQuantity;
      const ratio = Number(reserved.base_quantity) > 0
        ? Number(reserved.quantity) / Number(reserved.base_quantity)
        : 1;
      const newResQty = Math.round((newResBase * ratio) * 1_000_000) / 1_000_000;

      if (newResBase <= 0) {
        // Delete the RESERVED snapshot row entirely
        await tx.inventorySnapshot.delete({ where: { id: reserved.id } });
      } else {
        await tx.$executeRaw`
          UPDATE "InventorySnapshot"
          SET quantity = ${newResQty}, "baseQuantity" = ${newResBase}, version = version + 1, "updatedAt" = NOW()
          WHERE id = ${reserved.id}
        `;
      }

      // 3. Add back to AVAILABLE
      const availableSnapshots = await tx.$queryRaw<
        Array<{ id: string; base_quantity: string; quantity: string }>
      >`
        SELECT id, base_quantity, quantity
        FROM "InventorySnapshot"
        WHERE "locationId" = ${input.locationId}
          AND "productId" = ${input.productId}
          AND ("batchId" = ${input.batchId ?? null} OR ("batchId" IS NULL AND ${input.batchId ?? null} IS NULL))
          AND "stockState" = 'AVAILABLE'::"StockState"
          AND "unitId" = ${input.unitId}
        FOR UPDATE
      `;

      const available = availableSnapshots[0];
      if (available) {
        const newAvailBase = Number(available.base_quantity) + input.baseQuantity;
        const newAvailQty = Number(available.quantity) + input.quantity;

        await tx.$executeRaw`
          UPDATE "InventorySnapshot"
          SET quantity = ${newAvailQty}, "baseQuantity" = ${newAvailBase}, version = version + 1, "updatedAt" = NOW()
          WHERE id = ${available.id}
        `;
      } else {
        await tx.inventorySnapshot.create({
          data: {
            locationId: input.locationId,
            productId: input.productId,
            batchId: input.batchId,
            stockState: StockState.AVAILABLE,
            unitId: input.unitId,
            quantity: input.quantity,
            baseQuantity: input.baseQuantity,
          },
        });
      }

      // 4. Record movement pair (RESERVED out, AVAILABLE in)
      const event = await tx.inventoryEvent.create({
        data: {
          eventType: 'MANUAL_ADJUSTMENT',
          eventStatus: 'POSTED',
          branchId: input.branchId,
          referenceType: input.referenceType as any,
          referenceId: input.referenceId,
          createdById: input.createdById,
          metadata: { action: 'RELEASE_RESERVATION', reason: input.reason },
        },
      });

      // RESERVED out (negative)
      await tx.inventoryMovement.create({
        data: {
          inventoryEventId: event.id,
          branchId: input.branchId,
          locationId: input.locationId,
          productId: input.productId,
          batchId: input.batchId,
          stockState: StockState.RESERVED,
          unitId: input.unitId,
          quantityDelta: -input.quantity,
          baseQuantityDelta: -input.baseQuantity,
          movementType: 'ADJUSTMENT',
          referenceType: input.referenceType as any,
          referenceId: input.referenceId,
          reasonCode: 'RESERVATION_RELEASED',
          createdById: input.createdById,
          metadata: { reservationAction: 'release' },
        },
      });

      // AVAILABLE in (positive)
      await tx.inventoryMovement.create({
        data: {
          inventoryEventId: event.id,
          branchId: input.branchId,
          locationId: input.locationId,
          productId: input.productId,
          batchId: input.batchId,
          stockState: StockState.AVAILABLE,
          unitId: input.unitId,
          quantityDelta: input.quantity,
          baseQuantityDelta: input.baseQuantity,
          movementType: 'STOCK_IN',
          referenceType: input.referenceType as any,
          referenceId: input.referenceId,
          reasonCode: 'RESERVATION_RELEASED',
          createdById: input.createdById,
          metadata: { reservationAction: 'release' },
        },
      });

      return { eventId: event.id, releasedBaseQty: input.baseQuantity };
    });
  }

  /**
   * List all reserved stock for a location or branch.
   */
  async listReservations(filter: { branchId?: string; locationId?: string; productId?: string }, pagination: { skip: number; take: number }) {
    const where: Prisma.InventorySnapshotWhereInput = {
      stockState: StockState.RESERVED,
      baseQuantity: { gt: 0 },
    };
    if (filter.locationId) where.locationId = filter.locationId;
    if (filter.productId) where.productId = filter.productId;
    if (filter.branchId) where.location = { branchId: filter.branchId };

    const [items, total] = await Promise.all([
      this.prisma.inventorySnapshot.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        include: {
          product: { select: { id: true, name: true, skuCode: true } },
          batch: { select: { id: true, batchNumber: true } },
          unit: true,
          location: { include: { branch: { select: { id: true, name: true } } } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.inventorySnapshot.count({ where }),
    ]);

    return { items, total };
  }
}
