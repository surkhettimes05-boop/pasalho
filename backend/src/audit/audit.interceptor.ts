import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from './audit-log.service';
import { AuditAction, ReferenceType } from '@prisma/client';

type ActionMap = { [method: string]: AuditAction };

/**
 * URL segment -> { HTTP Method -> AuditAction, referenceType }
 * Derived from the actual AuditAction and ReferenceType enums in schema.prisma.
 */
const SEGMENT_MAP: Record<string, { ref: ReferenceType; actions: ActionMap }> = {
  auth: {
    ref: ReferenceType.AUTH,
    actions: {
      POST: AuditAction.LOGIN_SUCCESS,
      DELETE: AuditAction.LOGIN_FAILURE,
    },
  },
  users: {
    ref: ReferenceType.USER,
    actions: {
      POST: AuditAction.USER_CREATED,
      PUT: AuditAction.USER_UPDATED,
      PATCH: AuditAction.USER_UPDATED,
    },
  },
  roles: {
    ref: ReferenceType.ROLE,
    actions: {
      POST: AuditAction.ROLE_ASSIGNED,
      PATCH: AuditAction.ROLE_ASSIGNED,
    },
  },
  branches: {
    ref: ReferenceType.BRANCH,
    actions: {
      POST: AuditAction.BRANCH_CREATED,
      PUT: AuditAction.BRANCH_UPDATED,
      PATCH: AuditAction.BRANCH_UPDATED,
      DELETE: AuditAction.BRANCH_DEACTIVATED,
    },
  },
  warehouses: {
    ref: ReferenceType.WAREHOUSE,
    actions: {
      POST: AuditAction.WAREHOUSE_CREATED,
      PUT: AuditAction.WAREHOUSE_UPDATED,
      PATCH: AuditAction.WAREHOUSE_UPDATED,
      DELETE: AuditAction.WAREHOUSE_DEACTIVATED,
    },
  },
  categories: {
    ref: ReferenceType.PRODUCT,
    actions: {
      POST: AuditAction.CATEGORY_CREATED,
      PUT: AuditAction.CATEGORY_UPDATED,
      PATCH: AuditAction.CATEGORY_UPDATED,
    },
  },
  products: {
    ref: ReferenceType.PRODUCT,
    actions: {
      POST: AuditAction.PRODUCT_CREATED,
      PUT: AuditAction.PRODUCT_UPDATED,
      PATCH: AuditAction.PRODUCT_UPDATED,
    },
  },
  batches: {
    ref: ReferenceType.BATCH,
    actions: {
      POST: AuditAction.BATCH_CREATED,
      PUT: AuditAction.BATCH_UPDATED,
      PATCH: AuditAction.BATCH_UPDATED,
    },
  },
  'stock-adjustments': {
    ref: ReferenceType.STOCK_ADJUSTMENT,
    actions: {
      POST: AuditAction.STOCK_ADJUSTMENT_CREATED,
      PUT: AuditAction.STOCK_ADJUSTMENT_SUBMITTED,
      PATCH: AuditAction.STOCK_ADJUSTMENT_SUBMITTED,
    },
  },
  invoices: {
    ref: ReferenceType.INVOICE,
    actions: {
      POST: AuditAction.INVOICE_CREATED,
      PUT: AuditAction.INVOICE_UPDATED,
      PATCH: AuditAction.INVOICE_UPDATED,
    },
  },
  payments: {
    ref: ReferenceType.PAYMENT,
    actions: {
      POST: AuditAction.PAYMENT_RECORDED,
    },
  },
  retailers: {
    ref: ReferenceType.RETAILER,
    actions: {
      POST: AuditAction.RETAILER_CREATED,
      PUT: AuditAction.RETAILER_UPDATED,
      PATCH: AuditAction.RETAILER_UPDATED,
    },
  },
  'sales-reps': {
    ref: ReferenceType.SALES_REP,
    actions: {
      POST: AuditAction.SALES_REP_CREATED,
      PUT: AuditAction.SALES_REP_UPDATED,
      PATCH: AuditAction.SALES_REP_UPDATED,
    },
  },
};

const SKIP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Globally intercepts all state-changing HTTP requests (POST, PUT, PATCH, DELETE)
 * and writes an AuditLog entry after the response succeeds.
 *
 * Fires asynchronously — never blocks the client response.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip, headers, user, body, params } = request;

    // Skip read-only requests or unauthenticated routes
    if (SKIP_METHODS.has(method as string) || !user) {
      return next.handle();
    }

    const userAgent = headers?.['user-agent'] as string | undefined;
    const { action, ref } = this.resolveAuditMeta(url as string, method as string);

    // If we can't map to a known action, skip to avoid invalid data
    if (!action) return next.handle();

    const entityId =
      (params?.id as string) ??
      (params?.deviceId as string) ??
      (body?.id as string) ??
      'unknown';

    return next.handle().pipe(
      tap(() => {
        this.audit
          .record({
            actorUserId: user.userId ?? 'system',
            action,
            entityType: ref,
            entityId,
            branchId: (body?.branchId as string | undefined) ?? undefined,
            afterData: body ?? undefined,
            ipAddress: ip as string,
            userAgent,
          })
          .catch((err) => {
            console.error('[AuditInterceptor] Failed to write audit log:', err);
          });
      }),
    );
  }

  private resolveAuditMeta(
    url: string,
    method: string,
  ): { action: AuditAction | null; ref: ReferenceType } {
    // Extract the first meaningful path segment after /api/v1/
    const segments = url.replace(/^\/api\/v\d+\//, '').split('/');
    const segment = segments[0] ?? '';

    const mapping = SEGMENT_MAP[segment];
    if (!mapping) {
      return { action: null, ref: ReferenceType.AUTH };
    }

    const action = mapping.actions[method] ?? null;
    return { action, ref: mapping.ref };
  }
}
