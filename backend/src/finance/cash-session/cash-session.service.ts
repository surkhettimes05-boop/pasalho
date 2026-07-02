import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma, CashSessionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { AuditAction, ReferenceType } from '@prisma/client';

@Injectable()
export class CashSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditLogService,
  ) {}

  async openSession(options: {
    branchId: string;
    openedById: string;
    openingBalance: number;
    notes?: string;
  }) {
    // Check if there's already an open session for this branch
    const existingOpen = await this.prisma.cashSession.findFirst({
      where: {
        branchId: options.branchId,
        status: CashSessionStatus.OPEN,
      },
    });

    if (existingOpen) {
      throw new BadRequestException('There is already an open cash session for this branch');
    }

    const session = await this.prisma.cashSession.create({
      data: {
        branchId: options.branchId,
        openedById: options.openedById,
        openingBalance: options.openingBalance,
        status: CashSessionStatus.OPEN,
        notes: options.notes,
      },
      include: {
        branch: {
          select: { id: true, code: true, name: true },
        },
        openedBy: {
          select: { id: true, fullName: true },
        },
      },
    });

    await this.auditService.record({
      branchId: options.branchId,
      actorUserId: options.openedById,
      action: AuditAction.CASH_SESSION_OPENED,
      entityType: ReferenceType.CASH_SESSION,
      entityId: session.id,
      beforeData: null,
      afterData: { openingBalance: options.openingBalance },
      reason: options.notes || 'Cash session opened',
    });

    return session;
  }

  async closeSession(sessionId: string, options: {
    closedById: string;
    closingBalance: number;
    actualCash: number;
    notes?: string;
  }) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: sessionId },
      include: {
        branch: true,
      },
    });

    if (!session) {
      throw new BadRequestException('Cash session not found');
    }

    if (session.status !== CashSessionStatus.OPEN) {
      throw new BadRequestException('Cash session is not open');
    }

    const expectedCash = Number(session.openingBalance) + options.closingBalance;
    const variance = options.actualCash - expectedCash;

    const updated = await this.prisma.cashSession.update({
      where: { id: sessionId },
      data: {
        closedById: options.closedById,
        closedAt: new Date(),
        closingBalance: options.closingBalance,
        expectedCash,
        actualCash: options.actualCash,
        variance,
        status: CashSessionStatus.CLOSED,
        notes: options.notes,
      },
      include: {
        branch: {
          select: { id: true, code: true, name: true },
        },
        openedBy: {
          select: { id: true, fullName: true },
        },
        closedBy: {
          select: { id: true, fullName: true },
        },
      },
    });

    await this.auditService.record({
      branchId: session.branchId,
      actorUserId: options.closedById,
      action: AuditAction.CASH_SESSION_CLOSED,
      entityType: ReferenceType.CASH_SESSION,
      entityId: sessionId,
      beforeData: { openingBalance: session.openingBalance },
      afterData: {
        closingBalance: options.closingBalance,
        actualCash: options.actualCash,
        variance,
      },
      reason: options.notes || 'Cash session closed',
    });

    return updated;
  }

  async getCurrentSession(branchId: string) {
    return this.prisma.cashSession.findFirst({
      where: {
        branchId,
        status: CashSessionStatus.OPEN,
      },
      include: {
        branch: {
          select: { id: true, code: true, name: true },
        },
        openedBy: {
          select: { id: true, fullName: true },
        },
      },
    });
  }

  async getSessionHistory(branchId: string, pagination: { skip: number; take: number }) {
    const [sessions, total] = await Promise.all([
      this.prisma.cashSession.findMany({
        where: { branchId },
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { openedAt: 'desc' },
        include: {
          branch: {
            select: { id: true, code: true, name: true },
          },
          openedBy: {
            select: { id: true, fullName: true },
          },
          closedBy: {
            select: { id: true, fullName: true },
          },
        },
      }),
      this.prisma.cashSession.count({ where: { branchId } }),
    ]);

    return { sessions, total };
  }

  async getSessionById(sessionId: string) {
    return this.prisma.cashSession.findUnique({
      where: { id: sessionId },
      include: {
        branch: {
          select: { id: true, code: true, name: true },
        },
        openedBy: {
          select: { id: true, fullName: true },
        },
        closedBy: {
          select: { id: true, fullName: true },
        },
      },
    });
  }

  async getSessionVarianceReport(branchId: string, startDate?: Date, endDate?: Date) {
    const where: Prisma.CashSessionWhereInput = {
      branchId,
      status: CashSessionStatus.CLOSED,
    };

    if (startDate || endDate) {
      where.closedAt = {};
      if (startDate) {
        where.closedAt.gte = startDate;
      }
      if (endDate) {
        where.closedAt.lte = endDate;
      }
    }

    const sessions = await this.prisma.cashSession.findMany({
      where,
      orderBy: { closedAt: 'desc' },
    });

    const totalVariance = sessions.reduce((sum, s) => sum + Number(s.variance || 0), 0);
    const varianceCount = sessions.filter(s => s.variance && Math.abs(Number(s.variance)) > 0).length;
    const perfectCount = sessions.length - varianceCount;

    return {
      totalSessions: sessions.length,
      perfectCount,
      varianceCount,
      totalVariance,
      averageVariance: sessions.length > 0 ? totalVariance / sessions.length : 0,
      sessions,
    };
  }
}
