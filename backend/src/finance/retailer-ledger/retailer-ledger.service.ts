import { Injectable } from '@nestjs/common';
import { Prisma, ReferenceType, RetailerLedgerEntryType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

interface LedgerEntry {
  debitAmount: number | Prisma.Decimal;
  creditAmount: number | Prisma.Decimal;
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

  async getLedger(retailerId: string, pagination: { skip: number; take: number }) {
    const [items, total] = await Promise.all([
      this.prisma.retailerLedgerEntry.findMany({
        where: { retailerId },
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.retailerLedgerEntry.count({ where: { retailerId } }),
    ]);

    const outstanding = await this.getOutstanding(retailerId);
    return { items, total, outstanding };
  }
}
