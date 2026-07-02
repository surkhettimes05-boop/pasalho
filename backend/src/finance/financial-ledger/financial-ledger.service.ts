import { Injectable } from '@nestjs/common';
import { Prisma, FinancialLedgerEntryType, ReferenceType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

interface FinancialEntry {
  debitAmount: number | Prisma.Decimal;
  creditAmount: number | Prisma.Decimal;
}

@Injectable()
export class FinancialLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  static calculateBalance(entries: FinancialEntry[]): number {
    return entries.reduce((acc, e) => {
      return acc + Number(e.creditAmount) - Number(e.debitAmount);
    }, 0);
  }

  async createSalesCredit(
    tx: Prisma.TransactionClient,
    options: {
      branchId: string;
      invoiceId: string;
      amount: number;
      createdById: string;
    },
  ) {
    return tx.financialLedgerEntry.create({
      data: {
        branchId: options.branchId,
        entryType: FinancialLedgerEntryType.SALES_CREDIT,
        referenceType: ReferenceType.INVOICE,
        referenceId: options.invoiceId,
        debitAmount: 0,
        creditAmount: options.amount,
        createdById: options.createdById,
      },
    });
  }

  async createPaymentDebit(
    tx: Prisma.TransactionClient,
    options: {
      branchId: string;
      paymentId: string;
      amount: number;
      createdById: string;
    },
  ) {
    return tx.financialLedgerEntry.create({
      data: {
        branchId: options.branchId,
        entryType: FinancialLedgerEntryType.PAYMENT_CREDIT,
        referenceType: ReferenceType.PAYMENT,
        referenceId: options.paymentId,
        debitAmount: 0,
        creditAmount: options.amount,
        createdById: options.createdById,
      },
    });
  }

  async createExpenseDebit(
    tx: Prisma.TransactionClient,
    options: {
      branchId: string;
      referenceId: string;
      amount: number;
      createdById: string;
    },
  ) {
    return tx.financialLedgerEntry.create({
      data: {
        branchId: options.branchId,
        entryType: FinancialLedgerEntryType.EXPENSE_DEBIT,
        referenceType: ReferenceType.FINANCIAL_LEDGER,
        referenceId: options.referenceId,
        debitAmount: options.amount,
        creditAmount: 0,
        createdById: options.createdById,
      },
    });
  }

  async createAdjustment(
    tx: Prisma.TransactionClient,
    options: {
      branchId: string;
      referenceId: string;
      debitAmount?: number;
      creditAmount?: number;
      createdById: string;
    },
  ) {
    return tx.financialLedgerEntry.create({
      data: {
        branchId: options.branchId,
        entryType: FinancialLedgerEntryType.ADJUSTMENT,
        referenceType: ReferenceType.FINANCIAL_LEDGER,
        referenceId: options.referenceId,
        debitAmount: options.debitAmount || 0,
        creditAmount: options.creditAmount || 0,
        createdById: options.createdById,
      },
    });
  }

  async getBalance(branchId: string): Promise<number> {
    const entries = await this.prisma.financialLedgerEntry.findMany({
      where: { branchId },
      select: { debitAmount: true, creditAmount: true },
    });
    return FinancialLedgerService.calculateBalance(entries);
  }

  async getLedger(branchId: string, pagination: { skip: number; take: number }, filters?: {
    entryType?: FinancialLedgerEntryType;
    referenceType?: ReferenceType;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: Prisma.FinancialLedgerEntryWhereInput = { branchId };

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
      this.prisma.financialLedgerEntry.findMany({
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
      this.prisma.financialLedgerEntry.count({ where }),
    ]);

    const balance = await this.getBalance(branchId);
    return { items, total, balance };
  }

  async getFinancialSummary(branchId: string) {
    const entries = await this.prisma.financialLedgerEntry.findMany({
      where: { branchId },
    });

    const salesCredit = entries
      .filter(e => e.entryType === FinancialLedgerEntryType.SALES_CREDIT)
      .reduce((sum, e) => sum + Number(e.creditAmount), 0);

    const paymentCredit = entries
      .filter(e => e.entryType === FinancialLedgerEntryType.PAYMENT_CREDIT)
      .reduce((sum, e) => sum + Number(e.creditAmount), 0);

    const expenseDebit = entries
      .filter(e => e.entryType === FinancialLedgerEntryType.EXPENSE_DEBIT)
      .reduce((sum, e) => sum + Number(e.debitAmount), 0);

    const balance = await this.getBalance(branchId);

    return {
      totalSales: salesCredit,
      totalPayments: paymentCredit,
      totalExpenses: expenseDebit,
      balance,
    };
  }
}
