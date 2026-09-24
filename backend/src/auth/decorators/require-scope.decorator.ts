import { SetMetadata } from '@nestjs/common';

export const SCOPE_KEY = 'scope_type';

export type ScopeType =
	| 'branch'
	| 'warehouse'
	| 'store'
	| 'sales-rep'
	| 'retailer'
	| 'order'
	| 'transfer'
	| 'invoice'
	| 'payment';

/**
 * Marks an endpoint as requiring a specific location scope.
 * The guard will verify the request's branchId/warehouseId matches
 * the user's assigned roles.
 *
 * @example
 * Resource scopes resolve the resource ID to its owning branch/warehouse
 * before checking the user's existing role assignments.
 */
export const RequireScope = (scope: ScopeType) => SetMetadata(SCOPE_KEY, scope);
