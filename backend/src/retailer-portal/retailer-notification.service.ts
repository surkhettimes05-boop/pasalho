import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { RetailerNotificationStatus, RetailerNotificationType, ReferenceType } from '@prisma/client';

@Injectable()
export class RetailerNotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(retailerId: string, pagination: PaginationDto, status?: RetailerNotificationStatus) {
    const where: any = { retailerId };
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.retailerNotification.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.retailerNotification.count({ where }),
    ]);

    const unreadCount = await this.prisma.retailerNotification.count({
      where: { retailerId, status: 'UNREAD' },
    });

    return { items, total, page: pagination.page, limit: pagination.limit, unreadCount };
  }

  async markRead(id: string, retailerId: string) {
    return this.prisma.retailerNotification.update({
      where: { id, retailerId },
      data: { status: 'READ' as RetailerNotificationStatus, readAt: new Date() },
    });
  }

  async markAllRead(retailerId: string) {
    await this.prisma.retailerNotification.updateMany({
      where: { retailerId, status: 'UNREAD' },
      data: { status: 'READ' as RetailerNotificationStatus, readAt: new Date() },
    });
    return { success: true };
  }

  async unreadCount(retailerId: string) {
    const count = await this.prisma.retailerNotification.count({
      where: { retailerId, status: 'UNREAD' },
    });
    return { count };
  }

  async create(input: {
    retailerId: string;
    branchId?: string;
    type: RetailerNotificationType;
    title: string;
    message: string;
    entityType?: ReferenceType;
    entityId?: string;
    metadata?: any;
  }) {
    return this.prisma.retailerNotification.create({
      data: {
        retailerId: input.retailerId,
        branchId: input.branchId,
        type: input.type,
        title: input.title,
        message: input.message,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
      },
    });
  }
}
