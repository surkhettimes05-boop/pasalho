import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { NotificationType, NotificationStatus } from '@prisma/client';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string, pagination: PaginationDto, status?: NotificationStatus) {
    const where: any = {
      OR: [{ userId }, { userId: null }],
    };
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    const unreadCount = await this.prisma.notification.count({
      where: { OR: [{ userId }, { userId: null }], status: 'UNREAD' },
    });

    return { items, total, page: pagination.page, limit: pagination.limit, unreadCount };
  }

  async listForBranch(branchId: string, pagination: PaginationDto) {
    const where: any = { branchId };

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async markRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, status: NotificationStatus.UNREAD },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
    return { success: true };
  }

  async create(input: {
    branchId?: string;
    userId?: string;
    type: NotificationType;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
    metadata?: any;
  }) {
    return this.prisma.notification.create({
      data: {
        branchId: input.branchId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        entityType: input.entityType as any,
        entityId: input.entityId,
        metadata: input.metadata,
      },
    });
  }

  /**
   * Scan for low-stock situations and emit notifications for any
   * products whose available base quantity has dropped below the threshold.
   * Called periodically (e.g. from a cron job or on-demand).
   */
  async generateLowStockAlerts(threshold = 10) {
    const lowStockSnapshots = await this.prisma.inventorySnapshot.findMany({
      where: {
        stockState: 'AVAILABLE',
        baseQuantity: { gt: 0, lt: threshold },
      },
      include: {
        product: { select: { id: true, name: true, skuCode: true } },
        location: { include: { branch: { select: { id: true, name: true } } } },
      },
      take: 200,
    });

    let created = 0;
    for (const snap of lowStockSnapshots) {
      // Avoid duplicate alerts: check if an UNREAD low-stock notification already exists for this product+location
      const existing = await this.prisma.notification.findFirst({
        where: {
          type: 'LOW_STOCK',
          status: 'UNREAD',
          entityType: 'PRODUCT',
          entityId: snap.productId,
          branchId: snap.location.branchId,
        },
      });
      if (existing) continue;

      await this.create({
        branchId: snap.location.branchId,
        type: NotificationType.LOW_STOCK,
        title: `Low Stock: ${snap.product.name}`,
        message: `${snap.product.name} (${snap.product.skuCode}) has only ${Number(snap.baseQuantity).toFixed(0)} units left at ${snap.location.branch?.name ?? 'unknown location'}.`,
        entityType: 'PRODUCT',
        entityId: snap.productId,
        metadata: {
          productId: snap.productId,
          locationId: snap.locationId,
          baseQuantity: Number(snap.baseQuantity),
          threshold,
        },
      });
      created++;
    }

    // Also check out-of-stock
    const outOfStockSnapshots = await this.prisma.inventorySnapshot.findMany({
      where: {
        stockState: 'AVAILABLE',
        baseQuantity: { lte: 0 },
      },
      include: {
        product: { select: { id: true, name: true, skuCode: true } },
        location: { include: { branch: { select: { id: true, name: true } } } },
      },
      take: 200,
    });

    for (const snap of outOfStockSnapshots) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          type: 'OUT_OF_STOCK',
          status: 'UNREAD',
          entityType: 'PRODUCT',
          entityId: snap.productId,
          branchId: snap.location.branchId,
        },
      });
      if (existing) continue;

      await this.create({
        branchId: snap.location.branchId,
        type: NotificationType.OUT_OF_STOCK,
        title: `Out of Stock: ${snap.product.name}`,
        message: `${snap.product.name} (${snap.product.skuCode}) is out of stock at ${snap.location.branch?.name ?? 'unknown location'}.`,
        entityType: 'PRODUCT',
        entityId: snap.productId,
        metadata: { productId: snap.productId, locationId: snap.locationId },
      });
      created++;
    }

    return { created };
  }
}
