# /docs/architecture/15-purchase-order-lifecycle.md

# Purchase Order Lifecycle Architecture

## FMCG Distribution Operating System

---

# 0. Document Control

**Document ID:** `15-purchase-order-lifecycle.md`
**System:** Nepal FMCG Distribution Operating System
**Status:** Architecture Source of Truth

## References

This document depends on and must remain consistent with:

* `01-system-foundation.md`
* `02-domain-architecture.md`
* `03-inventory-engine.md`
* `04-database-architecture.md`
* `05-backend-architecture.md`
* `06-frontend-architecture.md`
* `07-devops-architecture.md`
* `08-implementation-roadmap.md`
* `09-engineering-bible.md`
* `10-invoice-lifecycle.md`
* `11-production-lifecycle.md`
* `12-retailer-credit-ledger.md`
* `13-warehouse-transfer-lifecycle.md`
* `14-reconciliation-and-audit-system.md`

---

# 1. Purpose

This document defines the complete supplier purchasing and inbound stock lifecycle architecture for the FMCG Distribution Operating System.

Purchasing is the upstream entry point of inventory. Because all downstream inventory, sales, production, transfer, expiry, and reconciliation workflows depend on correct inbound stock, purchase receiving must be controlled, auditable, batch-aware, supplier-accountable, and ledger-driven.

The system must support:

```text
supplier onboarding
purchase requests
purchase orders
supplier confirmation
inbound tracking
goods receiving notes
partial receipts
rejected goods
damaged goods
batch creation
expiry tracking
purchase invoice linkage
landed cost handling
supplier payment status
inventory ledger posting
warehouse impact
branch accountability
```

---

# 2. Architectural Alignment

This document preserves the established architecture principles:

```text
inventory-first philosophy
ledger-driven stock movement
transactional integrity
bounded module design
branch-aware operation
auditability
reconciliation readiness
phase-based rollout
```

Critical preservation rules:

```text
No direct stock mutation
Received stock enters only through inventory_events and inventory_movements
Batch lineage must be preserved
Supplier accountability must be preserved
Purchase corrections use reversal/adjustment workflows
Historical purchase and inventory events must not be deleted
```

---

# 3. Purchase Lifecycle Philosophy

Purchasing is not simply creating a supplier bill.

Purchasing is a controlled inbound-stock lifecycle:

```text
business need
↓
purchase request
↓
purchase order
↓
supplier confirmation
↓
inbound shipment
↓
goods receiving
↓
batch creation
↓
inventory ledger posting
↓
supplier invoice/payment tracking
```

The system must answer:

```text
Why was stock purchased?
Who approved it?
Which supplier confirmed it?
What arrived?
What was rejected?
Which batches were created?
Which warehouse received it?
What landed cost was applied?
What supplier invoice is linked?
What is still payable?
```

---

# 4. Purchase Scope

## Included

```text
supplier master
purchase request
purchase order
supplier confirmation
inbound shipment tracking
goods receiving note
batch creation
expiry tracking
partial receipt
rejection
damaged receiving
landed cost
supplier invoice linkage
supplier payment status
inventory event posting
```

## Excluded Initially

```text
supplier portal
EDI integration
automated supplier bidding
bank API payment integration
advanced procurement optimization
```

The architecture must remain extensible for these future capabilities.

---

# 5. Supplier Onboarding

## 5.1 Supplier Master Purpose

Supplier onboarding creates the accountable upstream party for procurement.

Supplier records must support:

```text
supplier identity
contact information
PAN/VAT details
payment terms
lead time
status
product categories supplied
risk flags
```

---

## 5.2 Supplier States

```text
DRAFT
ACTIVE
ON_HOLD
BLOCKED
INACTIVE
```

---

## 5.3 Supplier Validation

Before supplier activation, validate:

```text
supplier name
phone/contact
PAN/VAT if applicable
branch/global scope
payment terms
approved_by if required
```

---

## 5.4 Supplier Accountability

Every purchase document should link to:

```text
supplier_id
branch_id
created_by
approved_by where applicable
```

---

# 6. Purchase Request Lifecycle

## 6.1 Purpose

Purchase request captures internal demand before supplier commitment.

Purchase requests may originate from:

```text
low stock alerts
warehouse manager
branch manager
production requirement
manual procurement planning
future AI/procurement recommendation
```

---

## 6.2 Purchase Request States

```text
DRAFT
SUBMITTED
APPROVED
REJECTED
CONVERTED_TO_PO
CANCELLED
```

---

## 6.3 Purchase Request Flow

```text
Create purchase request
↓
Add requested products/quantities
↓
Submit for approval
↓
Manager approves/rejects
↓
Approved request converts to purchase order
```

---

## 6.4 Inventory Impact

Purchase request has no inventory impact.

It must not create:

```text
inventory_events
inventory_movements
inventory_snapshots
```

---

# 7. Purchase Order Lifecycle

## 7.1 Purchase Order Purpose

Purchase order is the official supplier commitment document.

It defines:

```text
supplier
ordered products
ordered quantity
expected cost
expected delivery date
receiving warehouse
branch
payment terms
```

---

## 7.2 Purchase Order States

```text
DRAFT
SUBMITTED
APPROVED
SENT_TO_SUPPLIER
SUPPLIER_CONFIRMED
PARTIALLY_RECEIVED
RECEIVED
CLOSED
CANCELLED
REJECTED
```

---

## 7.3 Purchase Order Flow

```text
Create PO
↓
Submit for approval
↓
Approve PO
↓
Send to supplier
↓
Supplier confirms
↓
Inbound shipment expected
↓
Receive goods through GRN
↓
Close PO after full receipt/reconciliation
```

---

# 8. Purchase Order Approval

## 8.1 Approval Purpose

Approval prevents uncontrolled purchasing and branch-level inventory/cash exposure.

Approval may be required based on:

```text
purchase value
supplier risk
new supplier
branch policy
product category
credit/payment terms
```

---

## 8.2 Approval Flow

```text
PO submitted
↓
Approver validates supplier/items/value
↓
Approval recorded
↓
PO status → APPROVED
```

Approval record includes:

```text
approved_by
approved_at
approval_reason
approval_level
```

---

# 9. Supplier Confirmation

## 9.1 Supplier Confirmation Purpose

Supplier confirmation records whether supplier accepted the PO.

Confirmation may include:

```text
confirmed quantity
confirmed price
expected delivery date
substitutions
unavailable items
```

---

## 9.2 Supplier Confirmation Flow

```text
PO sent to supplier
↓
Supplier confirms full/partial quantity
↓
System records confirmation
↓
Expected inbound shipment created
```

---

## 9.3 Supplier Price Changes

If supplier price changes after PO approval:

```text
requires approval
creates audit log
may create revised PO version
```

---

# 10. Inbound Shipment Tracking

## 10.1 Purpose

Inbound shipment tracking gives visibility before physical receipt.

---

## 10.2 Inbound Shipment States

```text
EXPECTED
IN_TRANSIT
ARRIVED
PARTIALLY_RECEIVED
RECEIVED
CANCELLED
```

---

## 10.3 Shipment Tracking Fields

```text
supplier_id
purchase_order_id
expected_arrival_date
vehicle_number
transporter_name
shipment_reference
branch_id
warehouse_id
status
```

---

# 11. Goods Receiving Note Architecture

## 11.1 GRN Purpose

Goods Receiving Note is the official inbound stock document.

Only posted GRNs create inventory.

---

## 11.2 GRN States

```text
DRAFT
SUBMITTED
INSPECTION_PENDING
APPROVED
POSTED
PARTIALLY_POSTED
CANCELLED
REVERSED
```

---

## 11.3 GRN Flow

```text
Inbound goods arrive
↓
Warehouse staff creates GRN
↓
Items counted and inspected
↓
Batch/expiry details captured
↓
Rejected/damaged items marked
↓
Manager approves if required
↓
GRN posted
↓
Inventory events created
```

---

# 12. GRN Posting Transaction

GRN posting must be transactional.

```text
BEGIN TRANSACTION

1. Validate GRN state
2. Validate PO/supplier/branch/warehouse scope
3. Validate product/unit/batch/expiry details
4. Create or link batches
5. Create inventory_event: PURCHASE_RECEIVED
6. Create inventory_movements for accepted stock
7. Update inventory_snapshots
8. Update PO received quantities
9. Update GRN status to POSTED/PARTIALLY_POSTED
10. Create purchase invoice linkage if supplied
11. Create supplier payable entry if finance enabled
12. Create audit log
13. Create domain event

COMMIT
```

If any step fails:

```text
ROLLBACK
```

---

# 13. Partial Receipt Handling

## 13.1 Partial Receipt Scenario

Example:

```text
Ordered: 100 cartons
Received: 70 cartons
Pending: 30 cartons
```

---

## 13.2 Partial Receipt Rules

Partial receipt must:

```text
post only received/accepted quantities
keep PO open for pending quantity
track outstanding supplier commitment
allow future GRN against same PO
```

---

## 13.3 PO Status Impact

```text
received_qty < ordered_qty → PARTIALLY_RECEIVED
received_qty = ordered_qty → RECEIVED/CLOSED
```

---

# 14. Rejected Goods Handling

## 14.1 Rejected Goods Definition

Rejected goods are received physically but not accepted into inventory.

Reasons:

```text
wrong item
wrong batch
expired item
poor quality
wrong quantity
supplier substitution not accepted
```

---

## 14.2 Rejected Goods Flow

```text
Goods inspected
↓
Rejected quantity marked
↓
No AVAILABLE inventory created
↓
Rejected record created
↓
Supplier claim/return workflow triggered
```

Rejected goods must not enter sellable inventory.

---

# 15. Damaged Goods Handling

## 15.1 Damaged on Arrival

Damaged goods may be accepted into damaged stock state or rejected.

---

## 15.2 Damaged Accepted Flow

```text
Goods received damaged
↓
Quantity marked DAMAGED
↓
GRN posted
↓
Inventory movement: +DAMAGED
↓
Supplier accountability record created
```

---

## 15.3 Damaged Rejected Flow

```text
Goods damaged
↓
Rejected at receiving
↓
No inventory created
↓
Supplier claim created
```

---

# 16. Batch Creation

## 16.1 Batch Creation Rule

Batch creation is mandatory for batch-tracked products.

Every received stock item must have:

```text
product_id
batch_number
manufacturing_date if available
expiry_date if applicable
supplier_id
received_date
cost_price
```

---

## 16.2 Batch Lineage

Received batch must link to:

```text
supplier_id
purchase_order_id
grn_id
warehouse_id
branch_id
```

---

# 17. Expiry Tracking

## 17.1 Expiry Requirement

Expiry-tracked products must not be received without expiry date unless authorized by policy.

---

## 17.2 Expiry Validation

System must validate:

```text
expiry_date exists for expiry-tracked product
expiry_date > current_date
minimum shelf-life policy satisfied
```

Example:

```text
reject product if less than 60 days shelf life remaining
```

if branch/company policy requires.

---

# 18. Purchase Invoice Linkage

## 18.1 Purchase Invoice Purpose

Supplier invoice links received goods to supplier financial obligation.

---

## 18.2 Linkage Options

Purchase invoice may be linked:

```text
before GRN
at GRN posting
after GRN posting
```

Recommended initial approach:

```text
GRN first, purchase invoice linkage after verification
```

---

## 18.3 Invoice Matching

System should support 3-way matching later:

```text
Purchase Order
Goods Received Note
Supplier Invoice
```

---

# 19. Landed Cost Handling

## 19.1 Landed Cost Purpose

Landed cost includes additional costs needed to bring stock into warehouse.

Examples:

```text
transport
loading/unloading
customs/import costs
insurance
handling charges
brokerage
```

---

## 19.2 Landed Cost Allocation

Allocation strategies:

```text
by quantity
by value
by weight
manual allocation
```

Initial recommended strategy:

```text
manual or value-based allocation
```

---

## 19.3 Inventory Cost Impact

Landed cost affects inventory valuation, not physical quantity.

It must not create stock movement.

It may update cost valuation records or batch cost details through approved cost allocation workflow.

---

# 20. Payment Status

## 20.1 Supplier Payment States

```text
NOT_INVOICED
INVOICED
PARTIALLY_PAID
PAID
DISPUTED
ON_HOLD
```

---

## 20.2 Supplier Payable Flow

```text
Supplier invoice recorded
↓
Payable created
↓
Payment made partially/fully
↓
Supplier balance updated through ledger
```

Financial maturity may be introduced later in Phase 6.

---

# 21. Inventory Movement Events

Purchase lifecycle may generate:

```text
PURCHASE_RECEIVED_AVAILABLE
PURCHASE_RECEIVED_DAMAGED
PURCHASE_REJECTED
PURCHASE_RECEIPT_REVERSED
PURCHASE_COST_ADJUSTED
SUPPLIER_RETURNED
```

All stock-increasing accepted receipts must pass through:

```text
inventory_events
inventory_movements
inventory_snapshots
```

---

# 22. Warehouse Impact

Received stock must enter a warehouse inventory location.

GRN must specify:

```text
branch_id
warehouse_id
inventory_location_id
```

Warehouse reports must show:

```text
pending inbound
received stock
rejected stock
damaged on arrival
supplier-related issues
```

---

# 23. Branch Impact

Every PO, GRN, and purchase invoice must be branch-aware.

Rules:

```text
PO branch_id must match receiving warehouse branch_id
GRN branch_id must match warehouse branch_id
Supplier may be global but transactions are branch-scoped
```

Inter-branch purchasing exceptions require explicit architecture approval.

---

# 24. Audit Logs

Mandatory audit events:

```text
supplier created
supplier approved
purchase request created
purchase request approved
purchase order created
purchase order approved
PO sent to supplier
supplier confirmation recorded
shipment marked in transit
GRN created
GRN posted
batch created
rejected goods recorded
damaged goods recorded
purchase invoice linked
landed cost allocated
PO cancelled
GRN reversed
```

Audit fields:

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
created_at
```

---

# 25. Cancellation Rules

## 25.1 Purchase Request Cancellation

Allowed before conversion to PO.

```text
DRAFT/SUBMITTED → CANCELLED
```

---

## 25.2 PO Cancellation

Allowed before receiving.

```text
DRAFT/APPROVED/SENT_TO_SUPPLIER → CANCELLED
```

If partially received:

```text
remaining quantities may be cancelled
received stock remains posted
```

---

## 25.3 GRN Cancellation

Allowed only before posting.

Posted GRN cannot be cancelled directly.

Use:

```text
receipt reversal
supplier return
inventory adjustment
```

---

# 26. Rollback Strategy

## 26.1 Technical Rollback

Before transaction commit:

```text
ROLLBACK database transaction
```

No partial inventory effect remains.

---

## 26.2 Business Rollback

After GRN posting:

Never delete inventory events.

Use:

```text
PURCHASE_RECEIPT_REVERSED
SUPPLIER_RETURNED
INVENTORY_ADJUSTMENT
```

---

## 26.3 Correction Matrix

| Problem                                | Correct Action                          |
| -------------------------------------- | --------------------------------------- |
| Wrong PO draft                         | Edit draft                              |
| Wrong approved PO                      | Revise/Cancel before receipt            |
| Wrong received quantity before posting | Edit GRN                                |
| Wrong received quantity after posting  | GRN reversal/adjustment                 |
| Wrong batch number                     | Batch correction workflow with audit    |
| Wrong expiry date                      | Batch metadata correction with approval |
| Damaged goods posted as available      | Move AVAILABLE → DAMAGED via adjustment |
| Supplier invoice mismatch              | Supplier invoice dispute workflow       |

---

# 27. Concurrency Handling

Purchase receiving can create or update batch and snapshot records.

GRN posting must lock:

```text
purchase_order_items
inventory_snapshots for target location/product/batch
batch records when necessary
```

Example:

```sql
SELECT * FROM purchase_order_items
WHERE purchase_order_id = ?
FOR UPDATE;
```

For inventory snapshot update:

```sql
SELECT * FROM inventory_snapshots
WHERE location_id = ?
AND product_id = ?
AND batch_id = ?
AND stock_state = 'AVAILABLE'
FOR UPDATE;
```

This prevents:

```text
over-receiving
parallel GRN duplication
incorrect received quantity
snapshot corruption
```

---

# 28. Idempotency Strategy

GRN posting and purchase receipt must require:

```text
Idempotency-Key
```

If repeated:

```text
same payload → return existing posted result
different payload → reject conflict
```

---

# 29. Database Architecture Impact

## Core Tables

```text
suppliers
purchase_requests
purchase_request_items
purchase_orders
purchase_order_items
supplier_confirmations
inbound_shipments
goods_received_notes
grn_items
purchase_invoices
purchase_invoice_items
landed_costs
landed_cost_allocations
supplier_payments
supplier_ledger_entries
inventory_events
inventory_movements
inventory_snapshots
batches
```

---

# 30. Backend Architecture Impact

## Required Services

```text
SupplierService
PurchaseRequestService
PurchaseOrderService
SupplierConfirmationService
InboundShipmentService
GoodsReceivingService
BatchService
LandedCostService
PurchaseInvoiceService
SupplierLedgerService
InventoryLedgerService
AuditService
```

---

# 31. Frontend Architecture Impact

## Required Screens

```text
Supplier Management
Purchase Request Screen
Purchase Order Screen
PO Approval Queue
Inbound Shipment Screen
Goods Receiving Screen
Rejected Goods Review
Damaged Goods Review
Batch Creation/Review
Purchase Invoice Matching
Landed Cost Allocation
Supplier Payment Status
```

---

# 32. API Architecture

## Supplier APIs

```text
POST   /api/v1/suppliers
GET    /api/v1/suppliers
GET    /api/v1/suppliers/:id
PATCH  /api/v1/suppliers/:id
POST   /api/v1/suppliers/:id/approve
POST   /api/v1/suppliers/:id/block
```

## Purchase Request APIs

```text
POST   /api/v1/purchase-requests
GET    /api/v1/purchase-requests
GET    /api/v1/purchase-requests/:id
POST   /api/v1/purchase-requests/:id/submit
POST   /api/v1/purchase-requests/:id/approve
POST   /api/v1/purchase-requests/:id/reject
POST   /api/v1/purchase-requests/:id/convert-to-po
```

## Purchase Order APIs

```text
POST   /api/v1/purchase-orders
GET    /api/v1/purchase-orders
GET    /api/v1/purchase-orders/:id
PATCH  /api/v1/purchase-orders/:id
POST   /api/v1/purchase-orders/:id/submit
POST   /api/v1/purchase-orders/:id/approve
POST   /api/v1/purchase-orders/:id/send-to-supplier
POST   /api/v1/purchase-orders/:id/confirm-supplier
POST   /api/v1/purchase-orders/:id/cancel
POST   /api/v1/purchase-orders/:id/close
```

## GRN APIs

```text
POST   /api/v1/goods-received-notes
GET    /api/v1/goods-received-notes
GET    /api/v1/goods-received-notes/:id
PATCH  /api/v1/goods-received-notes/:id
POST   /api/v1/goods-received-notes/:id/submit
POST   /api/v1/goods-received-notes/:id/approve
POST   /api/v1/goods-received-notes/:id/post
POST   /api/v1/goods-received-notes/:id/reverse
```

## Purchase Invoice APIs

```text
POST   /api/v1/purchase-invoices
GET    /api/v1/purchase-invoices
GET    /api/v1/purchase-invoices/:id
POST   /api/v1/purchase-invoices/:id/match
POST   /api/v1/purchase-invoices/:id/dispute
```

---

# 33. Operational Risks

## Risk 1: Stock Received Without Proper Batch

Mitigation:

```text
mandatory batch capture
expiry validation
GRN posting validation
```

---

## Risk 2: Supplier Sends Short Quantity

Mitigation:

```text
partial receipt workflow
PO remaining quantity tracking
supplier accountability reports
```

---

## Risk 3: Damaged Goods Enter Available Stock

Mitigation:

```text
receiving condition field
DAMAGED stock state
manager approval
inspection workflow
```

---

## Risk 4: Duplicate GRN Posting

Mitigation:

```text
idempotency key
state validation
transaction locking
unique GRN number
```

---

## Risk 5: Supplier Invoice Mismatch

Mitigation:

```text
3-way matching
invoice dispute workflow
approval before payment
```

---

## Risk 6: Cross-Branch Purchase Confusion

Mitigation:

```text
branch-scoped PO/GRN
warehouse branch validation
RBAC enforcement
```

---

# 34. Reporting Requirements

Reports:

```text
pending purchase requests
open purchase orders
supplier confirmation status
inbound shipments
partial receipts
rejected goods
damaged on arrival
supplier reliability
purchase price history
landed cost report
supplier payable status
```

---

# 35. Migration Concerns

## Safe Migration Strategy

```text
1. Add supplier and PO tables
2. Add GRN tables
3. Add purchase inventory event types
4. Add batch creation linkage
5. Add landed cost tables behind feature flag
6. Add supplier invoice matching later
7. Pilot GRN posting in one warehouse
8. Expand branch-by-branch
```

Never backfill received stock by directly editing snapshots.

Historical stock corrections must use opening balance or adjustment events.

---

# 36. Rollout Phase Alignment

## Phase 1

Basic supplier and purchase receiving may be minimal:

```text
supplier
manual GRN
batch creation
inventory posting
```

## Phase 2

Add:

```text
purchase orders
partial receipt
supplier confirmation
inbound tracking
```

## Phase 4

Add:

```text
rejected goods
damaged receiving
reconciliation
approval workflow
```

## Phase 6

Add:

```text
purchase invoice matching
supplier ledger
payment status
landed cost maturity
```

## Phase 7

Add:

```text
procurement intelligence
supplier reliability scoring
AI purchase recommendation
```

---

# 37. Final Purchase Order Architecture Position

Purchase lifecycle must remain:

```text
supplier-accountable
ledger-driven
batch-preserving
expiry-aware
warehouse-aware
branch-aware
transaction-safe
audit-heavy
reconciliation-ready
scalable
```

Inbound stock is the foundation of all downstream inventory truth.

Therefore every purchase workflow must preserve:

```text
stock truth
batch lineage
supplier accountability
warehouse accountability
branch accountability
financial traceability
future procurement intelligence
```
