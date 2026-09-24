import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { IdempotencyStatus, Prisma } from '@prisma/client';
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

  async create(dto: CreatePaymentDto, actorUserId: string, idempotencyKey?: string) {
    if (!idempotencyKey) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Idempotency-Key is required.', 422);
    }

    const requestHash = createHash('sha256')
      .update(JSON.stringify({
        branchId: dto.branchId,
        retailerId: dto.retailerId ?? null,
        invoiceId: dto.invoiceId ?? null,
        amount: dto.amount,
        method: dto.method,
        referenceNumber: dto.referenceNumber ?? null,
      }))
      .digest('hex');

    let result: { payment: any; created: boolean };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const existingKey = await tx.idempotencyRecord.findUnique({
          where: { scope_key: { scope: 'payment.create', key: idempotencyKey } },
        });
        if (existingKey) {
          if (existingKey.requestHash !== requestHash) {
            throw new AppError(ErrorCodes.CONFLICT, 'Idempotency key was already used with a different request.', 409);
          }
          if (existingKey.status === IdempotencyStatus.COMPLETED && existingKey.resourceId) {
            const existingPayment = await tx.payment.findUnique({ where: { id: existingKey.resourceId } });
            if (existingPayment) return { payment: existingPayment, created: false };
          }
          throw new AppError(ErrorCodes.CONFLICT, 'The idempotent request is already being processed.', 409);
        }

        await tx.idempotencyRecord.create({
          data: {
            key: idempotencyKey,
            scope: 'payment.create',
            requestHash,
            status: IdempotencyStatus.PROCESSING,
          },
        });

        const invoice = dto.invoiceId
          ? (await tx.$queryRaw<Array<any>>`SELECT * FROM "Invoice" WHERE id = ${dto.invoiceId} FOR UPDATE`)[0]
          : null;
        if (dto.invoiceId && !invoice) {
          throw new AppError(ErrorCodes.NOT_FOUND, 'Invoice not found.', 404);
        }

        const branchId = invoice?.branchId ?? dto.branchId;
        if (invoice && dto.branchId !== invoice.branchId) {
          throw new AppError(ErrorCodes.FORBIDDEN, 'Payment branch does not own the invoice.', 403);
        }

        const retailerId = invoice?.retailerId ?? dto.retailerId;
        if (invoice?.retailerId && dto.retailerId && invoice.retailerId !== dto.retailerId) {
          throw new AppError(ErrorCodes.FORBIDDEN, 'Payment retailer does not own the invoice.', 403);
        }
        if (retailerId) {
          const retailer = await tx.$queryRaw<Array<{ id: string; branchId: string }>>`
            SELECT id, "branchId" FROM "Retailer" WHERE id = ${retailerId} FOR UPDATE
          `;
          if (!retailer[0] || retailer[0].branchId !== branchId) {
            throw new AppError(ErrorCodes.FORBIDDEN, 'Payment retailer does not belong to the payment branch.', 403);
          }
        }

        const payment = await tx.payment.create({
          data: {
            branchId,
            paymentNumber: `PAY-${Date.now()}-${idempotencyKey.slice(0, 8)}`,
            retailerId,
            invoiceId: dto.invoiceId,
            amount: dto.amount,
            method: dto.method,
            referenceNumber: dto.referenceNumber,
            receivedById: actorUserId,
          },
        });

        if (invoice) {
          const newPaid = Number(invoice.paidAmount) + dto.amount;
          const newDue = Number(invoice.grandTotal) - newPaid;
          const paymentStatus = newDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';
          const invoiceStatus = newDue <= 0 ? 'PAID' : invoice.status;
          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              paidAmount: newPaid,
              dueAmount: Math.max(0, newDue),
              paymentStatus,
              status: invoiceStatus as any,
            },
          });
        }

        if (retailerId) {
          await this.ledger.createPaymentCredit(tx, {
            branchId,
            retailerId,
            paymentId: payment.id,
            amount: dto.amount,
            createdById: actorUserId,
          });
        }

        await tx.idempotencyRecord.update({
          where: { scope_key: { scope: 'payment.create', key: idempotencyKey } },
          data: {
            status: IdempotencyStatus.COMPLETED,
            responseStatus: 201,
            responseBody: { paymentId: payment.id },
            resourceId: payment.id,
            completedAt: new Date(),
          },
        });

        return { payment, created: true };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existingKey = await this.prisma.idempotencyRecord.findUnique({
          where: { scope_key: { scope: 'payment.create', key: idempotencyKey } },
        });
        if (existingKey?.requestHash !== requestHash) {
          throw new AppError(ErrorCodes.CONFLICT, 'Idempotency key was already used with a different request.', 409);
        }
        if (existingKey?.resourceId) {
          return this.findById(existingKey.resourceId);
        }
      }
      throw error;
    }

    if (result.created) {
      await this.audit.record({
        actorUserId,
        action: 'PAYMENT_RECORDED',
        entityType: 'PAYMENT',
        entityId: result.payment.id,
        branchId: result.payment.branchId,
        afterData: { amount: dto.amount, method: dto.method, invoiceId: dto.invoiceId },
      });
    }

    return result.payment;
  }
}
