# Inventory Engine Design

## FMCG Distribution Operating System — Nepal

## 1. Core Inventory Philosophy

The inventory engine must never be designed as:

```text
product.stock = 500
```

That is fragile, unsafe, and impossible to audit.

The correct model is:

```text
Inventory Event Ledger
        ↓
Inventory Movement Records
        ↓
Inventory Snapshot / Balance Cache
        ↓
Reports, Billing, Dispatch, Replenishment
```

The source of truth is the **immutable stock movement ledger**.

The snapshot is only a performance layer.

---

# 2. Inventory Engine Goals

The engine must support:

```text
warehouse stock
branch stock
store stock
batch tracking
expiry tracking
stock transfer
sales deduction
sales return
purchase receiving
damage handling
production consumption
production output
physical reconciliation
rollback safety
auditability
concurrency protection
negative stock prevention
```

The system must answer:

```text
What stock do we have?
Where is it?
Which batch?
What expiry?
How did it arrive?
Where did it move?
Who moved it?
Why did it change?
Can we prove it?
```

---

# 3. Inventory Location Model

Inventory exists at a **location**.

Locations can be:

```text
MAIN_WAREHOUSE
BRANCH_WAREHOUSE
MICRO_HUB
RETAIL_STORE
VEHICLE_STOCK
PRODUCTION_AREA
DAMAGED_STOCK_AREA
EXPIRED_STOCK_AREA
IN_TRANSIT
```

Every stock movement must have:

```text
source_location_id
destination_location_id
movement_type
product_id
batch_id
quantity
unit
reference_document
created_by
approved_by
timestamp
```

---

# 4. Inventory States

Stock is not just “available.”

Each SKU/batch/location can have states:

```text
AVAILABLE
RESERVED
IN_TRANSIT
DAMAGED
EXPIRED
QUARANTINED
RETURNED_PENDING_CHECK
PRODUCTION_RESERVED
CONSUMED
ADJUSTED
```

Example:

```text
Wai Wai 75g
Batch: WW-2026-01
Location: Surkhet Hub

Available: 500 cartons
Reserved: 60 cartons
In Transit: 30 cartons
Damaged: 4 cartons
Expired: 0
```

---

# 5. Stock Movement Lifecycle

## Generic Lifecycle

```text
Request
→ Validation
→ Reservation / Lock
→ Approval if required
→ Movement Event Created
→ Snapshot Updated
→ Audit Log Created
→ Document Status Updated
```

Important: movement and snapshot update must happen in the same database transaction.

---

# 6. Inventory Event Model

Every stock change creates an immutable event.

## Event Categories

```text
PURCHASE_RECEIVED
PURCHASE_RETURNED

SALE_RESERVED
SALE_DEDUCTED
SALE_RETURNED

TRANSFER_CREATED
TRANSFER_DISPATCHED
TRANSFER_RECEIVED
TRANSFER_VARIANCE_RECORDED

DAMAGE_RECORDED
DAMAGE_WRITTEN_OFF

EXPIRY_MARKED
EXPIRY_WRITTEN_OFF

PRODUCTION_RAW_RESERVED
PRODUCTION_RAW_CONSUMED
PRODUCTION_OUTPUT_RECEIVED
PRODUCTION_WASTAGE_RECORDED

STOCK_COUNT_STARTED
STOCK_COUNT_VARIANCE_RECORDED
STOCK_ADJUSTMENT_APPROVED

MANUAL_ADJUSTMENT
REVERSAL_EVENT
```

---

# 7. Ledger Design

The ledger should be append-only.

Do not edit old inventory events.

If mistake happens:

```text
wrong event
↓
create reversal event
↓
create corrected event
```

Example:

```text
Original: SALE_DEDUCTED -10 cartons
Mistake found
Reversal: SALE_DEDUCTED_REVERSAL +10 cartons
Corrected: SALE_DEDUCTED -8 cartons
```

This protects auditability.

---

# 8. Quantity Direction Rules

Use signed movement quantities.

```text
INCREASE = positive quantity
DECREASE = negative quantity
```

Example:

```text
Purchase receive: +100
Sale deduct: -5
Damage write-off: -2
Transfer out: -20
Transfer in: +20
Production consume: -50 raw units
Production output: +200 finished units
```

For transfers, use two ledger entries:

```text
Source location: -20
Destination location: +20
```

If goods are physically in transit:

```text
Source: -20 AVAILABLE
Transit Location: +20 IN_TRANSIT
Transit Location: -20 IN_TRANSIT
Destination: +20 AVAILABLE
```

---

# 9. Inventory Snapshots

The snapshot table stores current balances for fast reads.

But it is not the source of truth.

Snapshot is derived from ledger.

## Snapshot key

```text
location_id
product_id
batch_id
stock_state
unit_id
```

Snapshot fields:

```text
quantity_on_hand
quantity_available
quantity_reserved
quantity_damaged
quantity_expired
quantity_in_transit
last_movement_at
last_reconciled_at
version
```

---

# 10. Core Inventory Tables

## 10.1 products

```text
id
sku_code
name
brand_id
category_id
default_unit_id
barcode
qr_code
is_batch_tracked
is_expiry_tracked
is_active
created_at
updated_at
```

---

## 10.2 product_units

Handles carton/packet/bottle conversions.

```text
id
product_id
unit_name
conversion_to_base_unit
is_base_unit
```

Example:

```text
Product: Wai Wai
Base unit: packet
Carton: 30 packets
```

---

## 10.3 batches

```text
id
product_id
batch_number
manufacturing_date
expiry_date
supplier_id
received_date
cost_price
mrp
status
created_at
```

Batch status:

```text
ACTIVE
NEAR_EXPIRY
EXPIRED
BLOCKED
RECALLED
```

---

## 10.4 inventory_locations

```text
id
type
name
branch_id
warehouse_id
store_id
vehicle_id
is_active
```

---

## 10.5 inventory_movements

This is the main ledger.

```text
id
event_id
movement_type
product_id
batch_id
location_id
stock_state
quantity_delta
unit_id
base_quantity_delta
reference_type
reference_id
reason_code
created_by
approved_by
occurred_at
created_at
metadata_json
```

Important:

```text
base_quantity_delta
```

should store normalized quantity in base unit.

---

## 10.6 inventory_events

Groups one or more movements into one business event.

```text
id
event_type
event_status
reference_type
reference_id
branch_id
initiated_by
approved_by
occurred_at
created_at
idempotency_key
reversal_of_event_id
metadata_json
```

Example:

A stock transfer event may create 4 movement rows.

---

## 10.7 inventory_snapshots

```text
id
location_id
product_id
batch_id
stock_state
unit_id
quantity
base_quantity
reserved_quantity
version
last_movement_id
updated_at
```

Unique constraint:

```text
location_id + product_id + batch_id + stock_state
```

---

## 10.8 stock_reservations

Used before sales dispatch or production consumption.

```text
id
product_id
batch_id
location_id
reserved_quantity
reference_type
reference_id
status
expires_at
created_by
created_at
```

Statuses:

```text
ACTIVE
CONSUMED
RELEASED
EXPIRED
CANCELLED
```

---

## 10.9 stock_transfers

```text
id
transfer_number
source_location_id
destination_location_id
status
requested_by
approved_by
dispatched_by
received_by
created_at
approved_at
dispatched_at
received_at
```

Statuses:

```text
DRAFT
REQUESTED
APPROVED
PICKED
DISPATCHED
IN_TRANSIT
PARTIALLY_RECEIVED
RECEIVED
VARIANCE_REVIEW
CLOSED
CANCELLED
```

---

## 10.10 stock_transfer_items

```text
id
transfer_id
product_id
batch_id
requested_qty
approved_qty
dispatched_qty
received_qty
variance_qty
unit_id
status
```

---

## 10.11 stock_counts

```text
id
count_number
location_id
status
started_by
approved_by
started_at
completed_at
approved_at
```

Statuses:

```text
DRAFT
IN_PROGRESS
SUBMITTED
VARIANCE_REVIEW
APPROVED
REJECTED
POSTED
```

---

## 10.12 stock_count_items

```text
id
stock_count_id
product_id
batch_id
system_qty
physical_qty
variance_qty
reason_code
notes
```

---

## 10.13 damaged_stock_records

```text
id
product_id
batch_id
location_id
quantity
damage_type
reported_by
approved_by
status
created_at
```

Damage types:

```text
BROKEN
LEAKED
TORN_PACKAGING
EXPIRED
PEST_DAMAGE
TRANSPORT_DAMAGE
MANUFACTURING_DEFECT
OTHER
```

---

## 10.14 expiry_events

```text
id
product_id
batch_id
location_id
quantity
expiry_date
status
action_taken
created_at
```

Actions:

```text
BLOCKED
RETURN_TO_SUPPLIER
DISCOUNTED_SALE
DESTROYED
WRITTEN_OFF
```

---

# 11. Relationships

```text
products
  → batches
  → inventory_movements
  → inventory_snapshots

inventory_events
  → inventory_movements

stock_transfers
  → stock_transfer_items
  → inventory_events

sales_invoices
  → sale_items
  → inventory_events

production_batches
  → raw_material_consumption
  → finished_goods_output
  → inventory_events

stock_counts
  → stock_count_items
  → inventory_adjustment_events
```

---

# 12. Inventory Locking Strategy

Inventory operations must be concurrency-safe.

## Problem

Two users sell the same product at the same time.

Example:

```text
Available stock: 5 cartons

User A sells 4
User B sells 3
```

Without locking, system may allow both and stock becomes negative.

---

## Correct Strategy

Use database transactions + row-level locking.

During deduction:

```sql
SELECT inventory_snapshot
WHERE location_id = ?
AND product_id = ?
AND batch_id = ?
FOR UPDATE;
```

Then validate:

```text
available_quantity >= requested_quantity
```

Then update snapshot and insert ledger movement.

---

# 13. Concurrency Handling

Every inventory-changing API must run inside a database transaction.

Pseudo lifecycle:

```text
BEGIN TRANSACTION

1. Lock relevant inventory snapshot rows
2. Validate quantity
3. Validate batch status
4. Validate expiry status
5. Create inventory event
6. Create inventory movements
7. Update inventory snapshot
8. Create audit log
9. Update business document status

COMMIT
```

If anything fails:

```text
ROLLBACK
```

---

# 14. Negative Stock Prevention

Default rule:

```text
negative stock is not allowed
```

Allowed only in exceptional controlled mode:

```text
allow_negative_stock = false by default
```

If business requires emergency billing before stock sync, allow:

```text
pending_stock_resolution
```

not actual negative stock.

Example:

```text
Sale recorded offline
Stock insufficient during sync
Status: conflict
Manager must resolve
```

Never silently make stock negative.

---

# 15. Batch Selection Strategy

For FMCG dispatch, use:

```text
FEFO = First Expiry, First Out
```

Batch deduction should automatically prefer nearest expiry first.

Example:

```text
Batch A expires in 20 days: 30 pcs
Batch B expires in 60 days: 100 pcs

Sale 40 pcs
Deduct:
- 30 from Batch A
- 10 from Batch B
```

---

# 16. Sales Deduction Flow

## Online POS Sale

```text
Scan product
→ Select quantity
→ System checks available stock
→ Locks stock snapshot
→ Creates SALE_DEDUCTED event
→ Inserts movement -quantity
→ Updates snapshot
→ Creates invoice
→ Records payment/credit
→ Prints receipt
```

Important: invoice and inventory deduction should be atomic.

If receipt printing fails, sale should still remain valid, but print status becomes:

```text
PRINT_PENDING
```

---

# 17. Sales Return Flow

```text
Customer returns product
→ Staff selects original invoice
→ System validates return eligibility
→ Product inspected
→ Return stock state selected
```

Return destinations:

```text
AVAILABLE
DAMAGED
RETURNED_PENDING_CHECK
EXPIRED
```

Example:

```text
Good condition: +AVAILABLE
Damaged packet: +DAMAGED
Expired item: +EXPIRED
```

Do not blindly return everything to sellable stock.

---

# 18. Stock Transfer Flow

## Transfer Lifecycle

```text
Draft Transfer
→ Approval
→ Picking
→ Dispatch
→ In Transit
→ Receiving
→ Variance Check
→ Close
```

## Event Flow

### Dispatch

```text
Source AVAILABLE -100
IN_TRANSIT +100
```

### Receive Full

```text
IN_TRANSIT -100
Destination AVAILABLE +100
```

### Receive Short

Sent 100, received 95.

```text
IN_TRANSIT -95
Destination AVAILABLE +95
Remaining 5 = variance review
```

Variance reason:

```text
lost
damaged in transit
counting error
pending receive
```

---

# 19. Branch Transfer Flow

Branch transfer is same as stock transfer, but must include:

```text
source_branch_id
destination_branch_id
inter_branch_reference
approval_level
transport_reference
```

For high-value branch transfer, require approval.

---

# 20. Damage Handling

Damaged stock must not disappear.

Correct flow:

```text
Available stock
→ Damage reported
→ Manager approves
→ Move AVAILABLE to DAMAGED
→ Decision: write-off / supplier return / discount sale
```

Movement:

```text
AVAILABLE -10
DAMAGED +10
```

If written off:

```text
DAMAGED -10
```

Reason required.

---

# 21. Expired Stock Handling

Expiry should be automatically detected by scheduled job.

## Expiry Lifecycle

```text
Active batch
→ Near expiry warning
→ Expired
→ Block from sale
→ Move to expired state
→ Write-off / return / disposal
```

When expired:

```text
AVAILABLE -quantity
EXPIRED +quantity
```

Expired stock should not be sellable unless explicitly allowed under controlled discount/clearance workflow before expiry.

---

# 22. Production Consumption Flow

For light manufacturing.

Example:

```text
Raw materials:
- peanuts
- salt
- packaging

Finished good:
- masala peanut pouch
```

## Production Lifecycle

```text
Production Plan
→ Raw Material Reservation
→ Raw Material Consumption
→ Production Output
→ Wastage Recording
→ Finished Goods Receive
→ Batch Creation
```

## Movement

Raw material consumption:

```text
RAW_MATERIAL_AVAILABLE -100kg
```

Finished goods output:

```text
FINISHED_GOODS_AVAILABLE +950 packs
```

Wastage:

```text
WASTAGE_RECORDED +5kg
```

Production batch must create traceability:

```text
finished_batch_id
linked_raw_material_batch_ids
```

---

# 23. Physical vs System Stock

## System Stock

Calculated from ledger.

## Physical Stock

Counted manually in warehouse/store.

Difference:

```text
variance = physical_stock - system_stock
```

Never immediately overwrite stock.

Instead:

```text
Stock Count
→ Variance Report
→ Investigation
→ Approval
→ Adjustment Event
```

---

# 24. Reconciliation Workflow

## Step 1 — Freeze Optional Scope

For high-control count:

```text
freeze location/category/SKU
```

During freeze:

* no sale
* no transfer
* no adjustment

or allow operations but track cut-off time.

---

## Step 2 — Physical Count

Staff counts:

```text
product
batch
expiry
quantity
condition
```

---

## Step 3 — Compare

System compares:

```text
system_qty
physical_qty
variance_qty
variance_value
```

---

## Step 4 — Reason Assignment

Reasons:

```text
counting_error
theft
damage_not_recorded
expiry_not_recorded
sale_not_synced
transfer_not_received
supplier_shortage
unknown
```

---

## Step 5 — Approval

Manager approves adjustment.

---

## Step 6 — Adjustment Event

System posts:

```text
STOCK_ADJUSTMENT_APPROVED
```

If physical stock is higher:

```text
+variance
```

If lower:

```text
-variance
```

---

# 25. Rollback Safety

Do not rollback by deleting rows.

Use reversal events.

## Example

Wrong stock transfer dispatched.

Original:

```text
Source -50
Transit +50
```

Reversal:

```text
Source +50
Transit -50
```

Then create correct transfer.

This preserves history.

---

# 26. Audit Trail Strategy

Every inventory event must log:

```text
event_id
user_id
role
device_id
location_id
ip_address
action_type
before_snapshot
after_snapshot
reference_type
reference_id
timestamp
reason
approval_status
```

For sensitive actions:

* stock adjustment
* damage write-off
* expiry write-off
* transfer cancellation
* invoice void

require:

```text
reason + approval + audit log
```

---

# 27. Idempotency Strategy

Mobile/offline operations may submit duplicate requests.

Every inventory-changing request must include:

```text
idempotency_key
device_id
client_transaction_id
```

Backend behavior:

```text
If idempotency_key already processed:
    return original result
Else:
    process normally
```

This prevents duplicate sales or duplicate stock deductions.

---

# 28. Offline Sync Rules

Offline operations should be queued locally.

When syncing:

```text
Validate product exists
Validate price version
Validate stock availability
Validate batch status
Validate idempotency
Apply if valid
Mark conflict if invalid
```

Conflict examples:

```text
stock insufficient
batch expired
price changed
invoice duplicate
retailer credit exceeded
```

Conflicts go to manager review.

---

# 29. Inventory APIs

## Product & Batch

```text
GET    /api/products
POST   /api/products
GET    /api/products/:id
POST   /api/products/:id/batches
GET    /api/batches/:id
```

---

## Inventory Query

```text
GET /api/inventory/snapshot
GET /api/inventory/ledger
GET /api/inventory/location/:locationId
GET /api/inventory/product/:productId
GET /api/inventory/batch/:batchId
```

---

## Stock Movement

```text
POST /api/inventory/receive-purchase
POST /api/inventory/adjust
POST /api/inventory/reserve
POST /api/inventory/release-reservation
POST /api/inventory/deduct-sale
POST /api/inventory/return-sale
POST /api/inventory/mark-damaged
POST /api/inventory/write-off-damaged
POST /api/inventory/mark-expired
POST /api/inventory/write-off-expired
```

---

## Transfers

```text
POST /api/stock-transfers
POST /api/stock-transfers/:id/approve
POST /api/stock-transfers/:id/dispatch
POST /api/stock-transfers/:id/receive
POST /api/stock-transfers/:id/record-variance
POST /api/stock-transfers/:id/cancel
```

---

## Reconciliation

```text
POST /api/stock-counts
POST /api/stock-counts/:id/items
POST /api/stock-counts/:id/submit
POST /api/stock-counts/:id/approve
POST /api/stock-counts/:id/post-adjustments
GET  /api/stock-counts/:id/variance-report
```

---

## Production

```text
POST /api/production/plans
POST /api/production/:id/reserve-materials
POST /api/production/:id/consume-materials
POST /api/production/:id/receive-output
POST /api/production/:id/record-wastage
POST /api/production/:id/close
```

---

# 30. Key Event Flows

## Purchase Receive

```text
Supplier Invoice / PO
→ Goods Received Note
→ Batch created/selected
→ Inventory event: PURCHASE_RECEIVED
→ Warehouse AVAILABLE +qty
→ Snapshot update
→ Audit log
```

---

## Sale

```text
POS Invoice
→ Stock availability check
→ Snapshot lock
→ Batch selected by FEFO
→ SALE_DEDUCTED event
→ AVAILABLE -qty
→ Payment/credit recorded
→ Audit log
```

---

## Store Transfer

```text
Hub creates transfer
→ Manager approves
→ Hub dispatches
→ Hub AVAILABLE -qty
→ IN_TRANSIT +qty
→ Store receives
→ IN_TRANSIT -qty
→ Store AVAILABLE +qty
→ Variance if mismatch
```

---

## Damage

```text
Damage reported
→ Manager approval
→ AVAILABLE -qty
→ DAMAGED +qty
→ Write-off or return decision later
```

---

## Expiry

```text
Expiry job detects expired batch
→ Block from sale
→ AVAILABLE -qty
→ EXPIRED +qty
→ Write-off/return workflow
```

---

## Production

```text
Production order approved
→ Raw materials reserved
→ Raw materials consumed
→ Finished batch created
→ Finished goods received
→ Wastage recorded
```

---

# 31. Business Rules

## Mandatory Rules

```text
1. No direct stock edits.
2. No negative stock by default.
3. Every movement must have reference.
4. Every adjustment must have reason.
5. Every sensitive movement must have approval.
6. Every event must be auditable.
7. Every offline transaction must be idempotent.
8. Every batch-tracked product must use batch-level deduction.
9. Expired stock cannot be sold.
10. Damaged stock cannot be sold unless reclassified.
```

---

# 32. Nepal-Specific Operational Considerations

## Weak Internet

Use offline queues and sync validation.

## Shared Devices

Require:

* user login
* device registration
* session expiry
* PIN re-auth for sensitive actions

## Manual Warehouse Culture

Support:

* printable pick lists
* physical count sheets
* simple mobile scanning
* supervisor approval

## Credit and Route Sales

Vehicle stock should be modeled as a location.

```text
Warehouse → Vehicle Stock → Retailer Sale
```

This matches real FMCG distribution routes.

## Branch-Wise Operations

Every movement must include branch context.

---

# 33. Final Design Position

The inventory engine should be:

```text
ledger-first
event-driven
batch-aware
expiry-aware
location-aware
transaction-safe
offline-tolerant
audit-heavy
reconciliation-ready
production-compatible
Nepal FMCG realistic
```

The system does not merely answer:

```text
How much stock do we have?
```

It answers:

```text
Why do we have this stock?
Where did it come from?
Where did it go?
Who moved it?
Was it sold, damaged, expired, transferred, produced, or adjusted?
Can we prove it?
```
