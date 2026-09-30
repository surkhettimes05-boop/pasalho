import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { CustomerTokenService } from './customer-token.service';
import { AppError } from '../../common/errors/app-error';
import { ErrorCodes } from '../../common/errors/error-codes';

export interface CustomerPrincipal {
  customerId: string;
  sessionId: string;
}

@Injectable()
export class CustomerJwtGuard implements CanActivate {
  constructor(private readonly tokens: CustomerTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization as string | undefined;
    const [scheme, token] = authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new AppError(ErrorCodes.CUSTOMER_AUTH_REQUIRED, 'Customer authentication required.', 401);
    }

    const payload = await this.tokens.verifyAccessToken(token);
    request.customer = { customerId: payload.sub, sessionId: payload.sessionId } satisfies CustomerPrincipal;
    return true;
  }
}
