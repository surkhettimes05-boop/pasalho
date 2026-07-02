import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../database/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: Partial<PrismaService>;

  beforeAll(async () => {
    prisma = {
      invoice: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
      } as any,
      payment: {
        aggregate: jest.fn(),
      } as any,
      retailerLedgerEntry: {
        aggregate: jest.fn(),
      } as any,
      inventorySnapshot: {
        count: jest.fn(),
      } as any,
      inventoryMovement: {
        findMany: jest.fn(),
      } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  it('returns admin summary with all sections', async () => {
    (prisma.invoice!.aggregate as jest.Mock).mockResolvedValue({ _count: { id: 5 }, _sum: { grandTotal: 25000 } });
    (prisma.payment!.aggregate as jest.Mock).mockResolvedValue({ _count: { id: 3 }, _sum: { amount: 15000 } });
    (prisma.retailerLedgerEntry!.aggregate as jest.Mock).mockResolvedValue({
      _sum: { debitAmount: 50000, creditAmount: 20000 },
    });
    (prisma.inventorySnapshot!.count as jest.Mock).mockResolvedValue(2);
    (prisma.invoice!.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.inventoryMovement!.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.getAdminSummary();

    expect(result.today.invoiceCount).toBe(5);
    expect(result.today.invoiceSalesTotal).toBe(25000);
    expect(result.today.paymentCount).toBe(3);
    expect(result.today.paymentsTotal).toBe(15000);
    expect(result.outstanding.totalRetailerCredit).toBe(30000);
    expect(result.lowStockCount).toBe(2);
    expect(result.recentInvoices).toEqual([]);
    expect(result.recentMovements).toEqual([]);
  });

  it('filters by branch when branchId provided', async () => {
    (prisma.invoice!.aggregate as jest.Mock).mockResolvedValue({ _count: { id: 0 }, _sum: { grandTotal: 0 } });
    (prisma.payment!.aggregate as jest.Mock).mockResolvedValue({ _count: { id: 0 }, _sum: { amount: 0 } });
    (prisma.retailerLedgerEntry!.aggregate as jest.Mock).mockResolvedValue({ _sum: { debitAmount: 0, creditAmount: 0 } });
    (prisma.inventorySnapshot!.count as jest.Mock).mockResolvedValue(0);
    (prisma.invoice!.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.inventoryMovement!.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.getAdminSummary('branch-1');
    expect(result.today.invoiceCount).toBe(0);
  });
});
