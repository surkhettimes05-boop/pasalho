# Complete Backend Architecture

## FMCG Distribution Operating System — Production-Grade Backend Blueprint

## 0. Recommended Framework

Use **NestJS** if this system is serious.

Express is flexible, but for this ERP-style backend, NestJS is better because it gives:

```text
modules
dependency injection
guards
pipes
interceptors
decorators
structured architecture
testing support
```

Recommended stack:

```text
Node.js
NestJS
PostgreSQL
Prisma ORM
Redis
BullMQ
Socket.IO / WebSocket Gateway
Docker
```

---

# 1. Backend Philosophy

The backend is not just an API server.

It is the **transaction authority** of the company.

It must control:

```text
inventory correctness
financial correctness
permission enforcement
audit trail
branch isolation
offline sync validation
idempotency
concurrency safety
```

Frontend should never directly decide stock, ledger, credit, or approval outcomes.

---

# 2. Backend Folder Structure

```text
src/
  main.ts
  app.module.ts

  config/
    env.schema.ts
    database.config.ts
    redis.config.ts
    app.config.ts

  common/
    decorators/
      current-user.decorator.ts
      permissions.decorator.ts
      branch-scope.decorator.ts

    guards/
      jwt-auth.guard.ts
      rbac.guard.ts
      branch-scope.guard.ts
      device.guard.ts

    interceptors/
      audit.interceptor.ts
      logging.interceptor.ts
      response.interceptor.ts
      idempotency.interceptor.ts

    filters/
      http-exception.filter.ts
      prisma-exception.filter.ts

    pipes/
      validation.pipe.ts
      parse-uuid.pipe.ts

    dto/
      pagination.dto.ts
      date-range.dto.ts

    errors/
      app-error.ts
      error-codes.ts

    utils/
      money.util.ts
      unit-conversion.util.ts
      pagination.util.ts

  database/
    prisma.service.ts
    transaction.service.ts

  auth/
    auth.module.ts
    auth.controller.ts
    auth.service.ts
    dto/

  identity/
    users/
    roles/
    permissions/

  organization/
    branches/
    warehouses/
    stores/
    locations/

  catalog/
    products/
    categories/
    brands/
    units/
    batches/
    prices/

  inventory/
    inventory.module.ts
    controllers/
      inventory-query.controller.ts
      stock-transfer.controller.ts
      stock-adjustment.controller.ts
      stock-count.controller.ts
    services/
      inventory-ledger.service.ts
      inventory-snapshot.service.ts
      inventory-lock.service.ts
      inventory-reconciliation.service.ts
      stock-transfer.service.ts
      stock-adjustment.service.ts
      expiry.service.ts
    repositories/
      inventory.repository.ts
      stock-transfer.repository.ts
    dto/
    events/

  sales/
    orders/
    invoices/
    returns/

  finance/
    payments/
    retailer-ledger/
    financial-ledger/
    cash-sessions/

  procurement/
    suppliers/
    purchase-orders/
    grn/

  production/
    bom/
    production-runs/

  logistics/
    routes/
    vehicles/
    deliveries/

  analytics/
    analytics.module.ts
    analytics.controller.ts
    analytics.service.ts
    repositories/

  barcode/
    barcode.module.ts
    barcode.controller.ts
    barcode.service.ts

  notifications/
    notifications.module.ts
    notifications.gateway.ts
    notifications.service.ts

  events/
    domain-event.module.ts
    domain-event.service.ts
    event-bus.service.ts
    handlers/

  queues/
    queue.module.ts
    queue.service.ts
    processors/
      offline-sync.processor.ts
      report.processor.ts
      expiry.processor.ts
      notification.processor.ts

  audit/
    audit.module.ts
    audit.service.ts
    audit.repository.ts

  websocket/
    websocket.module.ts
    app.gateway.ts

  health/
    health.controller.ts
```

---

# 3. Service Boundary Philosophy

Each module should own its business rules.

Example:

```text
InventoryService owns stock movement rules.
InvoiceService owns invoice posting rules.
PaymentService owns payment allocation rules.
ProductionService owns production run rules.
```

No module should directly mutate another module’s tables casually.

For cross-module operations, use application services.

Example:

```text
InvoicePostingService
  → creates invoice
  → calls InventoryLedgerService
  → calls RetailerLedgerService
  → calls FinancialLedgerService
  → creates audit log
```

This keeps transactional workflows explicit.

---

# 4. Controller Structure

Controllers should be thin.

They only handle:

```text
request parsing
auth context
DTO validation
calling services
returning response
```

They should not contain business logic.

Example structure:

```text
POST /api/v1/invoices
Controller → InvoiceService.createDraft()

POST /api/v1/invoices/:id/post
Controller → InvoicePostingService.postInvoice()
```

Important distinction:

```text
create draft ≠ post transaction
```

Posting is what affects inventory and finance.

---

# 5. Repository Pattern

Use repositories for database access, but do not put business logic inside them.

Repository responsibilities:

```text
query database
create records
update records
lock rows
read snapshots
```

Service responsibilities:

```text
validate business rules
decide workflow
call repositories
control transactions
emit events
```

Example:

```text
InventoryRepository.lockSnapshotForUpdate()
InventoryLedgerService.validateAndPostMovement()
```

---

# 6. Validation Architecture

Use layered validation.

## Layer 1 — DTO validation

Use `class-validator` or Zod.

Checks:

* required fields
* UUID format
* numeric ranges
* enum values

## Layer 2 — Business validation

Inside service.

Checks:

* stock availability
* branch access
* batch expiry
* credit limit
* invoice status
* transfer state transition

## Layer 3 — Database constraints

PostgreSQL constraints:

* unique indexes
* foreign keys
* check constraints
* not null
* transaction isolation

Never rely on frontend validation.

---

# 7. Authentication Architecture

Use JWT access token + refresh token.

Recommended:

```text
Access token: short-lived
Refresh token: longer-lived
Device-bound session
```

Auth context should include:

```text
user_id
role_ids
branch_ids
warehouse_ids
store_ids
permissions
device_id
```

Middleware/guard should attach:

```ts
request.user
```

containing scoped identity.

---

# 8. RBAC Middleware / Guards

RBAC must enforce both:

```text
feature permission
+
data scope
```

Example:

```text
Permission: inventory.transfer.create
Scope: branch_id = Surkhet
```

A user may have permission to create stock transfer, but only inside assigned branch.

Use guards:

```text
JwtAuthGuard
RbacGuard
BranchScopeGuard
DeviceGuard
```

Example decorator style:

```text
@RequirePermission('inventory.transfer.create')
@RequireBranchScope()
```

Rules:

```text
Super Admin: all scopes
Branch Manager: assigned branches
Warehouse Manager: assigned warehouse
Store Staff: assigned store only
Sales Rep: assigned route/retailers only
```

---

# 9. Error Handling

Use standardized error responses.

Response shape:

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Not enough available stock for this batch.",
    "details": {}
  },
  "requestId": "..."
}
```

Error categories:

```text
VALIDATION_ERROR
AUTH_REQUIRED
FORBIDDEN
NOT_FOUND
CONFLICT
INSUFFICIENT_STOCK
EXPIRED_BATCH
CREDIT_LIMIT_EXCEEDED
IDEMPOTENCY_CONFLICT
TRANSACTION_FAILED
RATE_LIMITED
INTERNAL_ERROR
```

Prisma errors must be mapped cleanly.

---

# 10. Logging

Use structured logging.

Recommended:

```text
Pino
```

Every request log should include:

```text
request_id
user_id
branch_id
method
path
status_code
duration_ms
ip
device_id
```

Critical business logs:

```text
invoice posted
stock deducted
payment received
stock adjusted
transfer dispatched
transfer received
sync conflict
```

Do not log sensitive secrets.

---

# 11. Event System

Use domain events for internal workflows.

Example events:

```text
InvoicePosted
PaymentReceived
StockTransferDispatched
StockTransferReceived
StockLowDetected
BatchExpired
ProductionCompleted
RetailerCreditLimitExceeded
```

Events should be stored in `domain_events`.

Why:

* auditability
* async processing
* notifications
* analytics updates
* future AI pipeline

Pattern:

```text
Business transaction commits
↓
Domain event stored
↓
Queue processor handles async tasks
```

Do not send notifications before transaction commits.

---

# 12. Queue System

Use Redis + BullMQ.

Queues:

```text
syncQueue
reportQueue
notificationQueue
expiryQueue
analyticsQueue
printQueue
```

## Jobs

```text
process offline sync
generate daily reports
send low-stock notification
mark expired batches
rebuild inventory snapshots
generate invoice PDF
process analytics aggregation
```

Critical rule:

> Background jobs must be idempotent.

A failed job retry should not duplicate invoices, payments, or stock movements.

---

# 13. Caching Strategy

Use Redis carefully.

Cache only read-heavy, non-sacred data.

Good cache candidates:

```text
product catalog
permissions
settings
dashboard summaries
price lists
routes
low-stock summaries
```

Do not treat cache as source of truth.

Avoid caching:

```text
live stock deduction decisions
payment posting decisions
credit ledger posting
```

For inventory availability, cache can assist display, but final validation must hit PostgreSQL with locking.

---

# 14. WebSocket Strategy

Use WebSockets for real-time updates.

Channels:

```text
branch:{branchId}
warehouse:{warehouseId}
store:{storeId}
user:{userId}
```

Events:

```text
stock.updated
invoice.posted
payment.received
transfer.dispatched
transfer.received
low_stock.alert
sync.conflict
delivery.status_changed
```

Rules:

* WebSocket is notification layer only.
* Never use WebSocket as transaction authority.
* Client must refetch authoritative data after critical update.

---

# 15. Background Jobs

Required jobs:

```text
daily inventory snapshot verification
near-expiry detection
expired batch blocking
low-stock alert generation
daily sales report aggregation
retailer ledger aging
cash session reminder
offline sync conflict review
failed print retry
database cleanup for temporary queues
```

---

# 16. REST API Architecture

Base format:

```text
/api/v1/{resource}
```

Use nouns, not verbs, except action endpoints for business state transitions.

Examples:

```text
GET    /api/v1/products
POST   /api/v1/products

POST   /api/v1/invoices
POST   /api/v1/invoices/:id/post
POST   /api/v1/invoices/:id/void
```

Reason: posting/voiding are domain actions, not simple CRUD.

---

# 17. API Versioning Strategy

Start with:

```text
/api/v1
```

Never break v1 once mobile/PWA clients depend on it.

Future:

```text
/api/v2
```

Use versioning when:

* response shape changes
* business behavior changes
* field semantics change

---

# 18. Pagination Strategy

Use cursor pagination for large tables.

For admin list pages, allow:

```text
?page=1&limit=50
```

For ledgers and movements, prefer cursor:

```text
?cursor=2026-05-27T10:00:00Z&limit=100
```

Response:

```json
{
  "data": [],
  "pagination": {
    "limit": 50,
    "nextCursor": "...",
    "hasMore": true
  }
}
```

Default limit:

```text
50
```

Max limit:

```text
200
```

---

# 19. Filtering Strategy

Use consistent query parameters:

```text
branchId
warehouseId
storeId
productId
batchId
status
dateFrom
dateTo
search
sortBy
sortOrder
```

Example:

```text
GET /api/v1/inventory/movements?branchId=...&productId=...&dateFrom=...
```

Backend must enforce scoped filters.

If store staff sends another storeId, reject or ignore based on access policy.

---

# 20. Search Strategy

For MVP:

```text
PostgreSQL ILIKE
GIN indexes for trigram search later
```

Searchable:

* products by name/SKU/barcode
* retailers by shop/phone/code
* invoices by invoice number
* suppliers by name/phone

Later:

```text
PostgreSQL full-text search
Meilisearch/Typesense if needed
```

---

# 21. Idempotency Strategy

Required for:

```text
invoice posting
payment receiving
stock transfer dispatch
stock transfer receive
offline sync
production posting
stock adjustment posting
```

Client sends:

```text
Idempotency-Key: uuid
```

Backend stores:

```text
key
user_id
route
request_hash
response_body
status
created_at
```

If same key repeats:

* same request hash → return original response
* different body → return idempotency conflict

This prevents duplicate billing and stock deduction.

---

# 22. Transactional APIs

Critical APIs must use database transactions.

Transactional workflows:

```text
POST /invoices/:id/post
POST /payments
POST /stock-transfers/:id/dispatch
POST /stock-transfers/:id/receive
POST /stock-adjustments/:id/post
POST /production-runs/:id/complete
POST /sales-returns/:id/post
POST /goods-received-notes/:id/post
```

Inside transaction:

```text
validate state
lock rows
insert ledger entries
update snapshots
update document status
create audit log
create domain event
commit
```

---

# 23. Rollback Handling

If transaction fails:

```text
ROLLBACK everything
```

For already-posted business documents, do not delete.

Use reversal endpoints:

```text
POST /api/v1/invoices/:id/void
POST /api/v1/payments/:id/reverse
POST /api/v1/inventory-events/:id/reverse
```

Rollback in database transaction is technical rollback.

Reversal is business rollback.

---

# 24. Retry Safety

Retries are normal because:

* weak internet
* mobile PWA
* offline sync
* user double-tap
* request timeout

All critical endpoints must be:

```text
idempotent
transactional
state-aware
```

Example:
If invoice already posted:

```text
POST /invoices/:id/post
```

should return existing posted invoice, not post again.

---

# 25. Concurrency Handling

For stock-sensitive operations:

Use PostgreSQL row locking:

```sql
SELECT * FROM inventory_snapshots
WHERE location_id = $1
AND product_id = $2
AND batch_id = $3
AND stock_state = 'AVAILABLE'
FOR UPDATE;
```

Then validate stock and update.

For ledger balance updates:

* lock retailer ledger account row if maintained
* or compute balance transactionally

For document status:

* include status transition validation

Example:

```text
DRAFT → POSTED allowed
POSTED → POSTED not allowed
POSTED → VOIDED allowed with permission
```

---

# 26. Rate Limiting

Use Redis-backed rate limiting.

Rules:

```text
login: strict
barcode search: medium
analytics: medium
sync: controlled
public endpoints: strict
internal authenticated APIs: reasonable
```

Example:

* login: 5 attempts/minute
* general API: 100 requests/minute/user
* barcode lookup: 300 requests/minute/store device
* sync endpoint: batch-based limit

---

# 27. Audit Logging

Audit logs should be automatic and explicit.

Automatic:

* user login
* failed login
* permission denied
* data update

Explicit:

* invoice posted
* payment reversed
* stock adjusted
* transfer approved
* product price changed
* credit limit changed

Audit record:

```text
actor_user_id
branch_id
device_id
action
entity_type
entity_id
before_data
after_data
reason
ip
timestamp
```

Critical actions require reason.

---

# 28. API Modules

## Inventory APIs

```text
GET    /api/v1/inventory/snapshots
GET    /api/v1/inventory/movements
GET    /api/v1/inventory/locations/:id/stock
POST   /api/v1/inventory/reservations
POST   /api/v1/inventory/reservations/:id/release
POST   /api/v1/inventory/adjustments
POST   /api/v1/inventory/adjustments/:id/submit
POST   /api/v1/inventory/adjustments/:id/approve
POST   /api/v1/inventory/adjustments/:id/post
POST   /api/v1/inventory/stock-counts
POST   /api/v1/inventory/stock-counts/:id/submit
POST   /api/v1/inventory/stock-counts/:id/approve
POST   /api/v1/inventory/stock-counts/:id/post
```

---

## Stock Transfer APIs

```text
GET    /api/v1/stock-transfers
POST   /api/v1/stock-transfers
GET    /api/v1/stock-transfers/:id
POST   /api/v1/stock-transfers/:id/approve
POST   /api/v1/stock-transfers/:id/dispatch
POST   /api/v1/stock-transfers/:id/receive
POST   /api/v1/stock-transfers/:id/cancel
```

---

## Invoice APIs

```text
GET    /api/v1/invoices
POST   /api/v1/invoices
GET    /api/v1/invoices/:id
POST   /api/v1/invoices/:id/post
POST   /api/v1/invoices/:id/void
GET    /api/v1/invoices/:id/receipt
POST   /api/v1/invoices/:id/print
```

---

## Order APIs

```text
GET    /api/v1/orders
POST   /api/v1/orders
GET    /api/v1/orders/:id
POST   /api/v1/orders/:id/confirm
POST   /api/v1/orders/:id/allocate
POST   /api/v1/orders/:id/cancel
```

---

## Retailer APIs

```text
GET    /api/v1/retailers
POST   /api/v1/retailers
GET    /api/v1/retailers/:id
PATCH  /api/v1/retailers/:id
GET    /api/v1/retailers/:id/ledger
GET    /api/v1/retailers/:id/invoices
GET    /api/v1/retailers/:id/payments
```

---

## Sales Rep APIs

```text
GET    /api/v1/sales-reps
POST   /api/v1/sales-reps
GET    /api/v1/sales-reps/:id/routes
GET    /api/v1/sales-reps/:id/orders
GET    /api/v1/sales-reps/:id/collections
```

---

## Warehouse APIs

```text
GET    /api/v1/warehouses
POST   /api/v1/warehouses
GET    /api/v1/warehouses/:id
GET    /api/v1/warehouses/:id/inventory
GET    /api/v1/warehouses/:id/transfers
GET    /api/v1/warehouses/:id/stock-counts
```

---

## Production APIs

```text
GET    /api/v1/boms
POST   /api/v1/boms
POST   /api/v1/production-runs
GET    /api/v1/production-runs/:id
POST   /api/v1/production-runs/:id/reserve-materials
POST   /api/v1/production-runs/:id/start
POST   /api/v1/production-runs/:id/consume-materials
POST   /api/v1/production-runs/:id/receive-output
POST   /api/v1/production-runs/:id/complete
POST   /api/v1/production-runs/:id/cancel
```

---

## Payment APIs

```text
GET    /api/v1/payments
POST   /api/v1/payments
GET    /api/v1/payments/:id
POST   /api/v1/payments/:id/reverse
GET    /api/v1/cash-sessions/current
POST   /api/v1/cash-sessions/open
POST   /api/v1/cash-sessions/:id/close
```

---

## Analytics APIs

```text
GET /api/v1/analytics/dashboard
GET /api/v1/analytics/sales-summary
GET /api/v1/analytics/inventory-turnover
GET /api/v1/analytics/low-stock
GET /api/v1/analytics/dead-stock
GET /api/v1/analytics/retailer-aging
GET /api/v1/analytics/branch-performance
GET /api/v1/analytics/sku-velocity
```

Analytics should be read-optimized and cached.

---

## Barcode APIs

```text
GET  /api/v1/barcodes/:code
POST /api/v1/barcodes/assign
POST /api/v1/barcodes/scan-event
```

Barcode lookup should return:

```text
product
unit
price
available stock for current store/location
batch options if needed
```

---

# 29. Backend State Transition Rules

Every document should have controlled state transitions.

Example invoice:

```text
DRAFT → POSTED
POSTED → PAID
POSTED → PARTIALLY_PAID
POSTED → VOIDED
```

Invalid:

```text
VOIDED → POSTED
PAID → DRAFT
```

Use state machine helpers per module.

---

# 30. Final Backend Position

Build backend as:

```text
NestJS modular monolith
PostgreSQL transaction authority
Prisma controlled data access
Redis for queues/cache/rate limit
BullMQ for async jobs
WebSockets for real-time notifications
RBAC + branch scope enforced everywhere
ledger-first inventory and finance
idempotency-protected critical APIs
audit-heavy operational backend
```

The backend should not be optimized for “fast demo.”

It should be optimized for:

```text
no duplicate bills
no wrong stock
no invisible edits
no unauthorized access
no broken branch isolation
no fake reports
```
