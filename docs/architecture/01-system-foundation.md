# FMCG Distribution Operating System — System Foundation

## 1. Executive Architecture Summary
This document serves as the foundational architectural charter for the Nepal FMCG Distribution Operating System. It defines the strategic, operational, and technical constraints required to build a production-grade, highly resilient ERP and Warehouse Management System (WMS). This is not a standard CRUD application; it is a mission-critical transactional engine where inventory state is the absolute source of truth. All future technical decisions—ranging from database schemas to frontend state management—must adhere to the principles outlined in this document.

## 2. Business Context
The system will manage the end-to-end distribution lifecycle for Fast-Moving Consumer Goods (FMCG) in a fragmented, high-velocity market. The business operates through multiple geographic branches, serving thousands of retailers via a network of sales representatives and delivery logistics. The operation relies heavily on extending rolling credit, managing vast SKUs across disparate warehouses, and reconciling complex billing cycles. The system must act as the unified ledger for inventory, cash flow, and credit, eliminating manual reconciliation overhead and reducing pilferage.

## 3. Nepal-Specific Operating Realities
Any architecture built for this environment must defensively account for the following local constraints:
*   **Unreliable Infrastructure:** Intermittent internet connectivity and power outages are common, especially outside the Kathmandu valley. The system must degrade gracefully and support offline-first operations where critical.
*   **Hardware Constraints:** Operations heavily rely on shared, low-end mobile devices and legacy desktop hardware.
*   **Credit-Driven Economy:** The "khata" (ledger/credit) culture is ubiquitous. Transactions are rarely entirely cash upfront; therefore, the system must handle partial payments, rolling balances, and aging credit seamlessly.
*   **Operational Literacy:** End-users (warehouse staff, delivery drivers) may possess low technical literacy. UI/UX must prioritize large touch targets, color-coded statuses, and minimal typing (favoring barcode scanning and large buttons).
*   **Fragmented Logistics:** Addresses are often landmark-based rather than standardized. Delivery routing requires flexibility.

## 4. System Vision
To provide a unified, highly available, and auditable operating system that digitizes the entire FMCG supply chain—from procurement and warehouse management to point-of-sale and retailer credit—while remaining robust enough to withstand the infrastructural challenges of the Nepalese market.

## 5. Core Architecture Philosophy
*   **Determinism over Flexibility:** System states must be deterministic. We do not allow "soft deletes" or arbitrary state mutations that obscure history.
*   **Event-Driven Immutability:** Changes to critical entities (inventory, ledgers) must be represented as immutable logs or ledgers rather than destructive updates.
*   **Graceful Degradation:** The frontend must cache critical data to allow read-access and queued write-access when offline, syncing automatically upon network restoration.
*   **Modularity:** The system will be divided into strictly bounded contexts to prevent monolithic entanglement, allowing separate scaling of high-throughput domains (like POS/Billing) from back-office domains (like Reporting).

## 6. Inventory as Source of Truth
Inventory is the physical manifestation of capital. Therefore:
*   **No Direct Mutations:** No module (Sales, Procurement, Returns) may directly `UPDATE` stock quantities.
*   **Ledger-Based Inventory:** All stock changes are recorded as double-entry ledger movements (e.g., `Location A` to `Location B`, or `Supplier` to `Warehouse`). The current stock is a derived state (sum of movements).
*   **Negative Stock Prevention:** The system must strictly enforce database-level locking mechanisms to prevent race conditions from allocating the same physical item twice, preventing negative inventory states.

## 7. Operational Design Principles
*   **Scan-First:** All physical movements (picking, packing, delivery) must be verifiable via barcode scanning.
*   **Role-Based Isolation:** A user only sees what they need to execute their immediate task. Extraneous information is stripped to prevent cognitive overload.
*   **Exception-Driven Management:** Managers should not need to monitor everything; the system surfaces exceptions (e.g., credit limit breached, stockout risk, delivery delayed) automatically.

## 8. Technical Design Principles
*   **Frontend:** PWA-first using Next.js. Must rely on Service Workers, IndexedDB, and sophisticated caching for offline resilience.
*   **Backend:** Node.js API with strict input validation. Stateless application servers.
*   **Database:** PostgreSQL as the relational anchor. Prisma as the ORM with strict transaction boundaries.
*   **Caching/Queues:** Redis for session management, rate limiting, and background job queuing (e.g., report generation, bulk SMS, offline batch processing).
*   **Containerization:** Dockerized services for uniform deployment across development, staging, and production environments (Target: DigitalOcean).

## 9. Bounded Context Overview
The system will be partitioned into the following logical domains:
1.  **Identity & Access (IAM):** Users, Roles, Permissions, Branches.
2.  **Catalog Management:** Products, SKUs, Categories, Barcodes, Pricing Tiers.
3.  **Inventory & Warehouse (WMS):** Stock Ledgers, Bins/Locations, Transfers, Adjustments, Audits.
4.  **Order Management (OMS):** Sales Orders, Purchase Orders, Returns.
5.  **Billing & POS:** Invoicing, Taxes, Receipt Generation.
6.  **Financial Ledger:** Retailer Credit, Payments, Cash Book.
7.  **Logistics & Delivery:** Dispatching, Vehicle Tracking, Proof of Delivery.

## 10. High-Level System Architecture
*   **Client Layer:** Next.js PWA (Mobile/Desktop Web).
*   **API Gateway/Routing:** Next.js API Routes or dedicated Node gateway layer.
*   **Application Layer:** Node.js services executing business logic, enforcing transaction boundaries via Prisma.
*   **Data Layer:** PostgreSQL (Primary OLTP), Redis (Cache & Queues).
*   **Background Workers:** Independent Node processes consuming Redis queues for asynchronous, heavy, or delayed tasks.

## 11. User Roles Overview
*   **Super Admin:** Global oversight, configuration.
*   **Branch Manager:** Oversight of a specific geographical hub.
*   **Warehouse Operator:** Receives, picks, packs, and audits physical stock.
*   **Sales Representative (Field):** Captures orders from retailers, collects payments.
*   **Delivery Driver:** Executes dispatches, captures Proof of Delivery (POD).
*   **Cashier/Billing Clerk:** Processes direct sales, manages daily cash register.

## 12. Core Workflows Overview
*   **Procurement to Stock:** PO Creation → Goods Receipt Note (GRN) → Quality Check → Putaway → Stock Ledger Credit.
*   **Order to Cash (Field):** Rep captures Order → Credit Check → Warehouse Pick/Pack → Dispatch → Delivery & POD → Invoice Generation → Ledger Debit.
*   **Direct POS:** Scan Item → Validate Stock → Accept Payment → Generate Invoice & Adjust Stock synchronously.
*   **Returns Management:** Receive Return → Inspect → Restock (Good) or Quarantine (Damaged) → Issue Credit Note.

## 13. Data Integrity Principles
*   **ACID Compliance:** All multi-step operations (e.g., creating an invoice and moving stock) must occur within a single database transaction.
*   **Idempotency:** API endpoints handling state mutations (especially from offline-first clients) must be idempotent to prevent duplicate processing on network retries.
*   **Constraints:** Enforce constraints at the database level (Foreign Keys, Unique Indexes, Check constraints) as the last line of defense against application bugs.

## 14. Auditability Principles
*   **Who, What, When:** Every critical table must track `createdBy`, `updatedBy`, `createdAt`, and `updatedAt`.
*   **Audit Trails:** Changes to sensitive configurations (pricing, credit limits) must generate an audit log entry detailing the before and after states.
*   **Immutability of Financials:** Once an invoice or payment receipt is finalized, it cannot be deleted. Corrections require issuing a Credit Note or Reversal transaction.

## 15. Offline-First Principles
*   **Read Models:** The PWA must aggressively cache product catalogs, pricing, and assigned customer lists using IndexedDB.
*   **Optimistic UI:** For field reps, actions like placing an order should reflect immediately in the UI and queue in the background.
*   **Sync Engine:** A robust background sync process must handle queue processing, conflict resolution, and user notification of failed transactions upon network reconnection.

## 16. Security and Permission Principles
*   **Least Privilege:** Users default to zero access. Permissions are explicitly granted via roles.
*   **Branch Isolation:** A user assigned to Branch A cannot view or manipulate data for Branch B unless explicitly granted cross-branch access.
*   **Stateless Authentication:** JWT-based authentication with short expirations and Redis-backed refresh tokens for fast revocation.

## 17. Scalability Philosophy
*   **Horizontal Scaling:** Application nodes must be entirely stateless to allow horizontal scaling behind a load balancer.
*   **Read Replicas:** As reporting needs grow, read-heavy queries will be routed to PostgreSQL read replicas to protect the primary OLTP database.
*   **Archival Strategy:** Historical ledger entries older than the active financial year will be partitioned or archived to maintain high performance on active tables.

## 18. Deployment Philosophy
*   **Infrastructure as Code:** Strive for reproducible environments.
*   **Containerization:** Docker ensures parity across environments (Dev, Staging, Prod).
*   **CI/CD Pipeline:** Automated testing must pass before any merge to the main branch. Deployments are automated.

## 19. Phase-Based Rollout Philosophy
*   **Phase 1: The Core Engine.** Catalog, Basic Inventory Ledger, Procurements, and Direct POS. Establishes the source of truth.
*   **Phase 2: B2B & Field Operations.** Sales Rep Ordering, Retailer Credit Ledgers, and basic Delivery Dispatch.
*   **Phase 3: Advanced Logistics & WMS.** Multi-bin tracking, Barcode scanning workflows, Route optimization.
*   **Phase 4: Intelligence.** Analytics, Predictive ordering, AI forecasting.

## 20. Critical Risks and Mitigations
*   **Risk:** Data loss from offline sync conflicts.
    *   **Mitigation:** Timestamp-based conflict resolution, strict idempotency keys, and manual review queues for unresolved conflicts.
*   **Risk:** Negative stock due to race conditions in billing.
    *   **Mitigation:** `SELECT ... FOR UPDATE` row-level locks on stock rows during the checkout transaction.
*   **Risk:** Slow PWA performance on low-end devices.
    *   **Mitigation:** Strict limits on IndexedDB payload sizes; pagination for all lists; virtualization for long lists in the UI.

## 21. Future AI Readiness
*   **Data Structure:** All historical transactions are retained systematically to serve as high-quality training data.
*   **Event Logging:** Key user decisions (e.g., manual stock overrides, delivery delays) are logged with context to train future anomaly detection models.
*   **Decoupled Architecture:** The system allows future AI microservices to subscribe to database events (via logical replication or event queues) without impacting the core transactional engine.
