import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { InventorySnapshotService } from './inventory-snapshot.service';
import { StockAdjustmentService } from './stock-adjustment.service';
import { CreateStockCountDto } from '../dto/create-stock-count.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';

@Injectable()
export class InventoryReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: InventoryLedgerService,
    private readonly snapshots: InventorySnapshotService,
    private readonly adjustments: StockAdjustmentService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Start a new physical stock count session.
   * Fetches all current 'AVAILABLE' snapshots for the location to use as 'systemQuantity'.
   */
  async startStockCount(dto: { branchId: string; warehouseId: string; locationId: string; actorUserId: string }) {
    // Check if there's already an active (DRAFT/SUBMITTED) count for this location
    const active = await this.prisma.stockCount.findFirst({
      where: {
        locationId: dto.locationId,
        status: { in: ['DRAFT', 'SUBMITTED'] },
      },
    });

    if (active) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'An active stock count already exists for this location.', 422);
    }

    // Get current snapshots
    const currentSnapshots = await this.prisma.inventorySnapshot.findMany({
      where: {
        locationId: dto.locationId,
        stockState: 'AVAILABLE',
        baseQuantity: { gt: 0 },
      },
    });

    const stockCount = await this.prisma.$transaction(async (tx) => {
      const count = await tx.stockCount.create({
        data: {
          branchId: dto.branchId,
          warehouseId: dto.warehouseId,
          locationId: dto.locationId,
          status: 'DRAFT',
          countedById: dto.actorUserId,
        },
      });

      for (const snap of currentSnapshots) {
        await tx.stockCountItem.create({
          data: {
            stockCountId: count.id,
            productId: snap.productId,
            batchId: snap.batchId,
            unitId: snap.unitId,
            systemQuantity: snap.quantity,
            countedQuantity: 0, // initially 0
            variance: -Number(snap.quantity), // initial variance is -total
          },
        });
      }

      return count;
    });

    return this.findById(stockCount.id);
  }

  async findById(id: string) {
    const count = await this.prisma.stockCount.findUnique({
      where: { id },
      include: {
        items: { include: { product: true, batch: true, unit: true } },
        location: true,
        countedBy: { select: { id: true, fullName: true } },
      },
    });
    if (!count) throw new AppError(ErrorCodes.NOT_FOUND, 'Stock count session not found.', 404);
    return count;
  }

  async updateCount(id: string, items: { productId: string; batchId?: string; unitId: string; countedQuantity: number }[]) {
    const count = await this.findById(id);
    if (count.status !== 'DRAFT') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Only DRAFT stock counts can be updated.', 422);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        // Find existing item in the session
        const existing = count.items.find(
          (i) =>
            i.productId === item.productId &&
            (i.batchId === (item.batchId ?? null)) &&
            i.unitId === item.unitId,
        );

        if (existing) {
          const variance = item.countedQuantity - Number(existing.systemQuantity);
          await tx.stockCountItem.update({
            where: { id: existing.id },
            data: {
              countedQuantity: item.countedQuantity,
              variance: variance,
            },
          });
        } else {
          // New item found during count that wasn't in system snapshots
          await tx.stockCountItem.create({
            data: {
              stockCountId: id,
              productId: item.productId,
              batchId: item.batchId,
              unitId: item.unitId,
              systemQuantity: 0,
              countedQuantity: item.countedQuantity,
              variance: item.countedQuantity,
            },
          });
        }
      }
    });

    return this.findById(id);
  }

  async submit(id: string) {
    const count = await this.findById(id);
    if (count.status !== 'DRAFT') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Only DRAFT stock counts can be submitted.', 422);
    }

    return this.prisma.stockCount.update({
      where: { id },
      data: { status: 'SUBMITTED', completedAt: new Date() },
    });
  }

  /**
   * Reconcile the stock count.
   * This generates a Stock Adjustment for all non-zero variances and posts it.
   */
  async reconcile(id: string, actorUserId: string) {
    const count = await this.findById(id);
    if (count.status !== 'SUBMITTED') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Only SUBMITTED stock counts can be reconciled.', 422);
    }

    // Filter items with variance
    const varianceItems = count.items.filter((it) => Number(it.variance) !== 0);

    if (varianceItems.length === 0) {
      // No variances, just close the session
      return this.prisma.stockCount.update({
        where: { id },
        data: { status: 'RECONCILED', reconciledAt: new Date() },
      });
    }

    // Create a Stock Adjustment to match the variances
    const adjustment = await this.adjustments.create({
      branchId: count.branchId,
      warehouseId: count.warehouseId,
      locationId: count.locationId,
      reason: `Reconciliation for Stock Count ${id}`,
      notes: `Automatically generated from physical count session.`,
      items: varianceItems.map((it) => ({
        productId: it.productId,
        batchId: it.batchId ?? undefined,
        unitId: it.unitId,
        stockState: 'AVAILABLE',
        quantityDelta: Number(it.variance),
        baseQuantityDelta: Number(it.variance), // Simplified: assuming base units for now or should fetch conversion?
        reasonCode: Number(it.variance) > 0 ? 'STOCK_COUNT_SURPLUS' : 'STOCK_COUNT_SHORTAGE',
      })),
    }, actorUserId);

    // Approve and post the adjustment
    await this.adjustments.submit(adjustment.id, actorUserId);
    await this.adjustments.approve(adjustment.id, actorUserId);
    await this.adjustments.post(adjustment.id, actorUserId);

    // Mark count reconciled
    const updated = await this.prisma.stockCount.update({
      where: { id },
      data: { status: 'RECONCILED', reconciledAt: new Date() },
    });

    await this.audit.record({
      actorUserId,
      action: 'STOCK_ADJUSTMENT_POSTED', // Or custom RECONCILIATION_COMPLETED
      entityType: 'WAREHOUSE',
      entityId: count.locationId,
      branchId: count.branchId,
      afterData: { stockCountId: id, adjustmentId: adjustment.id },
    });

    return updated;
  }

  async list(filter: { branchId?: string; locationId?: string }, pagination: PaginationDto) {
    const where: any = {};
    if (filter.branchId) where.branchId = filter.branchId;
    if (filter.locationId) where.locationId = filter.locationId;

    const [items, total] = await Promise.all([
      this.prisma.stockCount.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: { location: true, countedBy: { select: { id: true, fullName: true } } },
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.stockCount.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }
}
