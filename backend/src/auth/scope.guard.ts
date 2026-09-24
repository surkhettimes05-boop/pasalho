import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../database/prisma.service';
import { SCOPE_KEY, ScopeType } from './decorators/require-scope.decorator';
import { AppError } from '../common/errors/app-error';
import { ErrorCodes } from '../common/errors/error-codes';

/**
 * ScopeGuard enforces that the acting user has a role explicitly assigned
 * to the branch or warehouse owning the requested resource.
 *
 * Users with a global admin role (branchId = null on a userRole) are
 * always allowed through.
 *
 * Resource IDs are resolved server-side so changing an ID in a request
 * cannot bypass the branch or warehouse assignment.
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

    // Load user's role assignments from DB
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.userId },
      select: { branchId: true, warehouseId: true },
    });

    // Global admin: has at least one role with no branch restriction
    const isGlobalAdmin = userRoles.some((r) => r.branchId === null && r.warehouseId === null);
    if (isGlobalAdmin) return true;

    const targets = await this.resolveTargets(scope, request);
    if (targets.branchIds.length === 0 && targets.warehouseIds.length === 0) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        'A branch or warehouse scope is required for this operation.',
        400,
      );
    }

    const hasBranchAccess = targets.branchIds.every((branchId) =>
      userRoles.some((role) => role.branchId === branchId) ||
      [...targets.warehouseBranches].some(([warehouseId, owningBranchId]) =>
        owningBranchId === branchId && userRoles.some((role) => role.warehouseId === warehouseId),
      ),
    );
    const hasWarehouseAccess = targets.warehouseIds.every((warehouseId) =>
      userRoles.some((role) =>
        role.warehouseId === warehouseId ||
        (role.branchId !== null && role.branchId === targets.warehouseBranches.get(warehouseId)),
      ),
    );
    const hasAccess = hasBranchAccess && hasWarehouseAccess;

    if (!hasAccess) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'You do not have access to the requested resource scope.',
        403,
      );
    }

    return true;
  }

  private async resolveTargets(scope: ScopeType, request: any) {
    const body = request.body ?? {};
    const query = request.query ?? {};
    const params = request.params ?? {};
    const branchIds = new Set<string>();
    const warehouseIds = new Set<string>();
    const warehouseBranches = new Map<string, string>();
    const add = (set: Set<string>, value?: string) => {
      if (value) set.add(value);
    };
    const addWarehouse = async (warehouseId?: string) => {
      if (!warehouseId) return;
      warehouseIds.add(warehouseId);
      const warehouse = await this.prisma.warehouse.findUnique({
        where: { id: warehouseId },
        select: { branchId: true },
      });
      if (warehouse) warehouseBranches.set(warehouseId, warehouse.branchId);
    };

    if (scope === 'branch') {
      add(branchIds, body.branchId ?? query.branchId ?? params.branchId ?? params.id);
    } else if (scope === 'warehouse') {
      await addWarehouse(body.warehouseId ?? query.warehouseId ?? params.warehouseId ?? params.id);
      const warehouseId = body.warehouseId ?? query.warehouseId ?? params.warehouseId ?? params.id;
      add(branchIds, warehouseBranches.get(warehouseId));
    } else if (scope === 'transfer') {
      add(branchIds, body.fromBranchId ?? query.branchId);
      add(branchIds, body.toBranchId);
      await addWarehouse(body.fromWarehouseId);
      await addWarehouse(body.toWarehouseId);
      const transfer = params.id ? await this.prisma.stockTransfer.findUnique({
        where: { id: params.id },
        select: { fromBranchId: true, toBranchId: true, fromWarehouseId: true, toWarehouseId: true },
      }) : null;
      if (transfer) {
        add(branchIds, transfer.fromBranchId);
        add(branchIds, transfer.toBranchId);
        await addWarehouse(transfer.fromWarehouseId);
        await addWarehouse(transfer.toWarehouseId);
      }
    } else {
      const id = params.id;
      const directBranchId = body.branchId ?? query.branchId;
      const directWarehouseId = body.warehouseId ?? query.warehouseId;
      add(branchIds, directBranchId);
      add(warehouseIds, directWarehouseId);

      if (scope === 'store' && id) {
        const resource = await this.prisma.inventoryLocation.findUnique({ where: { id }, select: { branchId: true, warehouseId: true, type: true } });
        if (resource) {
          add(branchIds, resource.branchId);
          await addWarehouse(resource.warehouseId ?? undefined);
        }
      }
      if (scope === 'sales-rep' && id) {
        const resource = await this.prisma.salesRep.findUnique({ where: { id }, select: { branchId: true } });
        add(branchIds, resource?.branchId);
      }
      if (scope === 'retailer' && id) {
        const resource = await this.prisma.retailer.findUnique({ where: { id }, select: { branchId: true } });
        add(branchIds, resource?.branchId);
      }
      if (scope === 'order' && id) {
        const resource = await this.prisma.salesOrder.findUnique({ where: { id }, select: { branchId: true } });
        add(branchIds, resource?.branchId ?? undefined);
      }
      if (scope === 'invoice' && id) {
        const resource = await this.prisma.invoice.findUnique({ where: { id }, select: { branchId: true, warehouseId: true } });
        add(branchIds, resource?.branchId);
        await addWarehouse(resource?.warehouseId);
      }
      if (scope === 'invoice' && body.sourceLocationId) {
        const sourceLocation = await this.prisma.inventoryLocation.findUnique({
          where: { id: body.sourceLocationId },
          select: { branchId: true },
        });
        add(branchIds, sourceLocation?.branchId);
      }
      if (scope === 'payment' && id) {
        const resource = await this.prisma.payment.findUnique({ where: { id }, select: { branchId: true } });
        add(branchIds, resource?.branchId);
      }
      if (scope === 'payment' && body.invoiceId) {
        const invoice = await this.prisma.invoice.findUnique({
          where: { id: body.invoiceId },
          select: { branchId: true, warehouseId: true },
        });
        add(branchIds, invoice?.branchId);
        await addWarehouse(invoice?.warehouseId);
      }
      if (scope === 'payment' && body.retailerId) {
        const retailer = await this.prisma.retailer.findUnique({
          where: { id: body.retailerId },
          select: { branchId: true },
        });
        add(branchIds, retailer?.branchId);
      }
    }

    return { branchIds: [...branchIds], warehouseIds: [...warehouseIds], warehouseBranches };
  }
}
