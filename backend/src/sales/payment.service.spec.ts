import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { RetailerLedgerService } from '../finance/retailer-ledger/retailer-ledger.service';
import { PaginationDto } from '../common/dto/pagination.dto';

describe('PaymentService', () => {
  let service: PaymentService;
  let prisma: Partial<PrismaService>;
  let ledger: Partial<RetailerLedgerService>;

  beforeAll(async () => {
    ledger = { createPaymentCredit: jest.fn() };

    prisma = {
      payment: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      } as any,
      invoice: {
        findUnique: jest.fn(),
        update: jest.fn(),
      } as any,
      $transaction: jest.fn((cb: any) => cb(prisma)),
    } as any;

    const audit = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: audit },
        { provide: RetailerLedgerService, useValue: ledger },
      ],
    }).compile();

    service = module.get(PaymentService);
  });

  it('lists payments with pagination', async () => {
    (prisma.payment!.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.payment!.count as jest.Mock).mockResolvedValue(0);
    const result = await service.list(new PaginationDto());
    expect(result.total).toBe(0);
  });

  it('finds payment by id', async () => {
    (prisma.payment!.findUnique as jest.Mock).mockResolvedValue({ id: 'pay-1', amount: 500 });
    const result = await service.findById('pay-1');
    expect(result.id).toBe('pay-1');
  });

  it('throws 404 for unknown payment', async () => {
    (prisma.payment!.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(service.findById('bad')).rejects.toThrow('Payment not found.');
  });

  it('creates payment and updates invoice payment status', async () => {
    (prisma.payment!.create as jest.Mock).mockResolvedValue({ id: 'pay-1', paymentNumber: 'PAY-1' });
    (prisma.invoice!.findUnique as jest.Mock).mockResolvedValue({
      id: 'inv-1',
      grandTotal: 1000,
      paidAmount: 0,
      dueAmount: 1000,
      status: 'CREDIT_OPEN',
    });
    (prisma.invoice!.update as jest.Mock).mockResolvedValue({});

    const result = await service.create(
      { branchId: 'b1', retailerId: 'r1', invoiceId: 'inv-1', amount: 500, method: 'CASH' },
      'user-1',
    );
    expect(result.id).toBe('pay-1');
    expect(ledger.createPaymentCredit).toHaveBeenCalled();
    expect(prisma.invoice!.update).toHaveBeenCalled();
  });
});
