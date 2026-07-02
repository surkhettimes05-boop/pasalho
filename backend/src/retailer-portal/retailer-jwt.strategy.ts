import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RetailerAuthService } from './retailer-auth.service';

interface RetailerJwtPayload {
  sub: string;
  type: string;
  sessionId: string;
  retailerId: string;
}

@Injectable()
export class RetailerJwtStrategy extends PassportStrategy(Strategy, 'retailer-jwt') {
  constructor(
    config: ConfigService,
    private readonly retailerAuthService: RetailerAuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_RETAILER_SECRET') || config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: RetailerJwtPayload) {
    if (payload.type !== 'retailer' || !payload.retailerId) {
      throw new UnauthorizedException();
    }

    const isValid = await this.retailerAuthService.validateRetailerSession(payload.sessionId);
    if (!isValid) {
      throw new UnauthorizedException();
    }

    return { retailerId: payload.retailerId, sessionId: payload.sessionId };
  }
}
