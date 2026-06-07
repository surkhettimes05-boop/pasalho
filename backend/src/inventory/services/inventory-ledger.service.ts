import { Injectable } from '@nestjs/common';
import {
  InventoryEventStatus,
  InventoryEventType,
  InventoryMovementType,
  Prisma,
  ReferenceType,
  StockState,
} from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { PrismaService } from '../../database/prisma.service';

export interface PostEventInput {
  eventType: InventoryEventType;
  branchId: string;
  referenceType: ReferenceType;
  referenceId: string;
  createdById: string;
  approvedById?: string;
  idempotencyKey?: string;
  reversalOfEventId?: string;
  metadata?: Prisma.InputJsonValue;
  movements: MovementInput[];
}

export interface MovementInput {
  locationId: string;
  productId: string;
  batchId?: string;
  unitId: string;
  stockState: StockState;
  quantityDelta: number;
  baseQuantityDelta: number;
  movementType: InventoryMovementType;
  reasonCode?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class InventoryLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pure static helper used by unit tests.
   * Throws if applying the delta would push the base quantity below zero.
   */
  static assertSnapshotWillNotGoNegative(currentBase: number, delta: number): void {
    if (currentBase + delta < 0) {
      throw new AppError(ErrorCodes.INSUFFICIENT_STOCK, 'Insufficient stock', 422);
    }
  }

  static calculateNextBaseQuantity(current: number, delta: number): number {
    return current + delta;
  }

  static assertBatchRequirements(isBatchTracked: boolean, batchId: string | undefined): void {
    if (isBatchTracked && !batchId) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Batch is required for this product', 422);
    }
  }

  /**
   * Posts an inventory event with one or more movements inside a single transaction.
   * Snapshots are upserted and locked with SELECT FOR UPDATE to prevent race conditions.
   */
  async postEvent(input: PostEventInput): Promise<{ eventId: string }> {
    // Idempotency: return existing result if already processed
    if (input.idempotencyKey) {
      const existing = await this.prisma.inventoryEvent.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return { eventId: existing.id };
    }

    const eventId = await this.prisma.$transaction(async (tx) => {
      const event = await tx.inventoryEvent.create({
        data: {
          eventType: input.eventType,
          eventStatus: InventoryEventStatus.POSTED,
          branchId: input.branchId,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          createdById: input.createdById,
          approvedById: input.approvedById,
          idempotencyKey: input.idempotencyKey,
          reversalOfEventId: input.reversalOfEventId,
          metadata: input.metadata,
        },
      });

      for (const m of input.movements) {
        await this.applyMovementWithinTransaction(
          tx,
          event.id,
          input.branchId,
          input.createdById,
          m,
          input.referenceType,
          input.referenceId,
        );
      }

      return event.id;
    });

    return { eventId };
  }

  private async applyMovementWithinTransaction(
    tx: Prisma.TransactionClient,
    inventoryEventId: string,
    branchId: string,
    createdById: string,
    m: MovementInput,
    referenceType: ReferenceType,
    referenceId: string,
  ) {
    // Create movement record
    const movement = await tx.inventoryMovement.create({
      data: {
        inventoryEventId,
        branchId,
        locationId: m.locationId,
        productId: m.productId,
        batchId: m.batchId,
        unitId: m.unitId,
        stockState: m.stockState,
        quantityDelta: m.quantityDelta,
        baseQuantityDelta: m.baseQuantityDelta,
        movementType: m.movementType,
        referenceType,
        referenceId,
        reasonCode: m.reasonCode,
        createdById,
        metadata: m.metadata,
      },
    });

    // Upsert snapshot (SELECT FOR UPDATE via raw SQL for locking)
    // First, check if snapshot exists
    const snapshots = await tx.$queryRaw<Array<{ id: string; base_quantity: string; quantity: string; version: number }>>`
      SELECT id, base_quantity, quantity, version
      FROM "InventorySnapshot"
      WHERE "locationId" = ${m.locationId}
        AND "productId" = ${m.productId}
        AND ("batchId" = ${m.batchId ?? null} OR ("batchId" IS NULL AND ${m.batchId ?? null} IS NULL))
        AND "stockState" = ${m.stockState}::"StockState"
        AND "unitId" = ${m.unitId}
      FOR UPDATE
    `;

    const snapshot = snapshots[0];

    if (snapshot) {
      const newBaseQty = Number(snapshot.base_quantity) + m.baseQuantityDelta;
      const newQty = Number(snapshot.quantity) + m.quantityDelta;

      // Prevent negative stock for outbound movements
      if (newBaseQty < 0) {
        throw new AppError(ErrorCodes.INSUFFICIENT_STOCK, 'Insufficient stock for this operation.', 422);
      }

      await tx.$executeRaw`
        UPDATE "InventorySnapshot"
        SET
          quantity = ${newQty},
          "baseQuantity" = ${newBaseQty},
          version = version + 1,
          "lastMovementId" = ${movement.id},
          "lastMovementAt" = NOW(),
          "updatedAt" = NOW()
        WHERE id = ${snapshot.id}
      `;
    } else {
      // Only allow creating a new snapshot if the delta is positive (stock in)
      if (m.baseQuantityDelta < 0) {
        throw new AppError(ErrorCodes.INSUFFICIENT_STOCK, 'Insufficient stock for this operation.', 422);
      }

      await tx.inventorySnapshot.create({
        data: {
          locationId: m.locationId,
          productId: m.productId,
          batchId: m.batchId,
          stockState: m.stockState,
          unitId: m.unitId,
          quantity: m.quantityDelta,
          baseQuantity: m.baseQuantityDelta,
          lastMovementId: movement.id,
          lastMovementAt: new Date(),
        },
      });
    }

    return movement;
  }

  async getSnapshots(
    locationId: string,
    pagination: { skip: number; take: number },
  ) {
    return this.prisma.inventorySnapshot.findMany({
      where: { locationId },
      skip: pagination.skip,
      take: pagination.take,
      include: { product: true, batch: true, unit: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getMovements(
    filters: { branchId?: string; productId?: string; locationId?: string },
    pagination: { skip: number; take: number },
  ) {
    const where: Prisma.InventoryMovementWhereInput = {};
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.productId) where.productId = filters.productId;
    if (filters.locationId) where.locationId = filters.locationId;

    return this.prisma.inventoryMovement.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      include: { product: true, batch: true, unit: true, location: true, inventoryEvent: true },
      orderBy: { occurredAt: 'desc' },
    });
  }

  async validateAndLockStock(
    tx: Prisma.TransactionClient,
    locationId: string,
    productId: string,
    batchId: string | undefined,
    unitId: string,
    requiredBaseQty: number,
  ) {
    const snapshots = await tx.$queryRaw<Array<{ id: string; base_quantity: string }>>`
      SELECT id, base_quantity
      FROM "InventorySnapshot"
      WHERE "locationId" = ${locationId}
        AND "productId" = ${productId}
        AND ("batchId" = ${batchId ?? null} OR ("batchId" IS NULL AND ${batchId ?? null} IS NULL))
        AND "stockState" = 'AVAILABLE'::"StockState"
        AND "unitId" = ${unitId}
      FOR UPDATE
    `;

    const snapshot = snapshots[0];
    if (!snapshot || Number(snapshot.base_quantity) < requiredBaseQty) {
      throw new AppError(ErrorCodes.INSUFFICIENT_STOCK, 'Insufficient stock.', 422);
    }

    return snapshot;
  }
}
