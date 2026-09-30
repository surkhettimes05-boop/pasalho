import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { normalizeNepalPhone } from '../common/phone.util';
import { OTP_PROVIDER, OtpProvider } from './otp.provider';
import { CustomerTokenService } from './customer-token.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tokens: CustomerTokenService,
    @Inject(OTP_PROVIDER) private readonly otpProvider: OtpProvider,
  ) {}

  async requestOtp(dto: RequestOtpDto) {
    const phone = normalizeNepalPhone(dto.phone);
    const recent = await this.prisma.customerOtpChallenge.findFirst({
      where: { phone, consumedAt: null, createdAt: { gte: new Date(Date.now() - 60000) } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (recent) {
      throw new AppError(ErrorCodes.OTP_RATE_LIMITED, 'Please wait before requesting another OTP.', 429);
    }

    const code = String(randomInt(100000, 1000000));
    const ttlSeconds = this.config.get<number>('OTP_TTL_SECONDS', 300);
    const challenge = await this.prisma.customerOtpChallenge.create({
      data: {
        phone,
        codeHash: await bcrypt.hash(code, 6),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000),
      },
    });

    try {
      await this.otpProvider.send(phone, code);
    } catch (error) {
      await this.prisma.customerOtpChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
      throw new AppError(
        ErrorCodes.INTERNAL_ERROR,
        'Unable to send OTP right now.',
        503,
        { providerError: error instanceof Error ? error.message : 'unknown' },
      );
    }
    return { challengeId: challenge.id, expiresInSeconds: ttlSeconds };
  }

  async verifyOtp(dto: VerifyOtpDto, ipAddress?: string, userAgent?: string) {
    const phone = normalizeNepalPhone(dto.phone);
    const maxAttempts = this.config.get<number>('OTP_MAX_ATTEMPTS', 5);

    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "CustomerOtpChallenge" WHERE id = ${dto.challengeId} FOR UPDATE
      `;
      if (!locked[0]) return { error: 'INVALID' as const };

      const challenge = await tx.customerOtpChallenge.findUnique({ where: { id: dto.challengeId } });
      if (!challenge || challenge.phone !== phone || challenge.consumedAt) return { error: 'INVALID' as const };
      if (challenge.expiresAt <= new Date()) return { error: 'EXPIRED' as const };
      if (challenge.attempts >= maxAttempts) return { error: 'LOCKED' as const };

      if (!(await bcrypt.compare(dto.otp, challenge.codeHash))) {
        await tx.customerOtpChallenge.update({
          where: { id: challenge.id },
          data: { attempts: { increment: 1 } },
        });
        return { error: challenge.attempts + 1 >= maxAttempts ? ('LOCKED' as const) : ('INVALID' as const) };
      }

      await tx.customerOtpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
      const customer = await tx.customer.upsert({
        where: { phone },
        create: { phone, lastLoginAt: new Date() },
        update: { lastLoginAt: new Date() },
        select: { id: true, phone: true, fullName: true, email: true, status: true },
      });
      if (customer.status !== 'ACTIVE') return { error: 'BLOCKED' as const };
      return { customer };
    });

    if ('error' in result) {
      if (result.error === 'EXPIRED') throw new AppError(ErrorCodes.OTP_EXPIRED, 'OTP has expired.', 422);
      if (result.error === 'BLOCKED') throw new AppError(ErrorCodes.FORBIDDEN, 'Customer account is blocked.', 403);
      throw new AppError(ErrorCodes.INVALID_OTP, 'Invalid OTP.', 422);
    }

    return {
      ...(await this.tokens.createSession(result.customer, ipAddress, userAgent, dto.deviceId)),
      customer: result.customer,
    };
  }
}
