import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(pagination: PaginationDto, branchId?: string, status?: string, routeId?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (status) where.status = status;
    if (routeId) where.routeId = routeId;
    if (pagination.search) {
      where.OR = [
        { deliveryNo: { contains: pagination.search, mode: 'insensitive' } },
        { driverName: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.delivery.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          branch: { select: { id: true, name: true } },
          route: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, fullName: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.delivery.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async findById(id: string) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        route: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, fullName: true } },
        items: {
          include: {
            retailer: { select: { id: true, shopName: true, ownerName: true, phone: true, address: true } },
            invoice: { select: { id: true, invoiceNumber: true, grandTotal: true, status: true } },
          },
        },
      },
    });
    if (!delivery) throw new AppError(ErrorCodes.NOT_FOUND, 'Delivery not found.', 404);
    return delivery;
  }

  async create(dto: CreateDeliveryDto, actorUserId: string) {
    const deliveryNo = `DLV-${Date.now()}`;

    const delivery = await this.prisma.$transaction(async (tx) => {
      const d = await tx.delivery.create({
        data: {
          deliveryNo,
          branchId: dto.branchId,
          routeId: dto.routeId,
          vehicleRef: dto.vehicleRef,
          driverName: dto.driverName,
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
          notes: dto.notes,
          createdById: actorUserId,
        },
      });

      if (dto.items?.length) {
        await tx.deliveryItem.createMany({
          data: dto.items.map((item) => ({
            deliveryId: d.id,
            retailerId: item.retailerId,
            invoiceId: item.invoiceId,
            orderId: item.orderId,
            notes: item.notes,
          })),
        });
      }

      return d;
    });

    await this.audit.record({
      actorUserId,
      action: 'DELIVERY_CREATED',
      entityType: 'DELIVERY',
      entityId: delivery.id,
      branchId: dto.branchId,
      afterData: { deliveryNo },
    });

    return this.findById(delivery.id);
  }

  async update(id: string, dto: UpdateDeliveryDto, actorUserId: string) {
    const existing = await this.findById(id);

    if (['DELIVERED', 'CANCELLED'].includes(existing.status)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Cannot update a completed or cancelled delivery.', 422);
    }

    const updated = await this.prisma.delivery.update({
      where: { id },
      data: { vehicleRef: dto.vehicleRef, driverName: dto.driverName, notes: dto.notes },
    });

    await this.audit.record({
      actorUserId,
      action: 'DELIVERY_UPDATED',
      entityType: 'DELIVERY',
      entityId: id,
      branchId: existing.branchId,
      afterData: { vehicleRef: dto.vehicleRef, driverName: dto.driverName },
    });

    return this.findById(id);
  }

  async dispatch(id: string, actorUserId: string) {
    const delivery = await this.findById(id);
    if (delivery.status !== 'PENDING') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Only PENDING deliveries can be dispatched.', 422);
    }

    await this.prisma.delivery.update({
      where: { id },
      data: { status: 'IN_TRANSIT', dispatchedAt: new Date() },
    });

    await this.audit.record({
      actorUserId,
      action: 'DELIVERY_UPDATED',
      entityType: 'DELIVERY',
      entityId: id,
      branchId: delivery.branchId,
      afterData: { status: 'IN_TRANSIT' },
    });

    return this.findById(id);
  }

  async complete(id: string, actorUserId: string) {
    const delivery = await this.findById(id);
    if (delivery.status !== 'IN_TRANSIT') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Only IN_TRANSIT deliveries can be completed.', 422);
    }

    await this.prisma.delivery.update({
      where: { id },
      data: { status: 'DELIVERED', completedAt: new Date() },
    });

    await this.audit.record({
      actorUserId,
      action: 'DELIVERY_COMPLETED',
      entityType: 'DELIVERY',
      entityId: id,
      branchId: delivery.branchId,
      afterData: { status: 'DELIVERED' },
    });

    return this.findById(id);
  }

  async cancel(id: string, actorUserId: string) {
    const delivery = await this.findById(id);
    if (['DELIVERED', 'CANCELLED'].includes(delivery.status)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Delivery is already completed or cancelled.', 422);
    }

    await this.prisma.delivery.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await this.audit.record({
      actorUserId,
      action: 'DELIVERY_UPDATED',
      entityType: 'DELIVERY',
      entityId: id,
      branchId: delivery.branchId,
      afterData: { status: 'CANCELLED' },
    });

    return this.findById(id);
  }

  async markItemDelivered(deliveryId: string, itemId: string, notes: string | undefined, actorUserId: string) {
    const delivery = await this.findById(deliveryId);
    if (delivery.status !== 'IN_TRANSIT') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Delivery must be IN_TRANSIT to mark items.', 422);
    }

    const item = delivery.items.find((i) => i.id === itemId);
    if (!item) throw new AppError(ErrorCodes.NOT_FOUND, 'Delivery item not found.', 404);

    await this.prisma.deliveryItem.update({
      where: { id: itemId },
      data: { isDelivered: true, notes: notes ?? item.notes },
    });

    return this.findById(deliveryId);
  }
}
