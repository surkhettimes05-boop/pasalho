import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt.payload';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditLogService,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL') || 'redis://localhost:6379';
    const client = new Redis(redisUrl, { lazyConnect: true, enableOfflineQueue: false });
    client.connect().then(() => {
      this.redis = client;
    }).catch(() => {
      console.warn('[AuthService] Redis unavailable — session caching disabled, falling back to DB.');
      client.disconnect();
    });
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }

  /** Safe Redis helpers — silently skip if Redis is down */
  private async rSet(key: string, value: string, ex: number): Promise<void> {
    try { await this.redis?.set(key, value, 'EX', ex); } catch { /* no-op */ }
  }
  private async rDel(key: string): Promise<void> {
    try { await this.redis?.del(key); } catch { /* no-op */ }
  }
  private async rGet(key: string): Promise<string | null> {
    try { return (await this.redis?.get(key)) ?? null; } catch { return null; }
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.login }, { phone: dto.login }] },
      include: {
        userRoles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
    });

    const recordFailure = async (reason: string) => {
      await this.prisma.loginAttempt.create({
        data: {
          email: dto.login.includes('@') ? dto.login : undefined,
          phone: !dto.login.includes('@') ? dto.login : undefined,
          success: false,
          failureReason: reason,
          ipAddress,
          userAgent,
          userId: user?.id,
        },
      });
    };

    if (!user) {
      await recordFailure('USER_NOT_FOUND');
      throw new AppError(ErrorCodes.AUTH_REQUIRED, 'Invalid credentials.', 401);
    }

    if (user.status === 'SUSPENDED') {
      await recordFailure('USER_SUSPENDED');
      throw new AppError(ErrorCodes.FORBIDDEN, 'Account suspended.', 403);
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      await recordFailure('WRONG_PASSWORD');
      throw new AppError(ErrorCodes.AUTH_REQUIRED, 'Invalid credentials.', 401);
    }

    // Register/update device
    if (dto.deviceId) {
      await this.prisma.device.upsert({
        where: { userId_deviceId: { userId: user.id, deviceId: dto.deviceId } },
        create: {
          userId: user.id,
          deviceId: dto.deviceId,
          deviceType: dto.deviceType,
          userAgent,
          ipAddress,
          lastActiveAt: new Date(),
        },
        update: {
          deviceType: dto.deviceType,
          userAgent,
          ipAddress,
          lastActiveAt: new Date(),
        },
      });
    }

    const roles = user.userRoles.map((ur) => ur.role.code);
    const permissionsSet = new Set<string>();
    for (const ur of user.userRoles) {
      for (const rp of ur.role.permissions) {
        permissionsSet.add(rp.permission.code);
      }
    }
    const permissions = Array.from(permissionsSet);

    return this.createSession(user.id, user.email, roles, permissions, ipAddress, userAgent);
  }

  private async createSession(userId: string, email: string, roles: string[], permissions: string[], ipAddress?: string, userAgent?: string) {
    const refreshToken = randomBytes(48).toString('hex');
    const refreshTokenHash = await bcrypt.hash(refreshToken, 4);

    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash: '',
        refreshTokenHash,
        refreshExpiresAt,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ipAddress,
        userAgent,
      },
    });

    const payload: JwtPayload = { sub: userId, email, sessionId: session.id, roles, permissions };
    const accessToken = this.jwt.sign(payload);

    const tokenHash = await bcrypt.hash(accessToken, 4);
    await this.prisma.session.update({ where: { id: session.id }, data: { tokenHash } });

    // Cache session in Redis (15 mins = 900s)
    await this.rSet(`session:${session.id}:valid`, 'true', 900);

    await this.prisma.loginAttempt.create({ data: { userId, email, success: true, ipAddress, userAgent } });
    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });

    return { accessToken, refreshToken, userId, permissions };
  }

  async refresh(refreshToken: string, ipAddress?: string, userAgent?: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        revokedAt: null,
        refreshTokenHash: { not: null },
        refreshExpiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    let matchedSession: (typeof sessions)[0] | null = null;
    for (const session of sessions) {
      if (session.refreshTokenHash && await bcrypt.compare(refreshToken, session.refreshTokenHash)) {
        matchedSession = session;
        break;
      }
    }

    if (!matchedSession) throw new AppError(ErrorCodes.AUTH_REQUIRED, 'Invalid or expired refresh token.', 401);
    if (matchedSession.user.status !== 'ACTIVE') throw new AppError(ErrorCodes.FORBIDDEN, 'Account suspended.', 403);

    // Refresh Token Rotation: Revoke old session and Redis cache
    await this.prisma.session.update({ where: { id: matchedSession.id }, data: { revokedAt: new Date() } });
    await this.rDel(`session:${matchedSession.id}:valid`);

    const userWithRoles = await this.prisma.user.findUniqueOrThrow({
      where: { id: matchedSession.user.id },
      include: { userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });

    const roles = userWithRoles.userRoles.map((ur) => ur.role.code);
    const permissionsSet = new Set<string>();
    for (const ur of userWithRoles.userRoles) {
      for (const rp of ur.role.permissions) { permissionsSet.add(rp.permission.code); }
    }
    return this.createSession(matchedSession.user.id, matchedSession.user.email, roles, Array.from(permissionsSet), ipAddress, userAgent);
  }

  async logout(sessionId: string, userId: string) {
    await this.prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    await this.rDel(`session:${sessionId}:valid`);
  }

  async logoutAll(userId: string) {
    const sessions = await this.prisma.session.findMany({ where: { userId, revokedAt: null } });
    await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    for (const s of sessions) {
      await this.rDel(`session:${s.id}:valid`);
    }
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { message: 'If the email exists, a reset link will be sent.' };

    const resetToken = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(resetToken, 4);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Mock email sending
    console.log(`Password reset link: /reset-password?token=${resetToken}&email=${email}`);
    return { message: 'If the email exists, a reset link will be sent.' };
  }

  async resetPassword(token: string, newPassword: string) {
    // In a real app we'd verify the email too, but token is high entropy.
    // For simplicity we search all active tokens.
    const activeTokens = await this.prisma.passwordResetToken.findMany({
      where: { usedAt: null, expiresAt: { gt: new Date() } },
    });

    let matchedToken = null;
    for (const t of activeTokens) {
      if (await bcrypt.compare(token, t.tokenHash)) {
        matchedToken = t;
        break;
      }
    }

    if (!matchedToken) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Invalid or expired token', 400);

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: matchedToken.userId }, data: { passwordHash } });
    await this.prisma.passwordResetToken.update({ where: { id: matchedToken.id }, data: { usedAt: new Date() } });
    
    // Invalidate all sessions to require re-login
    await this.logoutAll(matchedToken.userId);

    return { message: 'Password reset successful' };
  }

  async getDevices(userId: string) {
    return this.prisma.device.findMany({ where: { userId } });
  }

  async revokeDevice(userId: string, deviceId: string) {
    await this.prisma.device.deleteMany({ where: { userId, deviceId } });
    return { message: 'Device revoked' };
  }

  async validateSession(sessionId: string) {
    const cached = await this.rGet(`session:${sessionId}:valid`);
    if (cached === 'true') return true;

    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() } },
    });

    if (session) {
      await this.rSet(`session:${sessionId}:valid`, 'true', 900);
      return true;
    }
    return false;
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } }, branch: true } },
        defaultBranch: true,
      },
    });
    const permissionsSet = new Set<string>();
    for (const ur of user.userRoles) {
      for (const rp of ur.role.permissions) { permissionsSet.add(rp.permission.code); }
    }
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      status: user.status,
      defaultBranchId: user.defaultBranchId,
      defaultBranch: user.defaultBranch,
      permissions: Array.from(permissionsSet),
      userRoles: user.userRoles.map((ur) => ({
        roleCode: ur.role.code, roleName: ur.role.name, branchId: ur.branchId, branchName: ur.branch?.name, warehouseId: ur.warehouseId,
      })),
    };
  }
}