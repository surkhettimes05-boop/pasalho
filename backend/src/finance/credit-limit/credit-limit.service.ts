import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma, CreditApprovalStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { AuditAction, ReferenceType } from '@prisma/client';

@Injectable()
export class CreditLimitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditLogService,
  ) {}

  async requestIncrease(options: {
    retailerId: string;
    branchId: string;
    requestedById: string;
    newLimit: number;
    reason: string;
  }) {
    const retailer = await this.prisma.retailer.findUnique({
      where: { id: options.retailerId },
    });

    if (!retailer) {
      throw new BadRequestException('Retailer not found');
    }

    const oldLimit = Number(retailer.creditLimit);

    if (options.newLimit <= oldLimit) {
      throw new BadRequestException('New limit must be greater than current limit');
    }

    const approval = await this.prisma.creditApproval.create({
      data: {
        retailerId: options.retailerId,
        branchId: options.branchId,
        requestedById: options.requestedById,
        oldLimit,
        newLimit: options.newLimit,
        reason: options.reason,
        status: CreditApprovalStatus.PENDING,
      },
    });

    await this.auditService.record({
      branchId: options.branchId,
      actorUserId: options.requestedById,
      action: AuditAction.CREDIT_LIMIT_REQUESTED,
      entityType: ReferenceType.CREDIT_APPROVAL,
      entityId: approval.id,
      beforeData: { oldLimit },
      afterData: { newLimit: options.newLimit },
      reason: options.reason,
    });

    return approval;
  }

  async approveRequest(approvalId: string, approvedById: string) {
    const approval = await this.prisma.creditApproval.findUnique({
      where: { id: approvalId },
      include: { retailer: true },
    });

    if (!approval) {
      throw new BadRequestException('Credit approval not found');
    }

    if (approval.status !== CreditApprovalStatus.PENDING) {
      throw new BadRequestException('Credit approval is not pending');
    }

    await this.prisma.$transaction(async (tx) => {
      // Update retailer credit limit
      await tx.retailer.update({
        where: { id: approval.retailerId },
        data: { creditLimit: approval.newLimit },
      });

      // Update approval status
      await tx.creditApproval.update({
        where: { id: approvalId },
        data: {
          status: CreditApprovalStatus.APPROVED,
          approvedById,
          approvedAt: new Date(),
        },
      });
    });

    await this.auditService.record({
      branchId: approval.branchId,
      actorUserId: approvedById,
      action: AuditAction.CREDIT_LIMIT_APPROVED,
      entityType: ReferenceType.CREDIT_APPROVAL,
      entityId: approvalId,
      beforeData: { oldLimit: approval.oldLimit },
      afterData: { newLimit: approval.newLimit },
      reason: 'Credit limit increase approved',
    });

    return this.prisma.creditApproval.findUnique({
      where: { id: approvalId },
      include: {
        retailer: true,
        requestedBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
      },
    });
  }

  async rejectRequest(approvalId: string, approvedById: string, rejectionReason: string) {
    const approval = await this.prisma.creditApproval.findUnique({
      where: { id: approvalId },
    });

    if (!approval) {
      throw new BadRequestException('Credit approval not found');
    }

    if (approval.status !== CreditApprovalStatus.PENDING) {
      throw new BadRequestException('Credit approval is not pending');
    }

    const updated = await this.prisma.creditApproval.update({
      where: { id: approvalId },
      data: {
        status: CreditApprovalStatus.REJECTED,
        approvedById,
        rejectionReason,
      },
    });

    await this.auditService.record({
      branchId: approval.branchId,
      actorUserId: approvedById,
      action: AuditAction.CREDIT_LIMIT_REJECTED,
      entityType: ReferenceType.CREDIT_APPROVAL,
      entityId: approvalId,
      beforeData: { requestedLimit: approval.newLimit },
      afterData: { status: 'REJECTED' },
      reason: rejectionReason,
    });

    return updated;
  }

  async checkCreditLimit(retailerId: string, orderAmount: number): Promise<{
    allowed: boolean;
    currentOutstanding: number;
    creditLimit: number;
    remainingCredit: number;
  }> {
    const retailer = await this.prisma.retailer.findUnique({
      where: { id: retailerId },
    });

    if (!retailer) {
      throw new BadRequestException('Retailer not found');
    }

    // Get outstanding balance from ledger
    const ledgerEntries = await this.prisma.retailerLedgerEntry.findMany({
      where: { retailerId },
      select: { debitAmount: true, creditAmount: true },
    });

    const outstanding = ledgerEntries.reduce(
      (acc, e) => acc + Number(e.debitAmount) - Number(e.creditAmount),
      0,
    );

    const creditLimit = Number(retailer.creditLimit);
    const remainingCredit = creditLimit - outstanding;
    const allowed = outstanding + orderAmount <= creditLimit;

    return {
      allowed,
      currentOutstanding: outstanding,
      creditLimit,
      remainingCredit,
    };
  }

  async enforceCreditLimit(retailerId: string, orderAmount: number): Promise<void> {
    const check = await this.checkCreditLimit(retailerId, orderAmount);

    if (!check.allowed) {
      throw new BadRequestException(
        `Order amount ${orderAmount} exceeds available credit. Current outstanding: ${check.currentOutstanding}, Credit limit: ${check.creditLimit}, Remaining: ${check.remainingCredit}`,
      );
    }
  }

  async getCreditApprovals(filters?: {
    retailerId?: string;
    branchId?: string;
    status?: CreditApprovalStatus;
  }) {
    const where: Prisma.CreditApprovalWhereInput = {};

    if (filters?.retailerId) {
      where.retailerId = filters.retailerId;
    }
    if (filters?.branchId) {
      where.branchId = filters.branchId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    return this.prisma.creditApproval.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        retailer: {
          select: { id: true, code: true, shopName: true, phone: true },
        },
        requestedBy: {
          select: { id: true, fullName: true },
        },
        approvedBy: {
          select: { id: true, fullName: true },
        },
      },
    });
  }

  async getRetailerCreditHistory(retailerId: string) {
    return this.prisma.creditApproval.findMany({
      where: { retailerId },
      orderBy: { createdAt: 'desc' },
      include: {
        requestedBy: {
          select: { id: true, fullName: true },
        },
        approvedBy: {
          select: { id: true, fullName: true },
        },
      },
    });
  }
}
