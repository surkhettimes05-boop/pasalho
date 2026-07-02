import { SetMetadata } from '@nestjs/common';

export const SCOPE_KEY = 'scope_type';

export type ScopeType = 'branch' | 'warehouse';

/**
 * Marks an endpoint as requiring a specific location scope.
 * The guard will verify the request's branchId/warehouseId matches
 * the user's assigned roles.
 *
 * @example
 * @RequireScope('branch')  // reads branchId from body/query/params
 * @RequireScope('warehouse') // reads warehouseId from body/query/params
 */
export const RequireScope = (scope: ScopeType) => SetMetadata(SCOPE_KEY, scope);
