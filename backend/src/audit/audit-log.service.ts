import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma, ReferenceType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface AuditLogInput {
  actorUserId: string;
  action: AuditAction;
  entityType: ReferenceType;
  entityId: string;
  branchId?: string;
  beforeData?: Prisma.InputJsonValue;
  afterData?: Prisma.InputJsonValue;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: AuditLogInput, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.auditLog.create({ data: input });
  }
}
