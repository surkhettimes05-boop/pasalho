# /docs/architecture/17-barcode-and-scanning-architecture.md

# Barcode and Scanning Architecture

## FMCG Distribution Operating System

---

# 0. Document Control

**Document ID:** `17-barcode-and-scanning-architecture.md`
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
* `15-purchase-order-lifecycle.md`
* `16-delivery-and-logistics-lifecycle.md`
* `/docs/implementation/phase-1-build-plan.md`

---

# 1. Purpose

This document defines the complete barcode, QR, and mobile scanning architecture for the FMCG Distribution Operating System.

Scanning is used to improve operational speed and accuracy across:

```text
billing
warehouse receiving
stock adjustment
stock counting
production
warehouse transfer
delivery verification
damaged stock handling
batch traceability
```

Scanning must not become a shortcut that bypasses inventory, invoice, production, transfer, or financial ledgers.

---

# 2. Architectural Alignment

This document preserves all established architecture principles:

```text
inventory-first philosophy
ledger-driven inventory
transactional integrity
branch-aware operation
auditability
batch lineage
offline-tolerant workflow
phase-based rollout
```

Critical preservation rules:

```text
Scanning must never directly mutate stock
Scanning creates validated operational events or draft inputs
Inventory ledger remains source of truth
Batch lineage must be preserved
Every critical scan action must be auditable
Offline scans must be validated before posting
```

---

# 3. Scanning Philosophy

A scan is not a transaction by itself.

A scan is an input signal.

Correct model:

```text
scan captured
↓
code resolved
↓
context validated
↓
operator confirms action
↓
business workflow posts event
↓
inventory/finance ledger updates if applicable
```

Wrong model:

```text
scan product
↓
stock changes immediately
```

This is forbidden.

---

# 4. Nepal Hardware Reality

The system must support low-cost operational conditions:

```text
Android phones
low-cost tablets
shared devices
weak camera quality
poor lighting
slow internet
low-cost Bluetooth scanners later
thermal printers later
```

Initial implementation should prioritize:

```text
mobile camera scanning
manual fallback
cached product lookup
offline scan capture
```

---

# 5. Barcode Strategy

## 5.1 Product Barcode

Use product barcode for identifying SKU.

Sources:

```text
manufacturer barcode
EAN/UPC where available
internal barcode if unavailable
```

---

## 5.2 Internal Barcode

For products without manufacturer barcode, generate internal code.

Example format:

```text
PRD-{SKU_CODE}
```

or numeric internal barcode:

```text
900000000001
```

Internal barcode must map uniquely to product or product unit.

---

## 5.3 Barcode Scope

Barcode may represent:

```text
product SKU
product unit variant
carton/bundle/pack unit
```

Example:

```text
Wai Wai 75g packet barcode
Wai Wai carton barcode
```

The system must know unit conversion.

---

# 6. QR Strategy

QR codes should be used when more data is needed than normal barcode.

Recommended QR use cases:

```text
internal batch labels
warehouse location labels
stock transfer labels
production batch labels
delivery package labels
retailer/store labels
```

QR payload should avoid sensitive business data.

Recommended QR payload:

```json
{
  "type": "BATCH",
  "id": "uuid-or-short-code",
  "code": "BATCH-2026-001"
}
```

The backend resolves the code to full data.

---

# 7. Product Code Strategy

## 7.1 Product Code Purpose

Product code is internal business identity.

It should remain stable even if barcode changes.

Example:

```text
SKU-WAIWAI-75G
SKU-OIL-SUNFLOWER-1L
```

---

## 7.2 Product Code Rules

```text
unique
human-readable
not reused after deletion
branch-independent
```

---

# 8. Batch Code Strategy

## 8.1 Batch Code Purpose

Batch code links stock to origin, expiry, purchase, or production.

---

## 8.2 Batch Code Sources

Batch code may come from:

```text
supplier/manufacturer batch number
production run generated batch
internal receiving batch code
```

---

## 8.3 Internal Batch Code Format

Recommended:

```text
BCH-{PRODUCT_CODE}-{YYYYMMDD}-{SEQUENCE}
```

Example:

```text
BCH-WAIWAI75-20260528-001
```

---

# 9. Code Types

System should support multiple scannable code types:

```text
PRODUCT_BARCODE
PRODUCT_QR
BATCH_QR
LOCATION_QR
TRANSFER_QR
DELIVERY_QR
PACKAGE_QR
RETAILER_QR
USER_BADGE_QR optional
```

---

# 10. Scan Contexts

A scan must always happen inside a context.

Examples:

```text
BILLING_SCAN
WAREHOUSE_RECEIVE_SCAN
STOCK_COUNT_SCAN
TRANSFER_PICK_SCAN
TRANSFER_RECEIVE_SCAN
PRODUCTION_CONSUME_SCAN
PRODUCTION_OUTPUT_SCAN
DELIVERY_VERIFY_SCAN
DAMAGED_STOCK_SCAN
```

The same barcode can behave differently depending on context.

---

# 11. Warehouse Scan Workflows

## 11.1 Goods Receiving Scan

```text
scan product/barcode
↓
resolve product
↓
enter/scan batch
↓
capture expiry
↓
enter received quantity
↓
operator confirms GRN line
↓
GRN posting later creates inventory movement
```

No inventory changes during scan capture.

---

## 11.2 Stock Count Scan

```text
scan product/batch/location
↓
system displays expected stock if online
↓
operator enters physical quantity
↓
count item saved
↓
variance calculated
↓
adjustment posted only after approval
```

---

## 11.3 Warehouse Location Scan

Warehouse shelves/zones may have QR labels.

Use cases:

```text
confirm picking location
confirm putaway location
confirm stock count location
```

---

# 12. Billing Scan Workflows

## 12.1 POS Billing Scan

```text
scan product barcode
↓
resolve product/unit
↓
check current store/warehouse stock
↓
select batch automatically by FEFO or manually if needed
↓
add to invoice cart
↓
operator confirms quantity/payment
↓
invoice posting deducts stock through ledger
```

---

## 12.2 Billing Scan Rules

```text
blocked batch cannot be sold
expired batch cannot be sold
insufficient stock blocks posting
barcode not found triggers manual search
```

---

# 13. Production Scan Workflows

## 13.1 Raw Material Consumption Scan

```text
scan raw material batch
↓
validate production run
↓
validate reserved material
↓
enter consumed quantity
↓
operator confirms consumption
↓
production consumption event posts inventory movement
```

---

## 13.2 Finished Goods Output Scan

```text
production output created
↓
finished batch generated
↓
label printed
↓
finished batch QR scanned for verification
↓
output posted into inventory ledger
```

---

# 14. Transfer Scan Workflows

## 14.1 Transfer Picking Scan

```text
open approved transfer
↓
scan product/batch
↓
validate transfer item
↓
record picked quantity
↓
confirm picking
```

---

## 14.2 Transfer Dispatch Scan

```text
scan picked items/packages
↓
confirm loading
↓
dispatch transaction posts ledger movements
↓
source decreases
↓
in-transit increases
```

---

## 14.3 Transfer Receive Scan

```text
open incoming transfer
↓
scan received product/batch/package
↓
compare against dispatched quantity
↓
record received/damaged/missing
↓
receive transaction posts ledger movement
```

---

# 15. Delivery Scan Workflows

## 15.1 Vehicle Loading Scan

```text
scan delivery package/product/batch
↓
validate route and invoice
↓
confirm vehicle loading
↓
dispatch posts vehicle/in-transit inventory movement
```

---

## 15.2 Retailer Delivery Verification Scan

```text
scan retailer QR or invoice QR
↓
scan delivered package/product if required
↓
confirm delivery quantity
↓
record proof of delivery
↓
record cash/credit status
```

---

# 16. Damaged Stock Scan Workflows

## 16.1 Damage Reporting Scan

```text
scan product/batch
↓
select damage reason
↓
enter damaged quantity
↓
attach photo optional
↓
submit damage report
↓
approval posts movement to DAMAGED state
```

---

# 17. Offline Scan Capture

## 17.1 Offline Philosophy

Offline scans are local evidence, not final truth.

Offline scan capture may store:

```text
scan code
scan context
user_id
device_id
branch_id
location_id
timestamp
payload draft
```

---

## 17.2 Offline Scan Flow

```text
scan captured offline
↓
lookup from cached catalog if available
↓
store pending scan event locally
↓
sync when online
↓
backend validates
↓
accept/reject/conflict
```

---

# 18. Duplicate Scan Prevention

## 18.1 Risk

Users may accidentally scan same item/package multiple times.

---

## 18.2 Prevention Strategy

Use:

```text
scan_session_id
scan_context
code
timestamp window
line item aggregation
idempotency key
```

Example:

```text
same package QR scanned twice in same transfer receive session → warn/block
```

---

# 19. Scan Validation Rules

## 19.1 General Validation

Every scan must validate:

```text
code exists
code type is allowed in current context
user has permission
branch/location scope matches
product is active
batch is valid
batch is not blocked
expiry rule passes
```

---

## 19.2 Context-Specific Validation

Billing:

```text
product is sellable
stock exists at source location
batch not expired
```

Production:

```text
material belongs to production plan
batch matches reservation if required
```

Transfer:

```text
product belongs to transfer
batch matches picked/dispatched quantity
```

Delivery:

```text
package/invoice belongs to route
retailer matches stop
```

---

# 20. Scanner Device Strategy

## 20.1 Phase 1 Device Strategy

Use:

```text
mobile camera scanning
manual barcode entry
manual product search fallback
```

---

## 20.2 Phase 2+ Device Strategy

Add optional:

```text
USB barcode scanner for warehouse desktop
Bluetooth scanner for tablets
Android scanner devices
```

---

## 20.3 Device Registration

For accountability, scanning devices may be registered.

Fields:

```text
device_id
assigned_user_id
branch_id
location_id
device_type
status
last_seen_at
```

---

# 21. Mobile Camera Scanning

## 21.1 PWA Camera Strategy

Use browser camera APIs through PWA.

Requirements:

```text
camera permission request
rear camera preference
torch support if available
manual fallback
low-light tolerance guidance
```

---

## 21.2 Scan UX

Scanner UI must include:

```text
large scan frame
manual entry button
recent scans
error feedback
sound/vibration optional
```

---

# 22. Label Printing

## 22.1 Label Types

Labels may be printed for:

```text
internal product codes
batch labels
warehouse locations
transfer packages
delivery packages
production output batches
```

---

## 22.2 Phase 1 Label Strategy

Low-cost implementation:

```text
PDF labels
A4 sticker sheet printing
thermal label printer later
```

---

# 23. Barcode Generation

## 23.1 Generation Rules

Generated codes must be:

```text
unique
non-reusable
auditable
linked to entity type
```

---

## 23.2 Generated Code Tables

Recommended table:

```text
scannable_codes
```

Fields:

```text
id
code
code_type
entity_type
entity_id
branch_id optional
status
created_by
created_at
revoked_at
```

---

# 24. Audit Logs

Mandatory audit events:

```text
barcode generated
barcode assigned
barcode revoked
batch label printed
warehouse scan captured
billing scan captured
transfer scan captured
delivery scan captured
duplicate scan blocked
scan validation failed
```

Audit fields:

```text
actor_user_id
branch_id
device_id
scan_context
code
entity_type
entity_id
action
created_at
```

---

# 25. Operational Risks

## Risk 1: Wrong Product Scanned

Mitigation:

```text
product confirmation screen
image/name display
manual confirmation for high-value items
```

---

## Risk 2: Duplicate Scan

Mitigation:

```text
scan session tracking
duplicate detection
idempotency keys
```

---

## Risk 3: Damaged/Unreadable Barcode

Mitigation:

```text
manual search fallback
reprint label
internal QR labels
```

---

## Risk 4: Fake Label Fraud

Mitigation:

```text
backend code validation
revoked code list
audit logs
branch scope validation
```

---

## Risk 5: Offline Scan Conflict

Mitigation:

```text
server validation on sync
conflict queue
operator warning
manager review
```

---

# 26. Fraud Prevention

Controls:

```text
code validation against backend
batch/location scope validation
device tracking
audit logs
scan frequency anomaly alerts
revoked label detection
permission checks
```

Suspicious scan patterns:

```text
same code scanned in multiple branches
same package scanned twice
large manual overrides
frequent validation failures
```

---

# 27. Future Hardware Scaling

Future support may include:

```text
Bluetooth barcode scanners
USB scanners
Android handheld scanners
thermal barcode printers
warehouse label printers
RFID later if justified
```

Do not design Phase 1 around expensive hardware.

---

# 28. Database Architecture Impact

Required tables:

```text
scannable_codes
scan_events
scan_sessions
label_print_jobs
label_templates
scanner_devices
```

---

# 29. Backend Architecture Impact

Required services:

```text
BarcodeService
QRCodeService
ScanValidationService
ScanEventService
LabelPrintService
ScannerDeviceService
```

---

# 30. Frontend Architecture Impact

Required components:

```text
BarcodeScanner
ManualCodeEntry
ScanResultCard
ScanSessionPanel
LabelPrintDialog
BatchLabelPreview
```

Required screens:

```text
Barcode Management
Label Printing
Scan History
Scanner Device Management later
```

---

# 31. API Architecture

## Barcode APIs

```text
GET    /api/v1/barcodes/:code
POST   /api/v1/barcodes/generate
POST   /api/v1/barcodes/assign
POST   /api/v1/barcodes/revoke
```

## Scan APIs

```text
POST   /api/v1/scans/validate
POST   /api/v1/scans/events
GET    /api/v1/scans/history
POST   /api/v1/scans/sessions
POST   /api/v1/scans/sessions/:id/close
```

## Label APIs

```text
POST   /api/v1/labels/print-jobs
GET    /api/v1/labels/print-jobs/:id
GET    /api/v1/labels/templates
```

---

# 32. Phase Alignment

## Phase 1

Implement:

```text
product barcode field
manual barcode lookup
mobile camera scanning for billing
basic batch label support
scan audit foundation
```

## Phase 2

Add:

```text
warehouse receiving scans
stock count scans
transfer scans
```

## Phase 3

Add:

```text
production raw material and output batch scans
```

## Phase 4

Add:

```text
damaged stock scans
reconciliation scans
```

## Phase 6

Add:

```text
delivery verification scans
cash collection proof links
```

## Phase 7

Add:

```text
scan anomaly detection
fraud scoring
hardware fleet analytics
```

---

# 33. Final Barcode and Scanning Architecture Position

Barcode and scanning architecture must remain:

```text
low-cost first
mobile-first
ledger-safe
batch-aware
context-validated
audit-heavy
offline-tolerant
fraud-aware
scalable
```

Scanning is not the source of truth.

Scanning is an operational accelerator.

The inventory ledger remains the source of truth.

Every scan must support:

```text
speed
accuracy
traceability
operator accountability
future scalability
```
