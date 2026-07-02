import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';

@Injectable()
export class RouteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(pagination: PaginationDto, branchId?: string, salesRepId?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;
    if (salesRepId) where.salesRepId = salesRepId;
    if (pagination.search) {
      where.OR = [
        { name: { contains: pagination.search, mode: 'insensitive' } },
        { code: { contains: pagination.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.route.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          branch: { select: { id: true, name: true } },
          salesRep: { include: { user: { select: { id: true, fullName: true } } } },
          stops: { include: { retailer: { select: { id: true, shopName: true, ownerName: true, phone: true } } }, orderBy: { stopOrder: 'asc' } },
          _count: { select: { stops: true, orders: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.route.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async findById(id: string) {
    const route = await this.prisma.route.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        salesRep: { include: { user: { select: { id: true, fullName: true } } } },
        stops: {
          include: { retailer: true },
          orderBy: { stopOrder: 'asc' },
        },
        createdBy: { select: { id: true, fullName: true } },
        _count: { select: { orders: true, deliveries: true } },
      },
    });
    if (!route) throw new AppError(ErrorCodes.NOT_FOUND, 'Route not found.', 404);
    return route;
  }

  async create(dto: CreateRouteDto, actorUserId: string) {
    const route = await this.prisma.$transaction(async (tx) => {
      const r = await tx.route.create({
        data: {
          branchId: dto.branchId,
          salesRepId: dto.salesRepId,
          code: dto.code,
          name: dto.name,
          description: dto.description,
          createdById: actorUserId,
        },
      });

      if (dto.stops?.length) {
        await tx.routeStop.createMany({
          data: dto.stops.map((s) => ({
            routeId: r.id,
            retailerId: s.retailerId,
            stopOrder: s.stopOrder,
            notes: s.notes,
          })),
        });
      }

      return r;
    });

    await this.audit.record({
      actorUserId,
      action: 'ROUTE_CREATED',
      entityType: 'ROUTE',
      entityId: route.id,
      branchId: dto.branchId,
      afterData: { code: dto.code, name: dto.name },
    });

    return this.findById(route.id);
  }

  async update(id: string, dto: UpdateRouteDto, actorUserId: string) {
    const existing = await this.findById(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.route.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          salesRepId: dto.salesRepId,
          status: dto.status,
        },
      });

      // If stops provided, replace all stops
      if (dto.stops !== undefined) {
        await tx.routeStop.deleteMany({ where: { routeId: id } });
        if (dto.stops.length) {
          await tx.routeStop.createMany({
            data: dto.stops.map((s) => ({
              routeId: id,
              retailerId: s.retailerId,
              stopOrder: s.stopOrder,
              notes: s.notes,
            })),
          });
        }
      }
    });

    await this.audit.record({
      actorUserId,
      action: 'ROUTE_UPDATED',
      entityType: 'ROUTE',
      entityId: id,
      branchId: existing.branchId,
      beforeData: { name: existing.name, status: existing.status },
      afterData: { name: dto.name, status: dto.status },
    });

    return this.findById(id);
  }

  async deactivate(id: string, actorUserId: string) {
    const existing = await this.findById(id);
    const updated = await this.prisma.route.update({
      where: { id },
      data: { status: 'INACTIVE', deletedAt: new Date() },
    });

    await this.audit.record({
      actorUserId,
      action: 'ROUTE_UPDATED',
      entityType: 'ROUTE',
      entityId: id,
      branchId: existing.branchId,
      afterData: { status: 'INACTIVE' },
    });

    return updated;
  }
}
