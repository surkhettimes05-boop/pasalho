import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';

@Injectable()
export class LocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(pagination: PaginationDto, filter: { branchId?: string; warehouseId?: string; type?: string }) {
    const where: any = {};
    if (filter.branchId) where.branchId = filter.branchId;
    if (filter.warehouseId) where.warehouseId = filter.warehouseId;
    if (filter.type) where.type = filter.type;

    if (pagination.search) {
      where.OR = [
        { name: { contains: pagination.search, mode: 'insensitive' } },
        { code: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.inventoryLocation.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: { branch: true, warehouse: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.inventoryLocation.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async findById(id: string) {
    const location = await this.prisma.inventoryLocation.findUnique({
      where: { id },
      include: { branch: true, warehouse: true },
    });
    if (!location) throw new AppError(ErrorCodes.NOT_FOUND, 'Location not found.', 404);
    return location;
  }

  async create(dto: CreateLocationDto, actorUserId: string) {
    const location = await this.prisma.inventoryLocation.create({
      data: {
        branchId: dto.branchId,
        warehouseId: dto.warehouseId,
        code: dto.code,
        name: dto.name,
        type: dto.type || 'WAREHOUSE',
      },
    });

    await this.audit.record({
      actorUserId,
      action: 'WAREHOUSE_UPDATED', // Reusing action for simplicity or should add LOCATION_CREATED?
      entityType: 'WAREHOUSE', // Closest match in ReferenceType
      entityId: location.id,
      branchId: dto.branchId,
      afterData: { code: location.code, name: location.name, type: location.type },
    });

    return location;
  }

  async update(id: string, dto: UpdateLocationDto, actorUserId: string) {
    const existing = await this.findById(id);

    const updated = await this.prisma.inventoryLocation.update({
      where: { id },
      data: dto,
    });

    await this.audit.record({
      actorUserId,
      action: 'WAREHOUSE_UPDATED',
      entityType: 'WAREHOUSE',
      entityId: id,
      branchId: existing.branchId,
      beforeData: { name: existing.name, status: existing.status },
      afterData: { name: updated.name, status: updated.status },
    });

    return updated;
  }

  async deactivate(id: string, actorUserId: string) {
    const existing = await this.findById(id);

    const updated = await this.prisma.inventoryLocation.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });

    await this.audit.record({
      actorUserId,
      action: 'WAREHOUSE_DEACTIVATED',
      entityType: 'WAREHOUSE',
      entityId: id,
      branchId: existing.branchId,
    });

    return updated;
  }
}
