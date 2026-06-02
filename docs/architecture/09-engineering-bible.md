# Nepal FMCG Distribution Operating System

## Master Engineering Architecture Document

### Version 1.0

---

# Table of Contents

1. Executive Summary
2. System Vision
3. Core Architectural Philosophy
4. Business Context: Nepal FMCG Reality
5. System Objectives
6. System Boundaries
7. High-Level Architecture
8. Bounded Contexts & Core Modules
9. Inventory Philosophy
10. Financial Philosophy
11. Operational Philosophy
12. Offline-First Philosophy
13. Data Integrity Philosophy
14. Security & RBAC Architecture
15. Database Architecture
16. Inventory Engine Architecture
17. Financial Ledger Architecture
18. Backend Architecture
19. Frontend Architecture
20. DevOps & Deployment Architecture
21. Observability & Monitoring
22. Scaling Strategy
23. Disaster Recovery & Backup Strategy
24. Operational Workflows
25. Lifecycle Flows
26. Integration Strategy
27. Phase-Based Rollout Strategy
28. 7-Phase Implementation Roadmap
29. Engineering Standards
30. Risk Analysis
31. Future Scaling Notes
32. Final Architecture Position

---

# 1. Executive Summary

This document defines the complete engineering architecture for a Nepal-focused FMCG Distribution Operating System.

This is not a generic ERP.

The platform is designed specifically for:

* FMCG distribution
* warehouse operations
* retail execution
* inventory movement
* branch operations
* production/manufacturing
* retailer credit management
* offline field operations
* Nepal operational realities

The system is designed to evolve through controlled phases while preserving:

* inventory correctness
* financial correctness
* auditability
* branch isolation
* scalability
* operational stability

This document is the:

* engineering bible
* implementation source of truth
* onboarding reference
* scaling blueprint
* operational architecture guide

---

# 2. System Vision

The long-term vision is to build:

```text
An operational commerce infrastructure layer for Nepal FMCG distribution.
```

The system evolves through stages:

```text
manual operation replacement
↓
operational control system
↓
distribution infrastructure
↓
commerce intelligence platform
```

The architecture intentionally supports future evolution toward:

* procurement intelligence
* retailer intelligence
* demand forecasting
* route optimization
* production optimization
* AI-assisted distribution planning

without requiring architectural rewrites.

---

# 3. Core Architectural Philosophy

## 3.1 Ledger-First Philosophy

The system is ledger-driven.

Two immutable ledgers define truth:

```text
1. inventory_movements
2. financial_ledger_entries
```

Snapshots are optimization layers.

They are not the source of truth.

---

## 3.2 Operational Reality First

Architecture decisions are grounded in Nepal realities:

* weak internet
* shared devices
* manual warehouse culture
* route-based sales
* retailer credit culture
* low-cost Android phones
* inconsistent operations

The system is designed for operational survival first.

---

## 3.3 Controlled Complexity

The system intentionally avoids:

* premature microservices
* premature Kubernetes
* unnecessary distributed systems
* overly abstract architecture

The recommended approach is:

```text
modular monolith first
scale carefully later
```

---

## 3.4 Auditability First

Every critical operation must answer:

```text
Who did it?
When?
Why?
What changed?
Can we reverse it?
```

---

## 3.5 Offline-Tolerant Operations

The system assumes intermittent internet.

Critical field operations must continue during outages.

---

# 4. Business Context: Nepal FMCG Reality

## Distribution Model

Nepal FMCG distribution is heavily relationship-driven.

Operational realities:

* wholesalers visit retailers physically
* orders are often verbal
* route sales dominate
* retailers buy frequently in small quantities
* stock visibility is weak
* inventory reconciliation is inconsistent
* credit tracking is often notebook-based

The system is designed to digitize this operational reality rather than impose unrealistic workflows.

---

# 5. System Objectives

## Primary Objectives

```text
Inventory correctness
Financial correctness
Operational visibility
Branch isolation
Auditability
Offline operation
Scalable architecture
```

## Secondary Objectives

```text
Analytics
Forecasting
Retailer digitization
AI recommendations
```

---

# 6. System Boundaries

## Included

```text
Inventory
Billing
Warehouse
Production
Retailer ledger
Payments
Sales reps
Transfers
Reconciliation
Analytics
Forecasting
```

## Excluded Initially

```text
Advanced accounting ERP
HRMS
Payroll
Full CRM
E-commerce marketplace
```

---

# 7. High-Level Architecture

## System Topology

```text
Users
 ↓
PWA / Web / Tablet / Mobile
 ↓
Cloudflare / CDN
 ↓
Nginx Reverse Proxy
 ↓
NestJS Backend API
 ↓
PostgreSQL + Redis
 ↓
Object Storage
```

---

## Application Layers

```text
Presentation Layer
↓
Application Services Layer
↓
Domain Services Layer
↓
Repository/Data Access Layer
↓
PostgreSQL
```

---

# 8. Bounded Contexts & Core Modules

## Identity

```text
users
roles
permissions
authentication
RBAC
```

## Organization

```text
branches
warehouses
stores
locations
```

## Catalog

```text
products
categories
brands
units
prices
batches
```

## Inventory

```text
inventory movements
stock transfers
stock counts
stock adjustments
reconciliation
expiry
damage
```

## Sales

```text
orders
invoices
returns
POS
```

## Finance

```text
payments
retailer ledger
financial ledger
cash sessions
```

## Production

```text
BOM
production runs
raw materials
finished goods
```

## Logistics

```text
routes
vehicles
deliveries
sales reps
```

## Analytics

```text
sales analytics
inventory analytics
forecasting
recommendations
```

---

# 9. Inventory Philosophy

## Core Principle

Inventory quantity fields alone are forbidden.

Wrong:

```text
product.stock = 500
```

Correct:

```text
inventory events
↓
inventory movements
↓
inventory snapshots
```

---

## Inventory Truth

The system must always know:

```text
what stock exists
where it exists
which batch
which expiry
who moved it
why it changed
```

---

## Inventory States

```text
AVAILABLE
RESERVED
IN_TRANSIT
DAMAGED
EXPIRED
QUARANTINED
```

---

# 10. Financial Philosophy

Financial integrity is ledger-driven.

Invoices and payments create immutable ledger entries.

Critical rule:

```text
No silent mutation of financial history.
```

All corrections use:

```text
reversal entries
```

---

# 11. Operational Philosophy

The platform is optimized for:

```text
warehouse operators
billing operators
sales reps
branch managers
retail shops
```

not technical users.

The UI must reduce operational ambiguity.

---

# 12. Offline-First Philosophy

Offline support is mandatory.

Offline-capable workflows:

```text
sales order capture
barcode lookup
route operations
payment recording
basic billing queue
```

Offline flow:

```text
capture locally
↓
queue locally
↓
sync later
↓
resolve conflicts
```

---

# 13. Data Integrity Philosophy

## Mandatory Rules

```text
No negative stock by default
All critical actions transactional
All sensitive actions audited
All ledger changes immutable
All sync actions idempotent
```

---

# 14. Security & RBAC Architecture

## Security Layers

```text
JWT auth
RBAC
branch scope
warehouse scope
store scope
device scope
```

---

## Roles

```text
SUPER_ADMIN
BRANCH_MANAGER
WAREHOUSE_MANAGER
STORE_STAFF
SALES_REP
ACCOUNTANT
PRODUCTION_MANAGER
AUDITOR
```

---

## Permission Model

Permissions are feature-specific.

Examples:

```text
inventory.adjust.approve
invoice.post
reports.company.view
payment.reverse
```

---

# 15. Database Architecture

## Database Stack

```text
PostgreSQL
Prisma ORM
Redis
```

---

## Database Design Principles

```text
normalized schema
ledger-driven architecture
branch isolation
immutable transactions
strict foreign keys
soft delete for master data only
```

---

## Core Tables

### Identity

```text
users
roles
permissions
user_roles
role_permissions
```

### Organization

```text
branches
warehouses
stores
inventory_locations
```

### Catalog

```text
products
categories
brands
units
product_units
product_prices
batches
```

### Inventory

```text
inventory_events
inventory_movements
inventory_snapshots
stock_transfers
stock_adjustments
stock_counts
```

### Sales

```text
sales_orders
invoices
invoice_items
sales_returns
```

### Finance

```text
payments
retailer_ledger_entries
financial_ledger_entries
cash_sessions
```

### Production

```text
bom_headers
bom_items
production_runs
production_consumptions
production_outputs
```

---

# 16. Inventory Engine Architecture

## Inventory Lifecycle

```text
Business Action
↓
Inventory Event
↓
Inventory Movements
↓
Snapshot Update
↓
Audit Log
```

---

## Inventory Event Types

```text
PURCHASE_RECEIVED
SALE_DEDUCTED
SALE_RETURNED
TRANSFER_DISPATCHED
TRANSFER_RECEIVED
DAMAGE_RECORDED
EXPIRY_MARKED
PRODUCTION_CONSUMED
PRODUCTION_OUTPUT_RECEIVED
STOCK_ADJUSTMENT_APPROVED
```

---

## Concurrency Handling

Inventory-sensitive operations use:

```text
PostgreSQL row locking
FOR UPDATE
```

No operation may bypass transactional validation.

---

# 17. Financial Ledger Architecture

## Retailer Ledger

Tracks:

```text
invoice debit
payment credit
returns
adjustments
```

---

## Financial Ledger

Tracks:

```text
cash
sales revenue
inventory
receivables
payables
COGS
```

---

# 18. Backend Architecture

## Stack

```text
Node.js
NestJS
Prisma
Redis
BullMQ
```

---

## Backend Structure

```text
Controllers
↓
Application Services
↓
Domain Services
↓
Repositories
↓
PostgreSQL
```

---

## Backend Modules

```text
auth
identity
inventory
sales
finance
production
analytics
notifications
queues
websocket
```

---

## API Principles

```text
REST-first
versioned APIs
idempotent critical endpoints
transaction-safe posting
RBAC enforced
branch-aware requests
```

---

## Critical Transactional APIs

```text
invoice posting
payment recording
stock transfer dispatch
stock transfer receive
stock adjustment posting
production completion
```

---

# 19. Frontend Architecture

## Stack

```text
Next.js
TypeScript
Tailwind
PWA
TanStack Query
Zustand
IndexedDB
```

---

## Frontend Philosophy

The frontend is an operations console.

It prioritizes:

```text
clarity
speed
offline support
touch interaction
low bandwidth
```

---

## Supported Devices

```text
Desktop
Tablet
Android phones
Shared devices
```

---

## Frontend Modules

```text
Admin Dashboard
Warehouse Dashboard
Billing Screen
Inventory Screen
Production Screen
Retailer Ledger
Sales Rep Mobile App
```

---

## Offline Architecture

Uses:

```text
IndexedDB
sync queue
conflict resolution
idempotency keys
```

---

# 20. DevOps & Deployment Architecture

## Infrastructure Stack

```text
DigitalOcean
Docker
PostgreSQL
Redis
Cloudflare
Object Storage
GitHub Actions
```

---

## Deployment Topology

```text
Cloudflare
↓
Nginx
↓
Docker Services
 ├── Frontend
 ├── Backend API
 ├── Queue Worker
 ├── Redis
 └── WebSocket
↓
Managed PostgreSQL
↓
Object Storage
```

---

## Environments

```text
Development
Staging
Production
```

---

## Initial Production Size

```text
2 vCPU
4GB RAM
80GB SSD
```

---

# 21. Observability & Monitoring

## Monitoring Stack

```text
Sentry
Uptime Kuma
DigitalOcean Monitoring
Structured Logs
```

---

## Critical Monitoring Areas

```text
API uptime
queue failures
inventory sync issues
database usage
Redis memory
worker crashes
```

---

# 22. Scaling Strategy

## Phase 1

```text
single application droplet
```

## Phase 2

```text
separate worker process
```

## Phase 3

```text
separate websocket process
```

## Phase 4

```text
multiple API nodes
load balancer
read replica
```

---

# 23. Disaster Recovery & Backup Strategy

## Backup Targets

```text
PostgreSQL
object storage
environment configs
invoice PDFs
audit logs
```

---

## Recovery Principles

```text
daily backups
weekly snapshots
restore testing
migration rollback plans
```

---

# 24. Operational Workflows

## Invoice Posting Workflow

```text
Create Draft Invoice
↓
Validate Stock
↓
Lock Snapshot Rows
↓
Create Inventory Event
↓
Insert Inventory Movements
↓
Update Snapshots
↓
Create Ledger Entries
↓
Create Audit Log
↓
Commit Transaction
↓
Generate Receipt
```

---

## Stock Transfer Workflow

```text
Create Transfer
↓
Approve Transfer
↓
Dispatch Stock
↓
Move To IN_TRANSIT
↓
Receive Transfer
↓
Move To AVAILABLE
↓
Variance Review
↓
Close Transfer
```

---

## Production Workflow

```text
Production Plan
↓
Reserve Materials
↓
Consume Raw Materials
↓
Produce Finished Goods
↓
Create Finished Batch
↓
Record Wastage
↓
Close Production Run
```

---

# 25. Lifecycle Flows

## Inventory Lifecycle

```text
Purchase
↓
Warehouse
↓
Transfer
↓
Store
↓
Sale
↓
Return / Damage / Expiry
```

---

## Financial Lifecycle

```text
Invoice
↓
Retailer Due
↓
Payment
↓
Ledger Settlement
```

---

# 26. Integration Strategy

## Initial Integrations

```text
Barcode scanning
Receipt printing
WhatsApp notifications
PDF generation
Object storage
```

## Future Integrations

```text
Bank APIs
Payment gateways
Government VAT systems
Supplier systems
Forecasting engines
```

---

# 27. Phase-Based Rollout Strategy

## Phase Philosophy

The system must evolve carefully.

Each phase must:

```text
stabilize operations
validate workflows
preserve ledger integrity
prevent schema collapse
```

---

# 28. 7-Phase Implementation Roadmap

## Phase 1

```text
Core Inventory + Billing
```

## Phase 2

```text
Warehouse + Sales Reps
```

## Phase 3

```text
Production System
```

## Phase 4

```text
Transfers + Reconciliation
```

## Phase 5

```text
Retailer Ordering Ecosystem
```

## Phase 6

```text
Credit + Financial Control
```

## Phase 7

```text
AI Forecasting + Intelligence
```

---

# 29. Engineering Standards

## Mandatory Rules

```text
No direct stock mutation
No bypassing ledger posting
No silent financial edits
No unsafe migrations
No destructive production changes
```

---

## Code Quality

```text
TypeScript strict mode
DTO validation
transaction-safe services
RBAC enforcement
audit logging
modular architecture
```

---

## Database Standards

```text
foreign keys enforced
unique constraints enforced
branch-aware tables
immutable ledgers
```

---

# 30. Risk Analysis

## Operational Risks

```text
inventory mismatch
warehouse bypass behavior
staff resistance
offline sync conflicts
manual operational habits
```

---

## Technical Risks

```text
duplicate posting
negative stock corruption
migration failure
queue instability
concurrent stock deduction
```

---

## Scaling Risks

```text
premature microservices
poor schema evolution
analytics overload
worker bottlenecks
```

---

# 31. Future Scaling Notes

## Planned Evolution

### Infrastructure

```text
multi-node API
load balancer
read replicas
analytics workers
Redis cluster
```

### Business Intelligence

```text
demand forecasting
route optimization
credit scoring
procurement intelligence
store scoring
```

### Operational Intelligence

```text
low-stock prediction
expiry prediction
dead-stock detection
sales recommendations
```

---

# 32. Final Architecture Position

This architecture is designed to become:

```text
a Nepal FMCG operational infrastructure layer
```

The system is intentionally:

```text
ledger-first
audit-heavy
offline-tolerant
branch-aware
inventory-safe
financially-correct
modular
scalable
operationally-grounded
```

The architecture prioritizes:

```text
correctness before convenience
stability before complexity
operations before aesthetics
scaling through discipline
```

This document is the permanent engineering source of truth for implementation, scaling, onboarding, operations, and future platform evolution.

I’ve compiled the complete engineering architecture into a unified master document covering:

* system philosophy
* inventory engine
* database architecture
* backend architecture
* frontend architecture
* DevOps/deployment
* operational workflows
* security/RBAC
* scaling strategy
* disaster recovery
* implementation roadmap
* risk analysis
* future evolution

It is now structured as a production-grade engineering reference suitable for:

* implementation teams
* Codex/AI coding agents
* onboarding engineers
* infrastructure planning
* phased rollout governance
* long-term scaling decisions.
