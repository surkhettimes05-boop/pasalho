import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
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

    // Create session (tokenHash populated after signing)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const session = await this.prisma.session.create({
      data: { userId: user.id, tokenHash: '', expiresAt, ipAddress, userAgent },
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      sessionId: session.id,
      roles,
      permissions,
    };
    const accessToken = this.jwt.sign(payload);

    // Store a hash of the token in the session for revocation checks
    const tokenHash = await bcrypt.hash(accessToken, 4);
    await this.prisma.session.update({ where: { id: session.id }, data: { tokenHash } });

    // Record success
    await this.prisma.loginAttempt.create({
      data: { userId: user.id, email: user.email, success: true, ipAddress, userAgent },
    });

    await this.audit.record({
      actorUserId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'AUTH',
      entityId: user.id,
      ipAddress,
      userAgent,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      userId: user.id,
      permissions,
    };
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
