import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminSummary(branchId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const branchFilter: any = branchId ? { branchId } : {};

    const [
      todayInvoicesRaw,
      todayPaymentsRaw,
      totalOutstandingRaw,
      lowStockCount,
      recentInvoices,
      recentMovements,
    ] = await Promise.all([
      // Today's invoices
      this.prisma.invoice.aggregate({
        where: { ...branchFilter, status: { in: ['POSTED', 'PAID', 'PARTIALLY_PAID', 'CREDIT_OPEN'] }, postedAt: { gte: today, lt: tomorrow } },
        _count: { id: true },
        _sum: { grandTotal: true },
      }),

      // Today's payments
      this.prisma.payment.aggregate({
        where: { ...branchFilter, receivedAt: { gte: today, lt: tomorrow } },
        _count: { id: true },
        _sum: { amount: true },
      }),

      // Total outstanding retailer credit
      this.prisma.retailerLedgerEntry.aggregate({
        where: branchId ? { branchId } : {},
        _sum: { debitAmount: true, creditAmount: true },
      }),

      // Low stock count (snapshots with baseQuantity < 10, state AVAILABLE)
      this.prisma.inventorySnapshot.count({
        where: { stockState: 'AVAILABLE', baseQuantity: { lt: 10 } },
      }),

      // Recent invoices
      this.prisma.invoice.findMany({
        where: branchFilter,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { retailer: { select: { shopName: true } } },
      }),

      // Recent stock movements
      this.prisma.inventoryMovement.findMany({
        where: branchId ? { branchId } : {},
        take: 10,
        orderBy: { occurredAt: 'desc' },
        include: { product: { select: { name: true } }, location: { select: { name: true } } },
      }),
    ]);

    const totalDebits = Number(totalOutstandingRaw._sum.debitAmount ?? 0);
    const totalCredits = Number(totalOutstandingRaw._sum.creditAmount ?? 0);

    return {
      today: {
        invoiceCount: todayInvoicesRaw._count.id,
        invoiceSalesTotal: Number(todayInvoicesRaw._sum.grandTotal ?? 0),
        paymentCount: todayPaymentsRaw._count.id,
        paymentsTotal: Number(todayPaymentsRaw._sum.amount ?? 0),
      },
      outstanding: {
        totalRetailerCredit: totalDebits - totalCredits,
      },
      lowStockCount,
      recentInvoices,
      recentMovements,
    };
  }
}
