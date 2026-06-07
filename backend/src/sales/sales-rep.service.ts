import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateSalesRepDto } from './dto/create-sales-rep.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';
import { SalesRepStatus } from '@prisma/client';

@Injectable()
export class SalesRepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(pagination: PaginationDto, branchId?: string) {
    const where: any = { deletedAt: null };
    if (branchId) where.branchId = branchId;

    const [items, total] = await Promise.all([
      this.prisma.salesRep.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: { user: { select: { id: true, fullName: true, email: true } }, branch: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.salesRep.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async findById(id: string) {
    const rep = await this.prisma.salesRep.findFirst({
      where: { id, deletedAt: null },
      include: { user: { select: { id: true, fullName: true, email: true } }, branch: true },
    });
    if (!rep) throw new AppError(ErrorCodes.NOT_FOUND, 'Sales rep not found.', 404);
    return rep;
  }

  async create(dto: CreateSalesRepDto, actorUserId: string) {
    const rep = await this.prisma.salesRep.create({
      data: { ...dto, createdById: actorUserId },
    });

    await this.audit.record({
      actorUserId,
      action: 'SALES_REP_CREATED',
      entityType: 'SALES_REP',
      entityId: rep.id,
      branchId: dto.branchId,
      afterData: { employeeCode: rep.employeeCode },
    });

    return this.findById(rep.id);
  }

  async update(id: string, dto: { status?: SalesRepStatus }, actorUserId: string) {
    const existing = await this.findById(id);
    const updated = await this.prisma.salesRep.update({ where: { id }, data: dto });

    await this.audit.record({
      actorUserId,
      action: 'SALES_REP_UPDATED',
      entityType: 'SALES_REP',
      entityId: id,
      branchId: existing.branchId,
      beforeData: { status: existing.status },
      afterData: dto,
    });

    return updated;
  }
}
