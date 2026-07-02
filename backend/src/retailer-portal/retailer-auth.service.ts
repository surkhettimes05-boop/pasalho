import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { RetailerLedgerService } from '../finance/retailer-ledger/retailer-ledger.service';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';

@Injectable()
export class RetailerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditLogService,
    private readonly ledger: RetailerLedgerService,
  ) {}

  async login(phone: string, pin: string, deviceId?: string, deviceType?: string, ipAddress?: string) {
    const retailer = await this.prisma.retailer.findFirst({
      where: { phone, deletedAt: null },
    });

    if (!retailer) {
      throw new AppError(ErrorCodes.AUTH_REQUIRED, 'Invalid credentials.', 401);
    }

    if (retailer.status !== 'ACTIVE') {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Retailer account is not active.', 403);
    }

    if (!retailer.pinHash) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'PIN not set. Please set your PIN first.', 400);
    }

    const valid = await bcrypt.compare(pin, retailer.pinHash);
    if (!valid) {
      throw new AppError(ErrorCodes.AUTH_REQUIRED, 'Invalid credentials.', 401);
    }

    const session = await this.createSession(retailer.id, ipAddress);

    if (deviceId) {
      await this.prisma.retailerDevice.upsert({
        where: { retailerId_deviceId: { retailerId: retailer.id, deviceId } },
        create: { retailerId: retailer.id, deviceId, deviceType, ipAddress, lastActiveAt: new Date() },
        update: { deviceType, ipAddress, lastActiveAt: new Date() },
      });
    }

    await this.audit.record({
      actorUserId: retailer.id,
      action: 'RETAILER_LOGIN',
      entityType: 'RETAILER',
      entityId: retailer.id,
      branchId: retailer.branchId,
      ipAddress,
    });

    return {
      accessToken: session.accessToken,
      retailer: {
        id: retailer.id,
        shopName: retailer.shopName,
        phone: retailer.phone,
        creditLimit: Number(retailer.creditLimit),
      },
    };
  }

  private async createSession(retailerId: string, ipAddress?: string) {
    const refreshToken = randomBytes(48).toString('hex');
    const refreshTokenHash = await bcrypt.hash(refreshToken, 4);

    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

    const session = await this.prisma.retailerSession.create({
      data: {
        retailerId,
        tokenHash: '',
        refreshTokenHash,
        refreshExpiresAt,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ipAddress,
      },
    });

    const payload = { sub: retailerId, type: 'retailer', sessionId: session.id, retailerId };
    const accessToken = this.jwt.sign(payload);

    const tokenHash = await bcrypt.hash(accessToken, 4);
    await this.prisma.retailerSession.update({ where: { id: session.id }, data: { tokenHash } });

    return { accessToken, sessionId: session.id };
  }

  async initPin(phone: string, pin: string) {
    const retailer = await this.prisma.retailer.findFirst({
      where: { phone, deletedAt: null, pinHash: null },
    });
    if (!retailer) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Retailer not found or PIN already set.', 400);
    }
    const pinHash = await bcrypt.hash(pin, 10);
    await this.prisma.retailer.update({ where: { id: retailer.id }, data: { pinHash } });

    await this.audit.record({
      actorUserId: retailer.id,
      action: 'RETAILER_PIN_SET',
      entityType: 'RETAILER',
      entityId: retailer.id,
      branchId: retailer.branchId,
    });

    return { message: 'PIN set successfully. You can now login.' };
  }

  async setPin(retailerId: string, pin: string) {
    const pinHash = await bcrypt.hash(pin, 10);
    await this.prisma.retailer.update({ where: { id: retailerId }, data: { pinHash } });

    await this.audit.record({
      actorUserId: retailerId,
      action: 'RETAILER_PIN_SET',
      entityType: 'RETAILER',
      entityId: retailerId,
    });
  }

  async changePin(retailerId: string, currentPin: string, newPin: string) {
    const retailer = await this.prisma.retailer.findUnique({ where: { id: retailerId } });
    if (!retailer || !retailer.pinHash) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'PIN not set.', 400);
    }

    const valid = await bcrypt.compare(currentPin, retailer.pinHash);
    if (!valid) {
      throw new AppError(ErrorCodes.AUTH_REQUIRED, 'Current PIN is incorrect.', 401);
    }

    const pinHash = await bcrypt.hash(newPin, 10);
    await this.prisma.retailer.update({ where: { id: retailerId }, data: { pinHash } });

    await this.audit.record({
      actorUserId: retailerId,
      action: 'RETAILER_PIN_SET',
      entityType: 'RETAILER',
      entityId: retailerId,
    });
  }

  async logout(sessionId: string) {
    await this.prisma.retailerSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async validateRetailerSession(sessionId: string) {
    const session = await this.prisma.retailerSession.findFirst({
      where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    return !!session;
  }

  async getProfile(retailerId: string) {
    const retailer = await this.prisma.retailer.findUnique({
      where: { id: retailerId },
      include: { orderPreference: true },
    });

    if (!retailer) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Retailer not found.', 404);
    }

    const outstanding = await this.ledger.getOutstanding(retailerId);

    return {
      id: retailer.id,
      shopName: retailer.shopName,
      ownerName: retailer.ownerName,
      phone: retailer.phone,
      address: retailer.address,
      creditLimit: Number(retailer.creditLimit),
      status: retailer.status,
      branchId: retailer.branchId,
      orderPreference: retailer.orderPreference,
      outstanding,
    };
  }
}
