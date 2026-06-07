import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';

export const PERMISSIONS_KEY = 'permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new AppError(ErrorCodes.AUTH_REQUIRED, 'Authentication required.', 401);
    }

    const hasAll = required.every((p) => (user.permissions as string[])?.includes(p));
    if (!hasAll) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'You do not have permission to perform this action.', 403);
    }

    return true;
  }
}
