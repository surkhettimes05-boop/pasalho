# PASALO OS — Phase 4 Implementation Checklist

## Phase 4: Transfers & Reconciliation Maturity

### Objective
Strengthen inventory trust through physical counting, variance handling, damage workflows, and expiry detection.

---

## ✅ Completed

### Schema — New Models
- [x] `DamageReport` — reportNo, branchId, warehouseId, locationId, status (DRAFT→SUBMITTED→APPROVED→POSTED→REJECTED), reason, approval chain
- [x] `DamageReportItem` — productId, batchId, unitId, quantity, baseQuantity, damageType (PHYSICAL/EXPIRED/WATER/PEST/OTHER)
- [x] `ExpiryEvent` — batchId, productId, locationId, expiryDate, daysToExpiry, isActedUpon, actionNote
- [x] `DamageReportStatus` enum
- [x] New `AuditAction` values: STOCK_COUNT_STARTED, STOCK_COUNT_SUBMITTED, STOCK_COUNT_RECONCILED, DAMAGE_REPORTED, DAMAGE_APPROVED, DAMAGE_POSTED, EXPIRY_DETECTED, BATCH_BLOCKED, BATCH_EXPIRED
- [x] New `ReferenceType` values: STOCK_COUNT, DAMAGE_REPORT

### Schema — Already existed (Phase 1)
- [x] `StockCount` model (branchId, warehouseId, locationId, status, countedById)
- [x] `StockCountItem` (systemQuantity, countedQuantity, variance, isReconciled)
- [x] `StockAdjustment` DRAFT→SUBMITTED→APPROVED→POSTED workflow

### Backend — Stock Count / Reconciliation (already built in Phase 1)
- [x] `InventoryReconciliationService` — startStockCount, updateCount, submit, reconcile
- [x] `InventoryReconciliationController` — POST /start, GET /sessions, GET /sessions/:id, POST update/submit/reconcile
- [x] Auto-generates + posts StockAdjustment on reconcile for all variance items
- [x] Prevents duplicate active counts per location

### Backend — Damage Reports (new Phase 4)
- [x] `DamageReportService` — list, findById, create, submit, approve, reject, post
- [x] `post()` — deducts from AVAILABLE, credits DAMAGED state via InventoryLedgerService
- [x] `DamageReportController` — full CRUD + workflow at `/inventory/damage-reports`
- [x] Registered in InventoryModule

### Backend — Expiry Detection (new Phase 4)
- [x] `ExpiryService` — scanExpiringBatches, listExpiryEvents, getExpirySummary, markActedUpon, blockBatch
- [x] Scans within configurable daysAhead window (default 60)
- [x] Auto-blocks expired batches and emits audit records
- [x] Deduplicates — won't create a second UNREAD event for already-flagged batch+location
- [x] Summary endpoint returns counts by urgency band (expired, 7d, 30d, 60d)
- [x] `ExpiryController` — at `/inventory/expiry`
- [x] Registered in InventoryModule

### Frontend — Stock Counts (new Phase 4)
- [x] `/stock/counts` — list page with status + counter info
- [x] `/stock/counts/new` — start session form (branch/warehouse picker, auto-resolves locationId)
- [x] `/stock/counts/[id]` — count entry table with inline editing, variance highlighting, save/submit/reconcile actions
- [x] `stockCountApi` in `lib/api/phase4.ts`

### Frontend — Damage Reports (new Phase 4)
- [x] `/stock/damage` — list with status filter
- [x] `/stock/damage/new` — create form with product search, quantity, damage type per line
- [x] `/stock/damage/[id]` — detail with submit/approve/reject (inline reason input)/post workflow
- [x] `damageApi` in `lib/api/phase4.ts`

### Frontend — Expiry Dashboard (new Phase 4)
- [x] `/stock/expiry` — full expiry dashboard
- [x] Summary cards (expired / ≤7d / ≤30d / ≤60d)
- [x] Filter tabs by urgency band
- [x] Per-row Block Batch and Mark Actioned buttons
- [x] "Scan Expiring Batches" trigger (on-demand, also run from backend as cron)
- [x] `expiryApi` in `lib/api/phase4.ts`

### Frontend — Navigation
- [x] Sidebar updated: Stock Counts, Damage Reports, Expiry Dashboard under Catalog & Stock section

---

## ⏳ Phase 5 Backlog

- Retailer self-ordering portal/PWA
- WhatsApp-assisted ordering
- Retailer account visibility (invoice history, payment history)
- Quick reorder recommendations

---

## One step needed before running

Apply schema migrations to the database:

```bash
cd backend
npm run db:migrate -- --name phase4-damage-expiry
# or for dev:
npm run db:push
```

---

## Validation Metrics (Phase 4 targets)

| Metric | Target |
|---|---|
| Inventory accuracy after reconciliation | > 99% |
| Unexplained shrinkage visible | Yes |
| Damage approval completeness | 100% audited |
| Expiry detection lead time | ≥ 60 days warning |
