import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';

export interface CustomerAccessPayload {
  sub: string;
  sessionId: string;
  type: 'customer';
}

@Injectable()
export class CustomerTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async createSession(
    customer: { id: string; phone: string },
    ipAddress?: string,
    userAgent?: string,
    deviceId?: string,
  ) {
    const sessionId = randomUUID();
    const secret = randomBytes(32).toString('hex');
    const refreshTokenHash = await bcrypt.hash(secret, 6);
    const refreshDays = this.config.get<number>('CUSTOMER_REFRESH_TOKEN_DAYS', 30);
    const refreshExpiresAt = new Date(Date.now() + refreshDays * 86400000);

    await this.prisma.customerSession.create({
      data: { id: sessionId, customerId: customer.id, refreshTokenHash, refreshExpiresAt, deviceId, ipAddress, userAgent },
    });

    const accessToken = this.jwt.sign({
      sub: customer.id,
      sessionId,
      type: 'customer',
    } satisfies CustomerAccessPayload);

    return {
      accessToken,
      refreshToken: `${sessionId}.${secret}`,
      expiresIn: this.config.get<number>('CUSTOMER_JWT_TTL_SECONDS', 900),
    };
  }

  async refresh(refreshToken: string, ipAddress?: string, userAgent?: string) {
    const [sessionId, secret, ...extra] = refreshToken.split('.');
    if (!sessionId || !secret || extra.length > 0) {
      throw new AppError(ErrorCodes.CUSTOMER_AUTH_REQUIRED, 'Invalid refresh token.', 401);
    }

    const customer = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "CustomerSession" WHERE id = ${sessionId} FOR UPDATE
      `;
      if (!locked[0]) return null;

      const session = await tx.customerSession.findUnique({
        where: { id: sessionId },
        include: { customer: true },
      });
      if (!session || session.revokedAt || session.refreshExpiresAt <= new Date() ||
          session.customer.status !== 'ACTIVE' || session.customer.deletedAt) return null;

      if (!(await bcrypt.compare(secret, session.refreshTokenHash))) return null;

      await tx.customerSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      return { id: session.customer.id, phone: session.customer.phone };
    });

    if (!customer) {
      throw new AppError(ErrorCodes.CUSTOMER_AUTH_REQUIRED, 'Invalid or expired refresh token.', 401);
    }
    return this.createSession(customer, ipAddress, userAgent);
  }

  async logout(sessionId: string, customerId: string) {
    await this.prisma.customerSession.updateMany({
      where: { id: sessionId, customerId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Logged out.' };
  }

  async verifyAccessToken(token: string): Promise<CustomerAccessPayload> {
    try {
      const payload = await this.jwt.verifyAsync<CustomerAccessPayload>(token);
      if (payload.type !== 'customer' || !payload.sub || !payload.sessionId) throw new Error('Wrong token type');

      const session = await this.prisma.customerSession.findFirst({
        where: {
          id: payload.sessionId,
          customerId: payload.sub,
          revokedAt: null,
          refreshExpiresAt: { gt: new Date() },
          customer: { status: 'ACTIVE', deletedAt: null },
        },
        select: { id: true },
      });
      if (!session) throw new Error('Session revoked');
      return payload;
    } catch {
      throw new AppError(ErrorCodes.CUSTOMER_AUTH_REQUIRED, 'Customer authentication required.', 401);
    }
  }
}
