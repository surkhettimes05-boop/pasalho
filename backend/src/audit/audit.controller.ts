import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { AuditAction, ReferenceType } from '@prisma/client';

@ApiTags('audit-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('audit_logs.view')
  @ApiOperation({ summary: 'List audit logs' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'actorUserId', required: false })
  @ApiQuery({ name: 'action', required: false, enum: AuditAction })
  @ApiQuery({ name: 'entityType', required: false, enum: ReferenceType })
  async list(
    @Query() pagination: PaginationDto,
    @Query('branchId') branchId?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('action') action?: AuditAction,
    @Query('entityType') entityType?: ReferenceType,
  ) {
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (actorUserId) where.actorUserId = actorUserId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: { actor: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  @Get('entity/:entityType/:entityId')
  @RequirePermissions('audit_logs.view')
  @ApiOperation({ summary: 'Get audit logs for a specific entity' })
  async getForEntity(
    @Param('entityType') entityType: ReferenceType,
    @Param('entityId') entityId: string,
    @Query() pagination: PaginationDto,
  ) {
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { entityType, entityId },
        skip: pagination.skip,
        take: pagination.limit,
        include: { actor: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where: { entityType, entityId } }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }
}
