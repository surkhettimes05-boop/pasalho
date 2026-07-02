import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../database/prisma.service';

describe('AuthService', () => {
  let auth: AuthService;
  let prisma: Partial<Record<keyof PrismaService, any>>;

  beforeAll(async () => {
    // Mock Redis
    const mockRedis = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      disconnect: jest.fn(),
    };

    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      loginAttempt: { create: jest.fn() },
      device: { upsert: jest.fn() },
      session: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
      passwordResetToken: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    } as any;

    const jwt = { sign: jest.fn(() => 'access-token') };
    const config = { get: jest.fn(() => 'redis://localhost:6379') };
    const audit = { record: jest.fn() };

    // We suppress the actual Redis connection by mocking onModuleInit
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
        { provide: AuditLogService, useValue: audit },
      ],
    }).compile();

    auth = module.get(AuthService);
    // Override the real redis with mock
    (auth as any).redis = mockRedis;
  });

  describe('login', () => {
    it('throws 401 for unknown user', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(auth.login({ login: 'nonexist@test.com', password: 'x' })).rejects.toThrow(
        'Invalid credentials.',
      );
    });

    it('throws 401 for wrong password', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'u1',
        email: 'test@test.com',
        phone: '9800000000',
        status: 'ACTIVE',
        passwordHash: '$2a$10$doesnotmatch',
        userRoles: [],
      });
      await expect(auth.login({ login: 'test@test.com', password: 'wrong' })).rejects.toThrow(
        'Invalid credentials.',
      );
    });

    it('throws 403 for suspended account', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'u1',
        email: 'suspended@test.com',
        phone: '9800000000',
        status: 'SUSPENDED',
        passwordHash: 'x',
        userRoles: [],
      });
      await expect(auth.login({ login: 'suspended@test.com', password: 'x' })).rejects.toThrow(
        'Account suspended.',
      );
    });
  });

  describe('logout', () => {
    it('revokes session and clears Redis cache', async () => {
      (prisma.session.update as jest.Mock).mockResolvedValue({});
      await expect(auth.logout('session-1', 'user-1')).resolves.not.toThrow();
      expect(prisma.session.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect((auth as any).redis.del).toHaveBeenCalledWith('session:session-1:valid');
    });
  });

  describe('forgot/reset password', () => {
    it('returns generic message even if email not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const result = await auth.forgotPassword('nobody@test.com');
      expect(result.message).toContain('If the email exists');
    });
  });
});
