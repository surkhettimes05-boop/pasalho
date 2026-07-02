import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../database/prisma.service';
import { SCOPE_KEY, ScopeType } from './decorators/require-scope.decorator';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';

/**
 * ScopeGuard enforces that the acting user has a role explicitly
 * assigned to the branch or warehouse specified in the incoming request.
 *
 * Users with a global admin role (branchId = null on a userRole) are
 * always allowed through.
 *
 * Resolution order for the target ID:
 *   body.branchId / body.warehouseId
 *   query.branchId / query.warehouseId
 *   params.branchId / params.warehouseId / params.id
 */
@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const scope = this.reflector.getAllAndOverride<ScopeType>(SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No scope restriction on this endpoint
    if (!scope) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new AppError(ErrorCodes.AUTH_REQUIRED, 'Authentication required.', 401);
    }

    const field = scope === 'branch' ? 'branchId' : 'warehouseId';
    const targetId =
      request.body?.[field] ??
      request.query?.[field] ??
      request.params?.[field] ??
      request.params?.id;

    if (!targetId) {
      // No location context provided; deny access to enforce scoping
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        `${field} is required for this operation.`,
        400,
      );
    }

    // Load user's role assignments from DB
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.userId },
      select: { branchId: true, warehouseId: true },
    });

    // Global admin: has at least one role with no branch restriction
    const isGlobalAdmin = userRoles.some((r) => r.branchId === null && r.warehouseId === null);
    if (isGlobalAdmin) return true;

    // Check explicit assignment to the requested location
    const hasAccess = userRoles.some((r) => {
      if (scope === 'branch') return r.branchId === targetId;
      if (scope === 'warehouse') return r.warehouseId === targetId;
      return false;
    });

    if (!hasAccess) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        `You do not have access to this ${scope}.`,
        403,
      );
    }

    return true;
  }
}
