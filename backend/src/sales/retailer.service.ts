import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { RetailerLedgerService } from '../finance/retailer-ledger/retailer-ledger.service';
import { CreateRetailerDto } from './dto/create-retailer.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';
import { RetailerStatus } from '@prisma/client';

export class UpdateRetailerDto {
  shopName?: string;
  ownerName?: string;
  phone?: string;
  address?: string;
  creditLimit?: number;
  status?: RetailerStatus;
}

@Injectable()
export class RetailerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly ledger: RetailerLedgerService,
  ) {}

  async list(pagination: PaginationDto, branchId?: string) {
    const where: any = { deletedAt: null };
    if (branchId) where.branchId = branchId;
    if (pagination.search) {
      where.OR = [
        { shopName: { contains: pagination.search, mode: 'insensitive' } },
        { ownerName: { contains: pagination.search, mode: 'insensitive' } },
        { phone: { contains: pagination.search, mode: 'insensitive' } },
        { code: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.retailer.findMany({ where, skip: pagination.skip, take: pagination.limit, include: { branch: true }, orderBy: { shopName: 'asc' } }),
      this.prisma.retailer.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async findById(id: string) {
    const retailer = await this.prisma.retailer.findFirst({
      where: { id, deletedAt: null },
      include: { branch: true },
    });
    if (!retailer) throw new AppError(ErrorCodes.NOT_FOUND, 'Retailer not found.', 404);
    return retailer;
  }

  async create(dto: CreateRetailerDto, actorUserId: string) {
    const retailer = await this.prisma.retailer.create({
      data: { ...dto, createdById: actorUserId },
    });

    await this.audit.record({
      actorUserId,
      action: 'RETAILER_CREATED',
      entityType: 'RETAILER',
      entityId: retailer.id,
      branchId: dto.branchId,
      afterData: { code: retailer.code, shopName: retailer.shopName },
    });

    return retailer;
  }

  async update(id: string, dto: UpdateRetailerDto, actorUserId: string) {
    const existing = await this.findById(id);
    const updated = await this.prisma.retailer.update({ where: { id }, data: dto });

    await this.audit.record({
      actorUserId,
      action: 'RETAILER_UPDATED',
      entityType: 'RETAILER',
      entityId: id,
      branchId: existing.branchId,
      beforeData: { shopName: existing.shopName, status: existing.status },
      afterData: { shopName: dto.shopName, status: dto.status },
    });

    return updated;
  }

  async getLedger(id: string, pagination: PaginationDto) {
    await this.findById(id);
    return this.ledger.getLedger(id, { skip: pagination.skip, take: pagination.limit });
  }

  async getOutstanding(id: string) {
    await this.findById(id);
    const outstanding = await this.ledger.getOutstanding(id);
    return { outstanding };
  }
}
