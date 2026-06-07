import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';

@Injectable()
export class WarehouseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(pagination: PaginationDto, branchId?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (pagination.search) {
      where.OR = [
        { name: { contains: pagination.search, mode: 'insensitive' } },
        { code: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.warehouse.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: { branch: true, inventoryLocation: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.warehouse.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async findById(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: { branch: true, inventoryLocation: true },
    });
    if (!warehouse) throw new AppError(ErrorCodes.NOT_FOUND, 'Warehouse not found.', 404);
    return warehouse;
  }

  async create(dto: CreateWarehouseDto, actorUserId: string) {
    // Create warehouse and its inventory location atomically
    const warehouse = await this.prisma.$transaction(async (tx) => {
      const wh = await tx.warehouse.create({
        data: { branchId: dto.branchId, code: dto.code, name: dto.name },
      });

      await tx.inventoryLocation.create({
        data: {
          branchId: dto.branchId,
          warehouseId: wh.id,
          code: `WH-${wh.code}`,
          name: wh.name,
          type: 'WAREHOUSE',
        },
      });

      return wh;
    });

    await this.audit.record({
      actorUserId,
      action: 'WAREHOUSE_CREATED',
      entityType: 'WAREHOUSE',
      entityId: warehouse.id,
      branchId: dto.branchId,
      afterData: { code: warehouse.code, name: warehouse.name },
    });

    return this.findById(warehouse.id);
  }

  async update(id: string, dto: UpdateWarehouseDto, actorUserId: string) {
    const existing = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 'Warehouse not found.', 404);

    const updated = await this.prisma.warehouse.update({ where: { id }, data: dto });

    // Sync name to inventory location if name changed
    if (dto.name) {
      await this.prisma.inventoryLocation.updateMany({
        where: { warehouseId: id },
        data: { name: dto.name },
      });
    }

    const action = dto.status === 'INACTIVE' ? 'WAREHOUSE_DEACTIVATED' : 'WAREHOUSE_UPDATED';
    await this.audit.record({
      actorUserId,
      action,
      entityType: 'WAREHOUSE',
      entityId: id,
      branchId: existing.branchId,
      beforeData: { name: existing.name, status: existing.status },
      afterData: { name: updated.name, status: updated.status },
    });

    return updated;
  }

  async deactivate(id: string, actorUserId: string) {
    const existing = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 'Warehouse not found.', 404);

    const updated = await this.prisma.warehouse.update({
      where: { id },
      data: { status: 'INACTIVE', deletedAt: new Date() },
    });

    await this.audit.record({
      actorUserId,
      action: 'WAREHOUSE_DEACTIVATED',
      entityType: 'WAREHOUSE',
      entityId: id,
      branchId: existing.branchId,
      beforeData: { name: existing.name, status: existing.status },
      afterData: { name: updated.name, status: updated.status },
    });

    return updated;
  }

  async getInventory(id: string, pagination: PaginationDto) {
    const warehouse = await this.findById(id);
    if (!warehouse.inventoryLocation) {
      return { items: [], total: 0 };
    }

    const [items, total] = await Promise.all([
      this.prisma.inventorySnapshot.findMany({
        where: { locationId: warehouse.inventoryLocation.id },
        skip: pagination.skip,
        take: pagination.limit,
        include: { product: true, batch: true, unit: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.inventorySnapshot.count({ where: { locationId: warehouse.inventoryLocation.id } }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }
}
