# /docs/implementation/phase-1-build-plan.md

# Phase 1 Build Plan — Core FMCG Operating System

---

# 0. Document Control

**Document ID:** `phase-1-build-plan.md`
**Location:** `/docs/implementation/phase-1-build-plan.md`
**System:** Nepal FMCG Distribution Operating System
**Phase:** Phase 1
**Status:** Implementation-Ready Build Plan for Codex

---

# 1. Architecture References

Codex must treat the following architecture documents as source-of-truth references before implementing Phase 1:

```text
/docs/architecture/01-system-foundation.md
/docs/architecture/02-domain-architecture.md
/docs/architecture/03-inventory-engine.md
/docs/architecture/04-database-architecture.md
/docs/architecture/05-backend-architecture.md
/docs/architecture/06-frontend-architecture.md
/docs/architecture/07-devops-architecture.md
/docs/architecture/08-implementation-roadmap.md
/docs/architecture/09-engineering-bible.md
/docs/architecture/10-invoice-lifecycle.md
/docs/architecture/11-production-lifecycle.md
/docs/architecture/12-retailer-credit-ledger.md
/docs/architecture/13-warehouse-transfer-lifecycle.md
/docs/architecture/14-reconciliation-and-audit-system.md
/docs/architecture/15-purchase-order-lifecycle.md
/docs/architecture/16-delivery-and-logistics-lifecycle.md
```

Phase 1 must preserve these architectural principles:

```text
inventory-first philosophy
ledger-driven inventory
immutable financial/credit ledger foundation
transactional integrity
branch-aware design
RBAC foundation
auditability
bounded module separation
phase-based rollout discipline
```

---

# 2. Phase 1 Goal

Build the core operational foundation of the FMCG Distribution Operating System.

Phase 1 should create a usable internal system for:

```text
admin login
branch setup
warehouse setup
product/catalog setup
batch-aware inventory foundation
inventory movement ledger
basic stock adjustment
retailer management
sales rep management
invoice posting
basic payment recording
retailer credit ledger foundation
basic audit logging
admin dashboard visibility
```

Phase 1 is not intended to be a full ERP.

It is intended to establish the safe foundation for all later phases.

---

# 3. Phase 1 Objectives

## 3.1 Business Objectives

```text
1. Replace basic manual stock and billing records with system records.
2. Establish branch-wise inventory visibility.
3. Establish warehouse-wise stock visibility.
4. Enable basic invoice creation and posting.
5. Track retailer credit from invoices and payments.
6. Create an audit trail for sensitive operations.
7. Provide admin dashboard visibility into sales, stock, and dues.
```

---

## 3.2 Technical Objectives

```text
1. Establish backend modular structure.
2. Establish PostgreSQL + Prisma schema foundation.
3. Implement authentication and RBAC foundation.
4. Implement inventory movement ledger.
5. Implement inventory snapshot updates through ledger transactions only.
6. Implement invoice lifecycle foundation.
7. Implement retailer ledger foundation.
8. Implement basic audit logging.
9. Implement API conventions and error handling.
10. Implement frontend shell and core screens.
```

---

# 4. Explicit Phase 1 Scope

Phase 1 includes:

```text
authentication
RBAC foundation
branch setup
warehouse setup
product catalog
category management
unit management
batch-aware inventory foundation
inventory movement ledger
inventory snapshots
stock adjustment workflow
basic retailer management
basic sales rep management
invoice lifecycle foundation
retailer credit ledger foundation
basic payment recording
audit logging foundation
admin dashboard foundation
```

---

# 5. Explicitly Excluded From Phase 1

Do not implement the following in Phase 1:

```text
AI forecasting
advanced analytics
production execution
multi-warehouse transfer automation
delivery route optimization
retailer app
WhatsApp ordering
full offline sync implementation
advanced stock transfer lifecycle
purchase order automation
supplier ledger maturity
advanced cash reconciliation
route van inventory
GPS tracking
complex approval engine
```

Phase 1 may include database placeholders only when required for future compatibility, but inactive modules must not affect current workflows.

---

# 6. Phase 1 Included Features

## 6.1 Authentication

Implement:

```text
login
logout
current user profile
JWT/session handling
password hashing
basic user status
```

User statuses:

```text
ACTIVE
SUSPENDED
INVITED
```

---

## 6.2 RBAC Foundation

Implement:

```text
roles
permissions
role-permission assignment
user-role assignment
basic permission guard
branch scope foundation
```

Required initial roles:

```text
SUPER_ADMIN
ADMIN
BRANCH_MANAGER
WAREHOUSE_MANAGER
SALES_REP
ACCOUNTANT
STORE_STAFF
```

---

## 6.3 Branch Setup

Implement branch CRUD:

```text
create branch
edit branch
list branches
view branch
soft deactivate branch
```

Branch is required for transactional records.

---

## 6.4 Warehouse Setup

Implement warehouse CRUD:

```text
create warehouse under branch
edit warehouse
list warehouses
view warehouse
soft deactivate warehouse
```

Each warehouse must create or link to an inventory location.

---

## 6.5 Product Catalog

Implement:

```text
categories
products
units
product unit conversion
barcode field
batch tracking flags
expiry tracking flags
basic price fields
```

Do not implement advanced price history yet unless simple structure is already available.

---

## 6.6 Batch-Aware Inventory Foundation

Implement:

```text
batch creation
batch number
manufacturing date
expiry date
supplier optional field
cost price
MRP
batch status
```

Batch status:

```text
ACTIVE
BLOCKED
EXPIRED
```

---

## 6.7 Inventory Movement Ledger

Implement immutable inventory movement architecture:

```text
inventory_events
inventory_movements
inventory_snapshots
```

All stock changes must go through ledger service.

No direct stock mutation is allowed.

---

## 6.8 Stock Adjustment Workflow

Implement basic stock adjustment:

```text
create adjustment draft
add adjustment items
submit adjustment
approve adjustment
post adjustment
```

Phase 1 adjustment can be simple but must be ledger-driven.

---

## 6.9 Retailer Management

Implement:

```text
create retailer
edit retailer
list retailers
view retailer
assign branch
assign credit limit
status management
```

Retailer statuses:

```text
ACTIVE
ON_HOLD
INACTIVE
```

---

## 6.10 Sales Rep Management

Implement:

```text
create sales rep
link sales rep to user
assign branch
list sales reps
view sales rep
status management
```

No route assignment automation in Phase 1.

---

## 6.11 Invoice Lifecycle Foundation

Implement:

```text
create draft invoice
add invoice items
calculate totals
post invoice
void invoice with basic permission
print/view receipt foundation
```

Phase 1 invoice states:

```text
DRAFT
POSTED
PAID
PARTIALLY_PAID
CREDIT_OPEN
VOIDED
CANCELLED
```

Stock deduction occurs only when invoice is posted.

---

## 6.12 Retailer Credit Ledger Foundation

Implement:

```text
retailer ledger entries
invoice debit entry
payment credit entry
basic outstanding calculation
retailer ledger view
```

Retailer balance must be derived from ledger entries.

Do not directly mutate retailer balance.

---

## 6.13 Basic Payment Recording

Implement:

```text
record payment against invoice
record retailer payment
support cash/QR/bank methods
update invoice payment status
create retailer ledger credit
```

Payment methods:

```text
CASH
QR
BANK
WALLET
CHEQUE
```

---

## 6.14 Audit Logging Foundation

Implement audit logs for:

```text
login
user created
role assigned
branch created/updated
warehouse created/updated
product created/updated
batch created
stock adjustment posted
invoice posted
invoice voided
payment recorded
retailer updated
```

---

## 6.15 Admin Dashboard Foundation

Implement basic dashboard cards:

```text
total sales today
total invoices today
total payments today
outstanding retailer credit
low stock count
inventory value estimate
recent invoices
recent stock movements
```

---

# 7. Database Models To Implement

Codex must implement Prisma models aligned with PostgreSQL architecture.

## 7.1 Identity Models

```text
User
Role
Permission
RolePermission
UserRole
```

Minimum fields:

```text
id
createdAt
updatedAt
deletedAt where applicable
status where applicable
```

---

## 7.2 Organization Models

```text
Branch
Warehouse
InventoryLocation
```

Rules:

```text
Warehouse belongs to Branch
InventoryLocation belongs to Branch
Warehouse has one InventoryLocation
```

---

## 7.3 Catalog Models

```text
Category
Brand
Unit
Product
ProductUnit
Batch
```

Product must include:

```text
skuCode
name
categoryId
brandId optional
defaultUnitId
barcode optional
isBatchTracked
isExpiryTracked
isActive
```

Batch must include:

```text
productId
batchNumber
manufacturingDate optional
expiryDate optional
costPrice optional
mrp optional
status
```

---

## 7.4 Inventory Models

```text
InventoryEvent
InventoryMovement
InventorySnapshot
StockAdjustment
StockAdjustmentItem
```

InventoryEvent fields:

```text
id
eventType
eventStatus
branchId
referenceType
referenceId
idempotencyKey
reversalOfEventId
createdById
approvedById
occurredAt
metadata
```

InventoryMovement fields:

```text
id
inventoryEventId
branchId
locationId
productId
batchId
stockState
quantityDelta
baseQuantityDelta
unitId
movementType
referenceType
referenceId
reasonCode
createdById
occurredAt
```

InventorySnapshot unique key:

```text
locationId + productId + batchId + stockState
```

---

## 7.5 Retailer And Sales Rep Models

```text
Retailer
SalesRep
```

Retailer fields:

```text
branchId
code
shopName
ownerName
phone
address
creditLimit
status
```

SalesRep fields:

```text
userId
branchId
employeeCode
status
```

---

## 7.6 Invoice Models

```text
Invoice
InvoiceItem
```

Invoice fields:

```text
branchId
invoiceNumber
invoiceType
retailerId optional
warehouseId/sourceLocationId
status
paymentStatus
subtotal
discountTotal
taxTotal
grandTotal
paidAmount
dueAmount
createdById
postedAt
voidedAt
voidReason
```

InvoiceItem fields:

```text
invoiceId
productId
batchId optional
unitId
quantity
baseQuantity
unitPrice
discountAmount
taxAmount
lineTotal
```

---

## 7.7 Payment And Ledger Models

```text
Payment
RetailerLedgerEntry
FinancialLedgerEntry optional/minimal
```

RetailerLedgerEntry fields:

```text
branchId
retailerId
entryType
referenceType
referenceId
debitAmount
creditAmount
balanceAfter optional
createdById
createdAt
```

Payment fields:

```text
branchId
paymentNumber
retailerId optional
invoiceId optional
amount
method
referenceNumber optional
receivedById
receivedAt
status
```

---

## 7.8 Audit Model

```text
AuditLog
```

Audit fields:

```text
branchId optional
actorUserId
action
entityType
entityId
beforeData
afterData
reason
ipAddress
userAgent
createdAt
```

---

# 8. Backend Modules To Implement

Codex must implement backend modules using the architecture in `05-backend-architecture.md`.

Recommended modules:

```text
auth
users
roles
permissions
branches
warehouses
catalog
inventory
stock-adjustments
retailers
sales-reps
invoices
payments
retailer-ledger
audit
admin-dashboard
```

---

# 9. Backend Service Requirements

## 9.1 InventoryLedgerService

Must provide:

```text
postInventoryEvent()
createMovement()
updateSnapshotWithinTransaction()
validateStockAvailability()
lockSnapshotForUpdate()
```

Rules:

```text
No stock change outside this service.
All inventory writes must be transactional.
```

---

## 9.2 InvoicePostingService

Must:

```text
validate invoice state
lock inventory snapshots
deduct stock through InventoryLedgerService
post invoice
create retailer ledger debit if due
create payment if paid
write audit logs
```

---

## 9.3 RetailerLedgerService

Must:

```text
create invoice debit
create payment credit
calculate outstanding
list ledger entries
```

No direct retailer balance mutation.

---

## 9.4 PaymentService

Must:

```text
record payment
link payment to invoice/retailer
create retailer ledger credit
update invoice payment status
write audit log
```

---

## 9.5 AuditService

Must:

```text
record entity actions
record before/after changes where practical
record actor and branch context
```

---

# 10. Frontend Screens To Implement

Use Next.js + TypeScript + Tailwind.

## 10.1 Auth Screens

```text
/login
```

---

## 10.2 Admin Layout

Implement:

```text
sidebar
topbar
branch context display
user menu
permission-aware navigation
```

---

## 10.3 Dashboard

```text
/dashboard
```

Cards:

```text
sales today
payments today
outstanding credit
low stock
recent invoices
recent stock movements
```

---

## 10.4 Branch Screens

```text
/branches
/branches/new
/branches/:id
```

---

## 10.5 Warehouse Screens

```text
/warehouses
/warehouses/new
/warehouses/:id
```

---

## 10.6 Catalog Screens

```text
/categories
/products
/products/new
/products/:id
/batches
/batches/new
```

---

## 10.7 Inventory Screens

```text
/inventory
/inventory/movements
/inventory/adjustments
/inventory/adjustments/new
```

Inventory screen must show:

```text
product
batch
location
available quantity
stock state
expiry date
```

---

## 10.8 Retailer Screens

```text
/retailers
/retailers/new
/retailers/:id
/retailers/:id/ledger
```

---

## 10.9 Sales Rep Screens

```text
/sales-reps
/sales-reps/new
/sales-reps/:id
```

---

## 10.10 Invoice Screens

```text
/invoices
/invoices/new
/invoices/:id
/invoices/:id/print
```

Invoice creation must support:

```text
retailer selection
product selection
batch selection
quantity
price
discount
payment mode
cash/credit choice
```

---

## 10.11 Payment Screens

```text
/payments
/payments/new
```

---

## 10.12 Audit Screen

```text
/audit-logs
```

Basic filter:

```text
entity type
user
date range
branch
```

---

# 11. API Endpoints To Implement

## 11.1 Auth

```text
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

---

## 11.2 Users/Roles/Permissions

```text
GET  /api/v1/users
POST /api/v1/users
GET  /api/v1/users/:id
PATCH /api/v1/users/:id

GET  /api/v1/roles
POST /api/v1/roles
GET  /api/v1/permissions
POST /api/v1/users/:id/roles
```

---

## 11.3 Branches

```text
GET  /api/v1/branches
POST /api/v1/branches
GET  /api/v1/branches/:id
PATCH /api/v1/branches/:id
```

---

## 11.4 Warehouses

```text
GET  /api/v1/warehouses
POST /api/v1/warehouses
GET  /api/v1/warehouses/:id
PATCH /api/v1/warehouses/:id
GET  /api/v1/warehouses/:id/inventory
```

---

## 11.5 Catalog

```text
GET  /api/v1/categories
POST /api/v1/categories
PATCH /api/v1/categories/:id

GET  /api/v1/products
POST /api/v1/products
GET  /api/v1/products/:id
PATCH /api/v1/products/:id

GET  /api/v1/batches
POST /api/v1/batches
GET  /api/v1/batches/:id
PATCH /api/v1/batches/:id
```

---

## 11.6 Inventory

```text
GET  /api/v1/inventory/snapshots
GET  /api/v1/inventory/movements
GET  /api/v1/inventory/locations/:id/stock
```

---

## 11.7 Stock Adjustments

```text
GET  /api/v1/inventory/adjustments
POST /api/v1/inventory/adjustments
GET  /api/v1/inventory/adjustments/:id
POST /api/v1/inventory/adjustments/:id/submit
POST /api/v1/inventory/adjustments/:id/approve
POST /api/v1/inventory/adjustments/:id/post
```

---

## 11.8 Retailers

```text
GET  /api/v1/retailers
POST /api/v1/retailers
GET  /api/v1/retailers/:id
PATCH /api/v1/retailers/:id
GET  /api/v1/retailers/:id/ledger
GET  /api/v1/retailers/:id/outstanding
```

---

## 11.9 Sales Reps

```text
GET  /api/v1/sales-reps
POST /api/v1/sales-reps
GET  /api/v1/sales-reps/:id
PATCH /api/v1/sales-reps/:id
```

---

## 11.10 Invoices

```text
GET  /api/v1/invoices
POST /api/v1/invoices
GET  /api/v1/invoices/:id
PATCH /api/v1/invoices/:id
POST /api/v1/invoices/:id/post
POST /api/v1/invoices/:id/cancel
POST /api/v1/invoices/:id/void
GET  /api/v1/invoices/:id/receipt
```

---

## 11.11 Payments

```text
GET  /api/v1/payments
POST /api/v1/payments
GET  /api/v1/payments/:id
```

Payment reversal can be excluded from Phase 1 or implemented behind permission flag.

---

## 11.12 Audit Logs

```text
GET /api/v1/audit-logs
GET /api/v1/audit-logs/entity/:entityType/:entityId
```

---

## 11.13 Dashboard

```text
GET /api/v1/dashboard/admin-summary
```

---

# 12. Permission Rules

## 12.1 Required Permissions

Seed these permissions:

```text
users.view
users.create
users.update
roles.manage
branches.view
branches.create
branches.update
warehouses.view
warehouses.create
warehouses.update
products.view
products.create
products.update
batches.view
batches.create
inventory.view
inventory.adjust.create
inventory.adjust.approve
inventory.adjust.post
retailers.view
retailers.create
retailers.update
sales_reps.view
sales_reps.create
invoices.view
invoices.create
invoices.post
invoices.void
payments.view
payments.create
retailer_ledger.view
audit_logs.view
dashboard.view
```

---

## 12.2 Role Defaults

### SUPER_ADMIN

All permissions.

### ADMIN

Most operational permissions except system-level role mutation if desired.

### BRANCH_MANAGER

Branch-scoped:

```text
warehouses.view
products.view
inventory.view
inventory.adjust.create
inventory.adjust.approve
retailers.*
sales_reps.*
invoices.*
payments.*
retailer_ledger.view
dashboard.view
```

### WAREHOUSE_MANAGER

```text
inventory.view
inventory.adjust.create
inventory.adjust.post with approval if allowed
products.view
batches.view
warehouses.view
```

### ACCOUNTANT

```text
invoices.view
payments.view
payments.create
retailer_ledger.view
dashboard.view
```

### SALES_REP

Phase 1 minimal:

```text
retailers.view
invoices.create
payments.create
```

---

# 13. Inventory Rules

Codex must enforce:

```text
1. No direct mutation of product stock.
2. All stock changes create inventory_event and inventory_movement records.
3. Inventory snapshots are updated only inside inventory transactions.
4. Batch is required if product.isBatchTracked = true.
5. Expired or blocked batches cannot be sold.
6. Negative stock is not allowed.
7. Stock adjustment requires approval before posting.
8. Invoice posting deducts stock through inventory ledger.
9. Voided invoice must use reversal event, not delete movement.
10. All inventory actions must be branch-scoped.
```

---

# 14. Ledger Rules

Codex must enforce:

```text
1. Retailer balance is derived from retailer_ledger_entries.
2. Invoice credit creates INVOICE_DEBIT entry.
3. Payment creates PAYMENT_CREDIT entry.
4. Retailer balance must not be directly overwritten.
5. Payment must be linked to invoice or retailer.
6. Ledger entries must not be deleted.
7. Corrections later must use reversal/adjustment entries.
```

Phase 1 may store `balanceAfter` for convenience, but it must be derived during posting and recalculable from entries.

---

# 15. Audit Log Rules

Audit must be recorded for:

```text
login success/failure
user creation/update
role assignment
branch create/update
warehouse create/update
product create/update
batch create/update
stock adjustment submit/approve/post
invoice create/post/void/cancel
payment create
retailer create/update
sales rep create/update
```

Audit logs must include:

```text
actor user
branch if available
entity type
entity id
action
before data where practical
after data where practical
reason when required
created timestamp
```

---

# 16. Testing Requirements

## 16.1 Unit Tests

Required unit tests:

```text
permission checks
unit conversion
invoice total calculation
retailer balance calculation
inventory availability validation
batch expiry validation
```

---

## 16.2 Integration Tests

Required integration tests:

```text
invoice posting deducts stock
credit invoice creates retailer ledger debit
cash invoice creates payment record
payment creates retailer ledger credit
stock adjustment creates movement
blocked batch cannot be sold
negative stock prevented
void invoice creates reversal event
```

---

## 16.3 Transaction Tests

Required transaction tests:

```text
failed invoice posting rolls back inventory
failed payment posting rolls back ledger
failed stock adjustment posting rolls back movement
```

---

## 16.4 RBAC Tests

Required RBAC tests:

```text
unauthenticated request blocked
user without permission blocked
branch scoped data restricted
warehouse manager cannot manage users
sales rep cannot view audit logs
```

---

## 16.5 Frontend Tests / Manual QA

Manual QA checklist:

```text
login works
navigation changes by permission
create product
create batch
post stock adjustment
create retailer
create invoice
post invoice
record payment
view retailer ledger
view audit logs
view dashboard
```

---

# 17. Seed Data Requirements

Codex must create seed data for development.

## 17.1 Users

```text
Super Admin
Branch Manager
Warehouse Manager
Accountant
Sales Rep
```

---

## 17.2 Roles And Permissions

Seed all Phase 1 roles and permissions.

---

## 17.3 Branches

```text
Surkhet Branch
```

---

## 17.4 Warehouses

```text
Surkhet Main Warehouse
```

---

## 17.5 Categories

```text
Noodles
Biscuits
Cooking Oil
Beverages
Spices
Personal Care
Household
```

---

## 17.6 Units

```text
PCS
PACKET
CARTON
KG
LITER
BOTTLE
CASE
```

---

## 17.7 Sample Products

```text
Wai Wai 75g
Sunflower Oil 1L
Coca-Cola 250ml
Parle-G Biscuit
Turmeric Powder 100g
```

---

## 17.8 Sample Retailers

```text
Birendranagar Kirana Store
Surkhet Mini Mart
Local Retail Shop 01
```

---

## 17.9 Opening Stock

Opening stock must be created through inventory adjustment/posting workflow, not direct snapshot insert.

---

# 18. Implementation Order For Codex

Codex must implement in this order to avoid architectural collapse.

## Step 1 — Project Foundation

```text
initialize backend/frontend structure
configure TypeScript
configure Prisma
configure PostgreSQL
configure environment variables
configure basic error handling
```

---

## Step 2 — Database Schema Foundation

Implement Prisma models for:

```text
users
roles
permissions
branches
warehouses
inventory_locations
products
categories
units
batches
inventory_events
inventory_movements
inventory_snapshots
retailers
sales_reps
invoices
invoice_items
payments
retailer_ledger_entries
audit_logs
```

Run migration.

---

## Step 3 — Seed Data

Implement seed script.

Verify login users and permissions.

---

## Step 4 — Auth + RBAC

Implement:

```text
login
me endpoint
JWT guard
permission guard
role assignment
```

---

## Step 5 — Branch + Warehouse

Implement branch and warehouse CRUD.

Ensure warehouse creates inventory location.

---

## Step 6 — Catalog

Implement:

```text
categories
units
products
batches
```

---

## Step 7 — Inventory Ledger Foundation

Implement:

```text
InventoryLedgerService
InventorySnapshotService
stock snapshot query
movement query
```

---

## Step 8 — Stock Adjustment

Implement adjustment workflow to create opening stock and corrections.

This is required before invoices can be tested.

---

## Step 9 — Retailers + Sales Reps

Implement retailer and sales rep CRUD.

---

## Step 10 — Invoice Draft + Posting

Implement invoice creation and posting.

Posting must deduct stock through ledger.

---

## Step 11 — Retailer Ledger + Payments

Implement credit sale debit and payment credit.

---

## Step 12 — Audit Logs

Wire audit logging into critical operations.

---

## Step 13 — Admin Dashboard

Implement summary endpoint and frontend dashboard.

---

## Step 14 — QA Stabilization

Run tests and manual flows.

Fix transaction and permission issues.

---

# 19. Acceptance Criteria

Phase 1 is accepted only when all criteria below pass.

## 19.1 Authentication / RBAC

```text
Users can log in.
Users only see allowed screens.
Protected APIs reject unauthorized users.
Branch scope is enforced.
```

---

## 19.2 Catalog

```text
Admin can create categories, units, products, and batches.
Batch-tracked products require batch during stock/invoice operations.
```

---

## 19.3 Inventory

```text
Opening stock can be posted through stock adjustment.
Inventory movements are created.
Inventory snapshots update correctly.
No direct stock mutation exists.
Negative stock is prevented.
Expired/blocked batch cannot be sold.
```

---

## 19.4 Invoice

```text
Draft invoice can be created.
Invoice can be posted.
Stock is deducted only on posting.
Invoice posting creates inventory movement.
Cash invoice can be marked paid.
Credit invoice creates retailer due.
Invoice void creates reversal, not deletion.
```

---

## 19.5 Retailer Ledger

```text
Credit invoice creates debit entry.
Payment creates credit entry.
Outstanding balance is calculated from ledger.
Retailer balance is not directly mutated.
```

---

## 19.6 Payments

```text
Payment can be recorded.
Payment updates invoice payment status.
Payment creates ledger entry.
```

---

## 19.7 Audit

```text
Critical actions appear in audit logs.
Audit logs show actor, entity, action, timestamp, and branch where applicable.
```

---

## 19.8 Dashboard

```text
Admin dashboard shows basic sales, payments, stock, and credit summary.
```

---

## 19.9 Testing

```text
All required unit/integration tests pass.
Manual QA flow passes end-to-end.
No known data integrity issue remains.
```

---

# 20. Phase 1 Done Definition

Phase 1 is complete when the system can safely run this end-to-end flow:

```text
Admin logs in
↓
Creates branch and warehouse
↓
Creates category, unit, product, and batch
↓
Posts opening stock through stock adjustment
↓
Creates retailer
↓
Creates invoice
↓
Posts invoice
↓
Inventory deducts through ledger
↓
Retailer credit ledger updates if credit sale
↓
Payment is recorded
↓
Retailer outstanding updates
↓
Audit logs show critical actions
↓
Dashboard reflects operational summary
```

If this flow is not stable, Phase 2 must not begin.
