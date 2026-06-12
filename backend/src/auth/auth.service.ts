import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt.payload';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditLogService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    // Find user by email OR phone
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.login }, { phone: dto.login }],
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
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
      if (user !== null) {
        await this.audit.record({
          actorUserId: 'system',
          action: 'LOGIN_FAILURE',
          entityType: 'AUTH',
          entityId: dto.login,
          ipAddress,
          userAgent,
        });
      }
      throw new AppError(ErrorCodes.AUTH_REQUIRED, 'Invalid credentials.', 401);
    }

    if (user.status === 'SUSPENDED') {
      await recordFailure('USER_SUSPENDED');
      await this.audit.record({
        actorUserId: user.id,
        action: 'LOGIN_FAILURE',
        entityType: 'AUTH',
        entityId: user.id,
        ipAddress,
        userAgent,
      });
      throw new AppError(ErrorCodes.FORBIDDEN, 'Account suspended.', 403);
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      await recordFailure('WRONG_PASSWORD');
      await this.audit.record({
        actorUserId: user.id,
        action: 'LOGIN_FAILURE',
        entityType: 'AUTH',
        entityId: user.id,
        ipAddress,
        userAgent,
      });
      throw new AppError(ErrorCodes.AUTH_REQUIRED, 'Invalid credentials.', 401);
    }

    // Collect roles and permissions
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

  /** Create session with access + refresh tokens */
  private async createSession(
    userId: string,
    email: string,
    roles: string[],
    permissions: string[],
    ipAddress?: string,
    userAgent?: string,
  ) {
    // Generate refresh token (opaque random bytes, stored as bcrypt hash)
    const refreshToken = randomBytes(48).toString('hex');
    const refreshTokenHash = await bcrypt.hash(refreshToken, 4);

    // Access token expires in 15 min (from JWT config)
    const accessExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Refresh token expires in 7 days
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash: '',
        refreshTokenHash,
        refreshExpiresAt,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // session max lifetime 30 days
        ipAddress,
        userAgent,
      },
    });

    const payload: JwtPayload = {
      sub: userId,
      email,
      sessionId: session.id,
      roles,
      permissions,
    };
    const accessToken = this.jwt.sign(payload);

    // Store hash of access token in session for revocation checks
    const tokenHash = await bcrypt.hash(accessToken, 4);
    await this.prisma.session.update({ where: { id: session.id }, data: { tokenHash } });

    // Record success
    await this.prisma.loginAttempt.create({
      data: { userId, email, success: true, ipAddress, userAgent },
    });

    await this.audit.record({
      actorUserId: userId,
      action: 'LOGIN_SUCCESS',
      entityType: 'AUTH',
      entityId: userId,
      ipAddress,
      userAgent,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      refreshToken,
      userId,
      permissions,
    };
  }

  /**
   * Refresh: validate refresh token, revoke old session, issue new one.
   */
  async refresh(refreshToken: string, ipAddress?: string, userAgent?: string) {
    // Find all non-revoked sessions with non-null refreshTokenHash
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
      if (session.refreshTokenHash) {
        const valid = await bcrypt.compare(refreshToken, session.refreshTokenHash);
        if (valid) {
          matchedSession = session;
          break;
        }
      }
    }

    if (!matchedSession) {
      throw new AppError(ErrorCodes.AUTH_REQUIRED, 'Invalid or expired refresh token.', 401);
    }

    const user = matchedSession.user;

    if (user.status !== 'ACTIVE') {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Account suspended.', 403);
    }

    // Revoke old session
    await this.prisma.session.update({
      where: { id: matchedSession.id },
      data: { revokedAt: new Date() },
    });

    // Collect roles and permissions from current DB state
    const userWithRoles = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: {
        userRoles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
    });

    const roles = userWithRoles.userRoles.map((ur) => ur.role.code);
    const permissionsSet = new Set<string>();
    for (const ur of userWithRoles.userRoles) {
      for (const rp of ur.role.permissions) {
        permissionsSet.add(rp.permission.code);
      }
    }
    const permissions = Array.from(permissionsSet);

    // Create new session with fresh tokens
    return this.createSession(user.id, user.email, roles, permissions, ipAddress, userAgent);
  }

  async logout(sessionId: string) {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
            branch: true,
          },
        },
        defaultBranch: true,
      },
    });

    const permissionsSet = new Set<string>();
    for (const ur of user.userRoles) {
      for (const rp of ur.role.permissions) {
        permissionsSet.add(rp.permission.code);
      }
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
        roleCode: ur.role.code,
        roleName: ur.role.name,
        branchId: ur.branchId,
        branchName: ur.branch?.name,
        warehouseId: ur.warehouseId,
      })),
    };
  }

  /** @deprecated Use getMe instead */
  async me(userId: string) {
    return this.getMe(userId);
  }
}