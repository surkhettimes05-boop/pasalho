import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(pagination: PaginationDto) {
    const where = pagination.search
      ? {
          OR: [
            { fullName: { contains: pagination.search, mode: 'insensitive' as const } },
            { email: { contains: pagination.search, mode: 'insensitive' as const } },
            { phone: { contains: pagination.search, mode: 'insensitive' as const } },
          ],
          deletedAt: null,
        }
      : { deletedAt: null };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, fullName: true, email: true, phone: true,
          status: true, defaultBranchId: true, lastLoginAt: true, createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        userRoles: {
          include: { role: true, branch: true, warehouse: true },
        },
        defaultBranch: true,
      },
    });
    if (!user) throw new AppError(ErrorCodes.NOT_FOUND, 'User not found.', 404);

    const { passwordHash: _, ...safe } = user;
    return safe;
  }

  async create(dto: CreateUserDto, actorUserId: string) {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        status: 'ACTIVE',
        defaultBranchId: dto.defaultBranchId,
      },
    });

    await this.audit.record({
      actorUserId,
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: user.id,
      afterData: { email: user.email, fullName: user.fullName },
    });

    const { passwordHash: _, ...safe } = user;
    return safe;
  }

  async update(id: string, dto: UpdateUserDto, actorUserId: string) {
    const existing = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new AppError(ErrorCodes.NOT_FOUND, 'User not found.', 404);

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.fullName && { fullName: dto.fullName }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.status && { status: dto.status }),
        ...(dto.defaultBranchId !== undefined && { defaultBranchId: dto.defaultBranchId }),
      },
    });

    await this.audit.record({
      actorUserId,
      action: 'USER_UPDATED',
      entityType: 'USER',
      entityId: id,
      beforeData: { status: existing.status, fullName: existing.fullName },
      afterData: { status: updated.status, fullName: updated.fullName },
    });

    const { passwordHash: _, ...safe } = updated;
    return safe;
  }

  async assignRole(userId: string, dto: AssignRoleDto, actorUserId: string) {
    // Check user exists
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new AppError(ErrorCodes.NOT_FOUND, 'User not found.', 404);

    const userRole = await this.prisma.userRole.create({
      data: {
        userId,
        roleId: dto.roleId,
        branchId: dto.branchId,
        warehouseId: dto.warehouseId,
      },
      include: { role: true },
    });

    await this.audit.record({
      actorUserId,
      action: 'ROLE_ASSIGNED',
      entityType: 'USER',
      entityId: userId,
      afterData: { roleCode: userRole.role.code, branchId: dto.branchId },
    });

    return userRole;
  }

  async removeRole(userId: string, userRoleId: string) {
    await this.prisma.userRole.delete({ where: { id: userRoleId } });
  }
}
