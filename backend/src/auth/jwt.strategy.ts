import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from './auth.service';
import { JwtPayload } from './jwt.payload';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService, // kept just in case, though we could query user status
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const isValid = await this.authService.validateSession(payload.sessionId);
    if (!isValid) {
      throw new AppError(ErrorCodes.AUTH_REQUIRED, 'Session expired or invalid.', 401);
    }
    
    // Check if user is active (could also be cached in Redis)
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { status: true } });
    if (!user || user.status !== 'ACTIVE') {
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
