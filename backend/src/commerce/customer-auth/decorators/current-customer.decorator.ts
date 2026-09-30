import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CustomerPrincipal } from '../customer-jwt.guard';

export const CurrentCustomer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CustomerPrincipal =>
    ctx.switchToHttp().getRequest().customer,
);
