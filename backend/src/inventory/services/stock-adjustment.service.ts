import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { CreateStockAdjustmentDto } from '../dto/create-stock-adjustment.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';

@Injectable()
export class StockAdjustmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: InventoryLedgerService,
    private readonly audit: AuditLogService,
  ) {}

  async list(pagination: PaginationDto, branchId?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;

    const [items, total] = await Promise.all([
      this.prisma.stockAdjustment.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: { branch: true, warehouse: true, createdBy: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockAdjustment.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async findById(id: string) {
    const adj = await this.prisma.stockAdjustment.findUnique({
      where: { id },
      include: {
        items: { include: { product: true, batch: true, unit: true } },
        branch: true,
        warehouse: true,
        location: true,
        createdBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
      },
    });
    if (!adj) throw new AppError(ErrorCodes.NOT_FOUND, 'Stock adjustment not found.', 404);
    return adj;
  }

  async create(dto: CreateStockAdjustmentDto, actorUserId: string) {
    const adjustmentNo = `ADJ-${Date.now()}`;

    const adj = await this.prisma.$transaction(async (tx) => {
      const adjustment = await tx.stockAdjustment.create({
        data: {
          adjustmentNo,
          branchId: dto.branchId,
          warehouseId: dto.warehouseId,
          locationId: dto.locationId,
          reason: dto.reason,
          notes: dto.notes,
          createdById: actorUserId,
        },
      });

      for (const item of dto.items) {
        await tx.stockAdjustmentItem.create({
          data: {
            stockAdjustmentId: adjustment.id,
            productId: item.productId,
            batchId: item.batchId,
            unitId: item.unitId,
            stockState: item.stockState ?? 'AVAILABLE',
            quantityDelta: item.quantityDelta,
            baseQuantityDelta: item.baseQuantityDelta,
            reasonCode: item.reasonCode,
            notes: item.notes,
          },
        });
      }

      return adjustment;
    });

    await this.audit.record({
      actorUserId,
      action: 'STOCK_ADJUSTMENT_CREATED',
      entityType: 'STOCK_ADJUSTMENT',
      entityId: adj.id,
      branchId: dto.branchId,
      afterData: { adjustmentNo: adj.adjustmentNo, reason: dto.reason },
    });

    return this.findById(adj.id);
  }

  async submit(id: string, actorUserId: string) {
    const adj = await this.findById(id);
    if (adj.status !== 'DRAFT') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Only DRAFT adjustments can be submitted.', 422);
    }

    const updated = await this.prisma.stockAdjustment.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedById: actorUserId, submittedAt: new Date() },
    });

    await this.audit.record({
      actorUserId,
      action: 'STOCK_ADJUSTMENT_SUBMITTED',
      entityType: 'STOCK_ADJUSTMENT',
      entityId: id,
      branchId: adj.branchId,
    });

    return updated;
  }

  async approve(id: string, actorUserId: string) {
    const adj = await this.findById(id);
    if (adj.status !== 'SUBMITTED') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Only SUBMITTED adjustments can be approved.', 422);
    }

    const updated = await this.prisma.stockAdjustment.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: actorUserId, approvedAt: new Date() },
    });

    await this.audit.record({
      actorUserId,
      action: 'STOCK_ADJUSTMENT_APPROVED',
      entityType: 'STOCK_ADJUSTMENT',
      entityId: id,
      branchId: adj.branchId,
    });

    return updated;
  }

  async post(id: string, actorUserId: string) {
    const adj = await this.findById(id);
    if (adj.status !== 'APPROVED') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Only APPROVED adjustments can be posted.', 422);
    }
    if (adj.items.length === 0) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Adjustment has no items.', 422);
    }

    // Post inventory event
    await this.ledger.postEvent({
      eventType: 'STOCK_ADJUSTMENT_APPROVED',
      branchId: adj.branchId,
      referenceType: 'STOCK_ADJUSTMENT',
      referenceId: adj.id,
      createdById: actorUserId,
      approvedById: adj.approvedById ?? actorUserId,
      idempotencyKey: `adj-post-${adj.id}`,
      movements: adj.items.map((item) => ({
        locationId: adj.locationId,
        productId: item.productId,
        batchId: item.batchId ?? undefined,
        unitId: item.unitId,
        stockState: item.stockState,
        quantityDelta: Number(item.quantityDelta),
        baseQuantityDelta: Number(item.baseQuantityDelta),
        movementType: Number(item.quantityDelta) >= 0 ? 'STOCK_IN' : 'STOCK_OUT',
        reasonCode: item.reasonCode ?? undefined,
      })),
    });

    const updated = await this.prisma.stockAdjustment.update({
      where: { id },
      data: { status: 'POSTED', postedById: actorUserId, postedAt: new Date() },
    });

    await this.audit.record({
      actorUserId,
      action: 'STOCK_ADJUSTMENT_POSTED',
      entityType: 'STOCK_ADJUSTMENT',
      entityId: id,
      branchId: adj.branchId,
    });

    return updated;
  }
}
