# PASALO OS — Phase 2 Implementation Checklist

## Phase 2: Warehouse Execution (Warehouse + Sales Rep Operations)

### Objective
Operationalize warehouse and route execution.

---

## Included Modules

| Module | Status |
|---|---|
| Stock transfers | ✅ Complete (backend + frontend) |
| Routes management | ✅ Complete (backend + frontend) |
| Sales orders | ✅ Complete (backend + frontend) |
| Warehouse dispatch | ✅ (part of stock transfers) |
| Warehouse receive | ✅ (part of stock transfers) |
| Delivery management | ✅ Complete (backend + frontend) |
| Sales rep mobile app | ⏳ Phase 3 (requires native/PWA shell) |
| Offline order capture | ⏳ Phase 3 |
| Vehicle stock tracking | ✅ (via Delivery vehicleRef + items) |
| Low stock alerts | ✅ Complete (notification engine + frontend) |
| Notifications | ✅ Complete (backend + frontend) |

## Excluded Modules (Phase 3+)

- Production
- Credit ledger
- Financial ledger
- Forecasting
- Procurement intelligence
- Advanced reconciliation
- Native mobile app shell (offline-first PWA for field reps)

---

## ✅ Completed Items

### Database Schema
- [x] StockTransfer model (existing)
- [x] StockTransferItem model with variance tracking fields
- [x] StockTransferStatus enum
- [x] Route model (branchId, salesRepId, code, name, description, status)
- [x] RouteStop model (routeId, retailerId, stopOrder, notes)
- [x] SalesOrder model (orderNo, branchId, salesRepId, routeId, retailerId, status, items, grandTotal, invoiceId)
- [x] SalesOrderItem model (productId, batchId, unitId, quantity, baseQuantity, unitPrice, lineTotal)
- [x] Delivery model (deliveryNo, branchId, routeId, vehicleRef, driverName, status, scheduledAt, dispatchedAt, completedAt)
- [x] DeliveryItem model (deliveryId, retailerId, invoiceId, orderId, isDelivered)
- [x] Notification model (type, status, title, message, entityType, entityId, metadata)
- [x] NotificationType enum (LOW_STOCK, OUT_OF_STOCK, ORDER_CONFIRMED, DELIVERY_UPDATE, SYSTEM)
- [x] RouteStatus, SalesOrderStatus, DeliveryStatus, NotificationStatus enums
- [x] New AuditAction values for all Phase 2 entities
- [x] New ReferenceType values (ROUTE, SALES_ORDER, DELIVERY, NOTIFICATION)

### Backend — Stock Transfers (existing)
- [x] StockTransferService (create, list, findById, ship, receive)
- [x] TransferController (GET list, GET :id, POST create, POST :id/ship, POST :id/receive)
- [x] Variance handling on receive

### Backend — Routes
- [x] RouteService (list, findById, create, update, deactivate)
- [x] RouteController (GET, POST, PATCH, DELETE)
- [x] RouteModule registered in AppModule
- [x] Stop management (create/replace stops in transaction)

### Backend — Sales Orders
- [x] SalesOrderService (list, findById, create, confirm, cancel, convertToInvoice)
- [x] SalesOrderController (GET, POST, POST confirm/cancel/convert-to-invoice)
- [x] SalesOrdersModule registered in AppModule
- [x] InvoiceService exported from SalesModule for order→invoice conversion
- [x] Order→Invoice conversion links invoiceId back to order

### Backend — Deliveries
- [x] DeliveryService (list, findById, create, update, dispatch, complete, cancel, markItemDelivered)
- [x] DeliveryController (GET, POST, PATCH, POST dispatch/complete/cancel, POST items/:itemId/delivered)
- [x] DeliveryModule registered in AppModule
- [x] Vehicle reference + driver name tracking
- [x] Per-item delivery confirmation

### Backend — Notifications
- [x] NotificationService (listForUser, markRead, markAllRead, create, generateLowStockAlerts)
- [x] NotificationController (GET, POST :id/read, POST mark-all-read, POST generate-low-stock-alerts)
- [x] NotificationModule registered in AppModule
- [x] Low-stock scanning (avoids duplicate UNREAD alerts per product+branch)
- [x] Out-of-stock scanning

### Frontend — Stock Transfers (existing)
- [x] Transfers list page (`/transfers`)
- [x] Transfer create page (`/transfers/new`)
- [x] Transfer detail page (`/transfers/[id]`)
- [x] Sidebar navigation link

### Frontend — Routes
- [x] Routes list page (`/routes`)
- [x] Route create page (`/routes/new`) with stop builder (add/reorder/remove)
- [x] Route detail page (`/routes/[id]`) with stop table + quick action buttons
- [x] `routesApi` in `lib/api/routes.ts`

### Frontend — Sales Orders
- [x] Orders list page (`/orders`) with status filter + search
- [x] Order create page (`/orders/new`) with retailer/route/product selectors
- [x] Order detail page (`/orders/[id]`) with confirm/cancel/convert-to-invoice flow
- [x] `salesOrdersApi` in `lib/api/sales-orders.ts`

### Frontend — Deliveries
- [x] Deliveries list page (`/deliveries`) with status filter
- [x] Delivery create page (`/deliveries/new`) with retailer stops
- [x] Delivery detail page (`/deliveries/[id]`) with dispatch/complete/per-item actions + progress bar
- [x] `deliveriesApi` in `lib/api/deliveries.ts`

### Frontend — Notifications
- [x] Notifications page (`/notifications`) with unread badge + all/unread tab
- [x] Mark read / mark all read
- [x] "Scan Low Stock" trigger button
- [x] `notificationsApi` in `lib/api/notifications.ts`

### Frontend — Navigation
- [x] "Field Operations" section: Routes, Sales Orders, Deliveries
- [x] Notifications in Admin section

---

## ⏳ Phase 3 Backlog

### Sales Rep Mobile Dashboard
- [ ] PWA-optimized mobile layout
- [ ] Route-based order capture with touch UI
- [ ] Offline order queue (IndexedDB + Dexie already installed)
- [ ] Background sync on reconnect

### Offline Sync (Full)
- [ ] Extend SyncService for orders + deliveries
- [ ] Conflict resolution strategy
- [ ] Offline indicator UI component

### Infrastructure
- [ ] WebSocket / SSE for real-time notification push
- [ ] Redis-backed notification queue
- [ ] Cron job for scheduled low-stock scans

---

## Validation Metrics

| Metric | Target |
|---|---|
| Transfer variance | < 2% |
| Offline sync success | > 95% |
| Warehouse dispatch accuracy | > 98% |
| Sales rep app crash rate | < 1% |

---

## Engineering Milestones

1. [x] Transfer dispatch safe
2. [x] Transfer receive safe
3. [x] Routes + Sales Orders operational
4. [x] Delivery tracking operational
5. [x] Low-stock notification engine live
6. [ ] Offline sync stable (Phase 3)
7. [ ] Sales rep mobile stable (Phase 3)

---

## Operational Readiness

Scale to: **5–10 stores, multiple routes, multiple vehicles**
