import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';

@Injectable()
export class BranchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(pagination: PaginationDto) {
    const where = pagination.search
      ? {
          OR: [
            { name: { contains: pagination.search, mode: 'insensitive' as const } },
            { code: { contains: pagination.search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.branch.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: { warehouses: { where: { deletedAt: null } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.branch.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async findById(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: { warehouses: { where: { deletedAt: null } } },
    });
    if (!branch) throw new AppError(ErrorCodes.NOT_FOUND, 'Branch not found.', 404);
    return branch;
  }

  async create(dto: CreateBranchDto, actorUserId: string) {
    const branch = await this.prisma.branch.create({ data: dto });

    await this.audit.record({
      actorUserId,
      action: 'BRANCH_CREATED',
      entityType: 'BRANCH',
      entityId: branch.id,
      branchId: branch.id,
      afterData: { code: branch.code, name: branch.name },
    });

    return branch;
  }

  async update(id: string, dto: UpdateBranchDto, actorUserId: string) {
    const existing = await this.prisma.branch.findUnique({ where: { id } });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 'Branch not found.', 404);

    const updated = await this.prisma.branch.update({ where: { id }, data: dto });

    const action = dto.status === 'INACTIVE' ? 'BRANCH_DEACTIVATED' : 'BRANCH_UPDATED';
    await this.audit.record({
      actorUserId,
      action,
      entityType: 'BRANCH',
      entityId: id,
      branchId: id,
      beforeData: { name: existing.name, status: existing.status },
      afterData: { name: updated.name, status: updated.status },
    });

    return updated;
  }

  async deactivate(id: string, actorUserId: string) {
    const existing = await this.prisma.branch.findUnique({ where: { id } });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 'Branch not found.', 404);

    const updated = await this.prisma.branch.update({
      where: { id },
      data: { status: 'INACTIVE', deletedAt: new Date() },
    });

    await this.audit.record({
      actorUserId,
      action: 'BRANCH_DEACTIVATED',
      entityType: 'BRANCH',
      entityId: id,
      branchId: id,
      beforeData: { name: existing.name, status: existing.status },
      afterData: { name: updated.name, status: updated.status },
    });

    return updated;
  }
}
