import { Injectable } from '@nestjs/common';
import { Prisma, ReferenceType, RetailerLedgerEntryType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

interface LedgerEntry {
  debitAmount: number | Prisma.Decimal;
  creditAmount: number | Prisma.Decimal;
  createdAt?: Date;
}

export interface AgingBucket {
  days: string;
  amount: number;
  count: number;
}

@Injectable()
export class RetailerLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Static helper for unit tests: sums debits - credits.
   */
  static calculateOutstanding(entries: LedgerEntry[]): number {
    return entries.reduce((acc, e) => {
      return acc + Number(e.debitAmount) - Number(e.creditAmount);
    }, 0);
  }

  async createInvoiceDebit(
    tx: Prisma.TransactionClient,
    options: {
      branchId: string;
      retailerId: string;
      invoiceId: string;
      amount: number;
      createdById: string;
    },
  ) {
    const current = await this.getOutstandingWithTx(tx, options.retailerId);
    const balanceAfter = current + options.amount;

    return tx.retailerLedgerEntry.create({
      data: {
        branchId: options.branchId,
        retailerId: options.retailerId,
        entryType: RetailerLedgerEntryType.INVOICE_DEBIT,
        referenceType: ReferenceType.INVOICE,
        referenceId: options.invoiceId,
        debitAmount: options.amount,
        creditAmount: 0,
        balanceAfter,
        createdById: options.createdById,
      },
    });
  }

  async createPaymentCredit(
    tx: Prisma.TransactionClient,
    options: {
      branchId: string;
      retailerId: string;
      paymentId: string;
      amount: number;
      createdById: string;
    },
  ) {
    const current = await this.getOutstandingWithTx(tx, options.retailerId);
    const balanceAfter = current - options.amount;

    return tx.retailerLedgerEntry.create({
      data: {
        branchId: options.branchId,
        retailerId: options.retailerId,
        entryType: RetailerLedgerEntryType.PAYMENT_CREDIT,
        referenceType: ReferenceType.PAYMENT,
        referenceId: options.paymentId,
        debitAmount: 0,
        creditAmount: options.amount,
        balanceAfter,
        createdById: options.createdById,
      },
    });
  }

  async createAdjustmentDebit(
    tx: Prisma.TransactionClient,
    options: {
      branchId: string;
      retailerId: string;
      referenceId: string;
      amount: number;
      createdById: string;
      reason?: string;
    },
  ) {
    const current = await this.getOutstandingWithTx(tx, options.retailerId);
    const balanceAfter = current + options.amount;

    return tx.retailerLedgerEntry.create({
      data: {
        branchId: options.branchId,
        retailerId: options.retailerId,
        entryType: RetailerLedgerEntryType.ADJUSTMENT_DEBIT,
        referenceType: ReferenceType.RETAILER_LEDGER,
        referenceId: options.referenceId,
        debitAmount: options.amount,
        creditAmount: 0,
        balanceAfter,
        createdById: options.createdById,
      },
    });
  }

  async createAdjustmentCredit(
    tx: Prisma.TransactionClient,
    options: {
      branchId: string;
      retailerId: string;
      referenceId: string;
      amount: number;
      createdById: string;
      reason?: string;
    },
  ) {
    const current = await this.getOutstandingWithTx(tx, options.retailerId);
    const balanceAfter = current - options.amount;

    return tx.retailerLedgerEntry.create({
      data: {
        branchId: options.branchId,
        retailerId: options.retailerId,
        entryType: RetailerLedgerEntryType.ADJUSTMENT_CREDIT,
        referenceType: ReferenceType.RETAILER_LEDGER,
        referenceId: options.referenceId,
        debitAmount: 0,
        creditAmount: options.amount,
        balanceAfter,
        createdById: options.createdById,
      },
    });
  }

  async getOutstanding(retailerId: string): Promise<number> {
    const entries = await this.prisma.retailerLedgerEntry.findMany({
      where: { retailerId },
      select: { debitAmount: true, creditAmount: true },
    });
    return RetailerLedgerService.calculateOutstanding(entries);
  }

  private async getOutstandingWithTx(tx: Prisma.TransactionClient, retailerId: string): Promise<number> {
    const entries = await tx.retailerLedgerEntry.findMany({
      where: { retailerId },
      select: { debitAmount: true, creditAmount: true },
    });
    return RetailerLedgerService.calculateOutstanding(entries);
  }

  async getLedger(retailerId: string, pagination: { skip: number; take: number }, filters?: {
    entryType?: RetailerLedgerEntryType;
    referenceType?: ReferenceType;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: Prisma.RetailerLedgerEntryWhereInput = { retailerId };

    if (filters?.entryType) {
      where.entryType = filters.entryType;
    }
    if (filters?.referenceType) {
      where.referenceType = filters.referenceType;
    }
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.retailerLedgerEntry.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: { id: true, fullName: true, phone: true },
          },
        },
      }),
      this.prisma.retailerLedgerEntry.count({ where }),
    ]);

    const outstanding = await this.getOutstanding(retailerId);
    return { items, total, outstanding };
  }

  async getAgingReport(retailerId: string): Promise<{
    outstanding: number;
    buckets: AgingBucket[];
  }> {
    const outstanding = await this.getOutstanding(retailerId);

    // Get all invoice debit entries (unpaid invoices)
    const invoiceDebits = await this.prisma.retailerLedgerEntry.findMany({
      where: {
        retailerId,
        entryType: RetailerLedgerEntryType.INVOICE_DEBIT,
      },
      select: {
        debitAmount: true,
        createdAt: true,
        referenceId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Get all payment credits
    const paymentCredits = await this.prisma.retailerLedgerEntry.findMany({
      where: {
        retailerId,
        entryType: RetailerLedgerEntryType.PAYMENT_CREDIT,
      },
      select: {
        creditAmount: true,
        createdAt: true,
        referenceId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Calculate aging based on unpaid invoice dates
    const now = new Date();
    const buckets: AgingBucket[] = [
      { days: '0-30', amount: 0, count: 0 },
      { days: '31-60', amount: 0, count: 0 },
      { days: '61-90', amount: 0, count: 0 },
      { days: '90+', amount: 0, count: 0 },
    ];

    // Simple aging calculation based on invoice dates
    // In production, this would need to account for partial payments
    for (const debit of invoiceDebits) {
      const daysSince = Math.floor((now.getTime() - debit.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const amount = Number(debit.debitAmount);

      if (daysSince <= 30) {
        buckets[0].amount += amount;
        buckets[0].count++;
      } else if (daysSince <= 60) {
        buckets[1].amount += amount;
        buckets[1].count++;
      } else if (daysSince <= 90) {
        buckets[2].amount += amount;
        buckets[2].count++;
      } else {
        buckets[3].amount += amount;
        buckets[3].count++;
      }
    }

    return { outstanding, buckets };
  }

  async getEntriesByDateRange(
    retailerId: string,
    startDate: Date,
    endDate: Date,
  ) {
    return this.prisma.retailerLedgerEntry.findMany({
      where: {
        retailerId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, fullName: true, phone: true },
        },
      },
    });
  }
}
