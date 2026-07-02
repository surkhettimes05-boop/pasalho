import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { AuditAction, ReferenceType } from '@prisma/client';

export interface AllocationItem {
  invoiceId: string;
  amount: number;
}

@Injectable()
export class PaymentAllocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditLogService,
  ) {}

  async autoAllocate(paymentId: string, allocatedById: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { retailer: true },
    });

    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    if (!payment.retailerId) {
      throw new BadRequestException('Payment must be linked to a retailer for auto-allocation');
    }

    const paymentAmount = Number(payment.amount);

    // Get unpaid invoices for this retailer, ordered by date (FIFO)
    const unpaidInvoices = await this.prisma.invoice.findMany({
      where: {
        retailerId: payment.retailerId,
        status: { in: ['POSTED', 'CREDIT_OPEN'] },
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        invoiceNumber: true,
        dueAmount: true,
        grandTotal: true,
        paidAmount: true,
      },
    });

    const allocations: AllocationItem[] = [];
    let remainingAmount = paymentAmount;

    for (const invoice of unpaidInvoices) {
      if (remainingAmount <= 0) break;

      const dueAmount = Number(invoice.dueAmount);
      const allocationAmount = Math.min(remainingAmount, dueAmount);

      if (allocationAmount > 0) {
        allocations.push({
          invoiceId: invoice.id,
          amount: allocationAmount,
        });
        remainingAmount -= allocationAmount;
      }
    }

    if (allocations.length === 0) {
      throw new BadRequestException('No unpaid invoices found for allocation');
    }

    return this.allocatePayment(paymentId, allocations, allocatedById, true);
  }

  async allocatePayment(
    paymentId: string,
    allocations: AllocationItem[],
    allocatedById: string,
    isAuto = false,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { retailer: true },
    });

    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    const totalAllocation = allocations.reduce((sum, a) => sum + a.amount, 0);

    if (totalAllocation > Number(payment.amount)) {
      throw new BadRequestException('Total allocation exceeds payment amount');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const allocation of allocations) {
        const invoice = await tx.invoice.findUnique({
          where: { id: allocation.invoiceId },
        });

        if (!invoice) {
          throw new BadRequestException(`Invoice ${allocation.invoiceId} not found`);
        }

        const currentPaid = Number(invoice.paidAmount);
        const newPaid = currentPaid + allocation.amount;
        const grandTotal = Number(invoice.grandTotal);

        // Update invoice payment status
        let newPaymentStatus = invoice.paymentStatus;
        if (newPaid >= grandTotal) {
          newPaymentStatus = 'PAID';
        } else if (newPaid > 0) {
          newPaymentStatus = 'PARTIALLY_PAID';
        }

        await tx.invoice.update({
          where: { id: allocation.invoiceId },
          data: {
            paidAmount: newPaid,
            dueAmount: grandTotal - newPaid,
            paymentStatus: newPaymentStatus,
          },
        });
      }

      // Link payment to retailer if not already linked
      if (!payment.retailerId && allocations.length > 0) {
        const firstInvoice = await tx.invoice.findUnique({
          where: { id: allocations[0].invoiceId },
        });
        if (firstInvoice?.retailerId) {
          await tx.payment.update({
            where: { id: paymentId },
            data: { retailerId: firstInvoice.retailerId },
          });
        }
      }
    });

    await this.auditService.record({
      branchId: payment.branchId,
      actorUserId: allocatedById,
      action: AuditAction.PAYMENT_ALLOCATED,
      entityType: ReferenceType.PAYMENT,
      entityId: paymentId,
      beforeData: { amount: payment.amount },
      afterData: { allocations } as unknown as Prisma.InputJsonValue,
      reason: isAuto ? 'Auto-allocated to oldest invoices' : 'Manual allocation',
    });

    return {
      paymentId,
      allocations,
      totalAllocated: totalAllocation,
      remaining: Number(payment.amount) - totalAllocation,
    };
  }

  async getPaymentAllocation(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        retailer: true,
        invoice: true,
      },
    });

    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    // Get invoices that have been paid by this payment
    // This is a simplified version - in production, you'd have a PaymentAllocation table
    const retailerInvoices = payment.retailerId
      ? await this.prisma.invoice.findMany({
          where: {
            retailerId: payment.retailerId,
            paymentStatus: { in: ['PARTIALLY_PAID', 'PAID'] },
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    return {
      payment,
      retailerInvoices,
    };
  }

  async reverseAllocation(paymentId: string, reversedById: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    if (!payment.retailerId) {
      throw new BadRequestException('Payment is not allocated to any retailer');
    }

    // In a full implementation, this would reverse specific allocations
    // For now, we'll mark the payment as voided and reverse the invoice updates
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'VOIDED' },
      });

      // Reverse invoice payment status
      const invoices = await tx.invoice.findMany({
        where: {
          retailerId: payment.retailerId,
          paymentStatus: { in: ['PARTIALLY_PAID', 'PAID'] },
        },
      });

      for (const invoice of invoices) {
        // This is simplified - in production, track which payment paid which invoice
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: 0,
            dueAmount: invoice.grandTotal,
            paymentStatus: 'UNPAID',
          },
        });
      }
    });

    await this.auditService.record({
      branchId: payment.branchId,
      actorUserId: reversedById,
      action: AuditAction.PAYMENT_ALLOCATED,
      entityType: ReferenceType.PAYMENT,
      entityId: paymentId,
      beforeData: { status: 'RECORDED' },
      afterData: { status: 'VOIDED' },
      reason: 'Payment allocation reversed',
    });

    return { paymentId, status: 'VOIDED' };
  }
}
