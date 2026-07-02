import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { CreateDamageReportDto } from '../dto/create-damage-report.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';

@Injectable()
export class DamageReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: InventoryLedgerService,
    private readonly audit: AuditLogService,
  ) {}

  async list(pagination: PaginationDto, branchId?: string, status?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (status) where.status = status;
    if (pagination.search) {
      where.OR = [
        { reportNo: { contains: pagination.search, mode: 'insensitive' } },
        { reason: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.damageReport.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          branch: { select: { id: true, name: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, fullName: true } },
          approvedBy: { select: { id: true, fullName: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.damageReport.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async findById(id: string) {
    const report = await this.prisma.damageReport.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        location: { select: { id: true, name: true } },
        createdBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
        postedBy: { select: { id: true, fullName: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, skuCode: true } },
            batch: { select: { id: true, batchNumber: true, expiryDate: true } },
            unit: { select: { id: true, name: true, symbol: true } },
          },
        },
      },
    });
    if (!report) throw new AppError(ErrorCodes.NOT_FOUND, 'Damage report not found.', 404);
    return report;
  }

  async create(dto: CreateDamageReportDto, actorUserId: string) {
    const reportNo = `DMG-${Date.now()}`;

    const report = await this.prisma.$transaction(async (tx) => {
      const r = await tx.damageReport.create({
        data: {
          reportNo,
          branchId: dto.branchId,
          warehouseId: dto.warehouseId,
          locationId: dto.locationId,
          reason: dto.reason,
          notes: dto.notes,
          createdById: actorUserId,
        },
      });

      for (const item of dto.items) {
        await tx.damageReportItem.create({
          data: {
            damageReportId: r.id,
            productId: item.productId,
            batchId: item.batchId,
            unitId: item.unitId,
            quantity: item.quantity,
            baseQuantity: item.baseQuantity,
            damageType: item.damageType,
            notes: item.notes,
          },
        });
      }

      return r;
    });

    await this.audit.record({
      actorUserId,
      action: 'DAMAGE_REPORTED',
      entityType: 'DAMAGE_REPORT',
      entityId: report.id,
      branchId: dto.branchId,
      afterData: { reportNo, reason: dto.reason, itemCount: dto.items.length },
    });

    return this.findById(report.id);
  }

  async submit(id: string, actorUserId: string) {
    const report = await this.findById(id);
    if (report.status !== 'DRAFT') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Only DRAFT reports can be submitted.', 422);
    }

    await this.prisma.damageReport.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });

    return this.findById(id);
  }

  async approve(id: string, actorUserId: string) {
    const report = await this.findById(id);
    if (report.status !== 'SUBMITTED') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Only SUBMITTED reports can be approved.', 422);
    }

    await this.prisma.damageReport.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: actorUserId, approvedAt: new Date() },
    });

    await this.audit.record({
      actorUserId,
      action: 'DAMAGE_APPROVED',
      entityType: 'DAMAGE_REPORT',
      entityId: id,
      branchId: report.branchId,
    });

    return this.findById(id);
  }

  async reject(id: string, reason: string, actorUserId: string) {
    const report = await this.findById(id);
    if (!['SUBMITTED', 'APPROVED'].includes(report.status)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Only SUBMITTED or APPROVED reports can be rejected.', 422);
    }

    await this.prisma.damageReport.update({
      where: { id },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: reason },
    });

    return this.findById(id);
  }

  /**
   * Post the damage report: deducts stock from AVAILABLE and adds to DAMAGED state.
   * Uses idempotency key to prevent double-posting.
   */
  async post(id: string, actorUserId: string) {
    const report = await this.findById(id);
    if (report.status !== 'APPROVED') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Only APPROVED reports can be posted.', 422);
    }
    if (report.items.length === 0) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Damage report has no items.', 422);
    }

    // Deduct from AVAILABLE, credit to DAMAGED — two movements per item
    await this.ledger.postEvent({
      eventType: 'MANUAL_ADJUSTMENT',
      branchId: report.branchId,
      referenceType: 'DAMAGE_REPORT',
      referenceId: report.id,
      createdById: actorUserId,
      approvedById: report.approvedById ?? actorUserId,
      idempotencyKey: `damage-post-${report.id}`,
      movements: report.items.flatMap((item) => [
        // Deduct from AVAILABLE
        {
          locationId: report.locationId,
          productId: item.productId,
          batchId: item.batchId ?? undefined,
          unitId: item.unitId,
          stockState: 'AVAILABLE' as const,
          quantityDelta: -Number(item.quantity),
          baseQuantityDelta: -Number(item.baseQuantity),
          movementType: 'STOCK_OUT' as const,
          reasonCode: `DAMAGE_${item.damageType}`,
        },
        // Add to DAMAGED
        {
          locationId: report.locationId,
          productId: item.productId,
          batchId: item.batchId ?? undefined,
          unitId: item.unitId,
          stockState: 'DAMAGED' as const,
          quantityDelta: Number(item.quantity),
          baseQuantityDelta: Number(item.baseQuantity),
          movementType: 'STOCK_IN' as const,
          reasonCode: `DAMAGE_${item.damageType}`,
        },
      ]),
    });

    await this.prisma.damageReport.update({
      where: { id },
      data: { status: 'POSTED', postedById: actorUserId, postedAt: new Date() },
    });

    await this.audit.record({
      actorUserId,
      action: 'DAMAGE_POSTED',
      entityType: 'DAMAGE_REPORT',
      entityId: id,
      branchId: report.branchId,
      afterData: { reportNo: report.reportNo },
    });

    return this.findById(id);
  }
}
