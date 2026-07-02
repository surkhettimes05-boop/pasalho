import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';

@Injectable()
export class StoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(pagination: PaginationDto, branchId?: string) {
    const where: any = { type: 'STORE' };
    if (branchId) where.branchId = branchId;

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
        include: { branch: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.inventoryLocation.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async findById(id: string) {
    const store = await this.prisma.inventoryLocation.findFirst({
      where: { id, type: 'STORE' },
      include: { branch: true },
    });
    if (!store) throw new AppError(ErrorCodes.NOT_FOUND, 'Store not found.', 404);
    return store;
  }

  async create(dto: CreateStoreDto, actorUserId: string) {
    const store = await this.prisma.inventoryLocation.create({
      data: {
        branchId: dto.branchId,
        code: dto.code,
        name: dto.name,
        type: 'STORE',
      },
    });

    await this.audit.record({
      actorUserId,
      action: 'WAREHOUSE_UPDATED',
      entityType: 'WAREHOUSE',
      entityId: store.id,
      branchId: dto.branchId,
      afterData: { code: store.code, name: store.name, type: 'STORE' },
    });

    return store;
  }

  async update(id: string, dto: UpdateStoreDto, actorUserId: string) {
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
