import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class ExpiryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Scan all batches that are within daysAhead of expiry (or already expired).
   * Creates ExpiryEvent records for each unique batch+location combination.
   * Skips batches already flagged with an un-acted-upon event.
   * Returns counts of newly detected + already expired batches auto-blocked.
   */
  async scanExpiringBatches(daysAhead = 60): Promise<{ detected: number; autoBlocked: number }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);

    // Find all active batches expiring within window
    const expiringBatches = await this.prisma.batch.findMany({
      where: {
        status: { in: ['ACTIVE'] },
        expiryDate: { not: null, lte: cutoff },
      },
      include: {
        product: { select: { id: true, name: true, skuCode: true } },
        snapshots: {
          where: { stockState: 'AVAILABLE', baseQuantity: { gt: 0 } },
          include: { location: { include: { branch: { select: { id: true, name: true } } } } },
        },
      },
    });

    let detected = 0;
    let autoBlocked = 0;
    const now = new Date();

    for (const batch of expiringBatches) {
      const expiryDate = batch.expiryDate!;
      const msLeft = expiryDate.getTime() - now.getTime();
      const daysToExpiry = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
      const isExpired = daysToExpiry <= 0;

      for (const snap of batch.snapshots) {
        // Check if already flagged
        const existing = await this.prisma.expiryEvent.findFirst({
          where: {
            batchId: batch.id,
            locationId: snap.locationId,
            isActedUpon: false,
          },
        });
        if (existing) continue;

        await this.prisma.expiryEvent.create({
          data: {
            branchId: snap.location.branchId,
            batchId: batch.id,
            productId: batch.productId,
            locationId: snap.locationId,
            expiryDate,
            daysToExpiry,
          },
        });
        detected++;

        // Auto-block batches that are already expired
        if (isExpired) {
          await this.prisma.batch.update({
            where: { id: batch.id },
            data: { status: 'EXPIRED' },
          });
          await this.audit.record({
            actorUserId: 'system',
            action: 'BATCH_EXPIRED',
            entityType: 'BATCH',
            entityId: batch.id,
            branchId: snap.location.branchId,
            afterData: { batchNumber: batch.batchNumber, expiryDate, productName: batch.product.name },
          });
          autoBlocked++;
        }
      }
    }

    return { detected, autoBlocked };
  }

  async listExpiryEvents(
    pagination: PaginationDto,
    branchId?: string,
    daysAhead?: number,
    isActedUpon?: boolean,
  ) {
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (isActedUpon !== undefined) where.isActedUpon = isActedUpon;
    if (daysAhead !== undefined) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + daysAhead);
      where.expiryDate = { lte: cutoff };
    }

    const [items, total] = await Promise.all([
      this.prisma.expiryEvent.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          branch: { select: { id: true, name: true } },
          batch: { select: { id: true, batchNumber: true, expiryDate: true, status: true } },
          product: { select: { id: true, name: true, skuCode: true } },
          location: { select: { id: true, name: true } },
        },
        orderBy: { expiryDate: 'asc' },
      }),
      this.prisma.expiryEvent.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async markActedUpon(id: string, actionNote: string) {
    return this.prisma.expiryEvent.update({
      where: { id },
      data: { isActedUpon: true, actionNote },
    });
  }

  async blockBatch(batchId: string, actorUserId: string) {
    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
      include: { product: { select: { name: true } } },
    });
    if (!batch) throw new Error('Batch not found.');

    await this.prisma.batch.update({
      where: { id: batchId },
      data: { status: 'BLOCKED' },
    });

    await this.audit.record({
      actorUserId,
      action: 'BATCH_BLOCKED',
      entityType: 'BATCH',
      entityId: batchId,
      afterData: { batchNumber: batch.batchNumber, productName: batch.product.name },
    });

    return this.prisma.batch.findUnique({ where: { id: batchId } });
  }

  /**
   * Summary for the expiry dashboard — counts by urgency band.
   */
  async getExpirySummary(branchId?: string) {
    const now = new Date();
    const in7 = new Date(); in7.setDate(in7.getDate() + 7);
    const in30 = new Date(); in30.setDate(in30.getDate() + 30);
    const in60 = new Date(); in60.setDate(in60.getDate() + 60);

    const base = branchId ? { branchId, isActedUpon: false } : { isActedUpon: false };

    const [expired, within7, within30, within60] = await Promise.all([
      this.prisma.expiryEvent.count({ where: { ...base, expiryDate: { lt: now } } }),
      this.prisma.expiryEvent.count({ where: { ...base, expiryDate: { gte: now, lte: in7 } } }),
      this.prisma.expiryEvent.count({ where: { ...base, expiryDate: { gte: in7, lte: in30 } } }),
      this.prisma.expiryEvent.count({ where: { ...base, expiryDate: { gte: in30, lte: in60 } } }),
    ]);

    return { expired, within7, within30, within60 };
  }
}
