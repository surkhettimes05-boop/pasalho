import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../database/prisma.service';
import { JwtPayload } from './jwt.payload';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sessionId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        userId: true,
        user: { select: { status: true } },
      },
    });

    if (!session || session.user.status !== 'ACTIVE') {
      throw new AppError(ErrorCodes.AUTH_REQUIRED, 'Session expired or user inactive.', 401);
    }

    // Return a lean user context object used throughout the request lifecycle
    return {
      userId: payload.sub,
      email: payload.email,
      sessionId: payload.sessionId,
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
    };
  }
}
