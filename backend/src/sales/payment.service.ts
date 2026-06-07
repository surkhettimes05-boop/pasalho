import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { RetailerLedgerService } from '../finance/retailer-ledger/retailer-ledger.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly ledger: RetailerLedgerService,
  ) {}

  async list(pagination: PaginationDto, branchId?: string) {
    const where: any = {};
    if (branchId) where.branchId = branchId;

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: { retailer: true, invoice: true, receivedBy: { select: { id: true, fullName: true } } },
        orderBy: { receivedAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async findById(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { retailer: true, invoice: true },
    });
    if (!payment) throw new AppError(ErrorCodes.NOT_FOUND, 'Payment not found.', 404);
    return payment;
  }

  async create(dto: CreatePaymentDto, actorUserId: string) {
    const paymentNumber = `PAY-${Date.now()}`;

    const payment = await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          branchId: dto.branchId,
          paymentNumber,
          retailerId: dto.retailerId,
          invoiceId: dto.invoiceId,
          amount: dto.amount,
          method: dto.method,
          referenceNumber: dto.referenceNumber,
          receivedById: actorUserId,
        },
      });

      // Update invoice payment status if linked to invoice
      if (dto.invoiceId) {
        const invoice = await tx.invoice.findUnique({ where: { id: dto.invoiceId } });
        if (invoice) {
          const newPaid = Number(invoice.paidAmount) + dto.amount;
          const newDue = Number(invoice.grandTotal) - newPaid;
          const paymentStatus = newDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';
          const invoiceStatus = newDue <= 0 ? 'PAID' : invoice.status;

          await tx.invoice.update({
            where: { id: dto.invoiceId },
            data: { paidAmount: newPaid, dueAmount: Math.max(0, newDue), paymentStatus, status: invoiceStatus as any },
          });
        }
      }

      // Create retailer ledger credit if linked to retailer
      if (dto.retailerId) {
        await this.ledger.createPaymentCredit(tx, {
          branchId: dto.branchId,
          retailerId: dto.retailerId,
          paymentId: p.id,
          amount: dto.amount,
          createdById: actorUserId,
        });
      }

      return p;
    });

    await this.audit.record({
      actorUserId,
      action: 'PAYMENT_RECORDED',
      entityType: 'PAYMENT',
      entityId: payment.id,
      branchId: dto.branchId,
      afterData: { amount: dto.amount, method: dto.method, invoiceId: dto.invoiceId },
    });

    return payment;
  }
}
