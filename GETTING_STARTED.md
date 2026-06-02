# PASALO OS — Getting Started Guide

## Phase 1 Quick Setup (5 minutes)

### Prerequisites

- Docker Desktop (Windows/Mac) or Docker + Docker Compose (Linux)
- Git
- Terminal/Command Prompt

### Step 1: Clone & Setup

```bash
# Navigate to your workspace
cd d:\pasalo.os

# Copy environment files
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

### Step 2: Start Services

```bash
# Start all services
docker-compose up -d

# Wait for services to start (30-60 seconds)
# Check status
docker-compose ps
```

### Step 3: Initialize Database

```bash
# Run database migrations
docker-compose exec backend npm run db:migrate

# Seed initial data (when available)
docker-compose exec backend npm run db:seed
```

### Step 4: Access Application

- **Frontend:** http://localhost:3001
- **API:** http://localhost:3000/api
- **Swagger Docs:** http://localhost:3000/docs
- **Database Studio:** Run `docker-compose exec backend npm run db:studio`

---

## Architecture Overview

### Three-Tier Structure

```
┌─────────────────────────────┐
│   Frontend (Next.js PWA)    │  http://localhost:3001
│  React + TypeScript + PWA   │
└──────────────┬──────────────┘
               │ HTTP/REST
┌──────────────▼──────────────┐
│   Backend (NestJS API)      │  http://localhost:3000
│  Node.js + PostgreSQL       │
│  Inventory Ledger + RBAC    │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────┐
│   Database (PostgreSQL)     │  localhost:5432
│  Ledger-based architecture  │
└─────────────────────────────┘
```

### Key Concepts

**Inventory Ledger:**
Every stock change creates an immutable record:
```
Event → Movement → Snapshot → Reports
```

**Multi-Tenant:**
- Branch scope isolation
- Warehouse management per branch
- User permissions by location

**Audit Trail:**
- Complete action history
- Who, what, when, why
- No hard deletes

---

## Core Modules Overview

### 1. Authentication (Auth Module)
- User login/logout
- JWT token management
- Session tracking
- Device registration

### 2. Organization (Organization Module)
- Multiple branches
- Warehouse management
- Store/retail management
- Location hierarchy

### 3. Products (Catalog Module)
- Product master with SKU
- Categories and brands
- Unit management (carton, piece, etc.)
- Batch tracking with expiry dates

### 4. Inventory (Inventory Module) **← Core**
- Stock movements ledger
- Real-time snapshots
- Multiple stock states
- Batch + expiry tracking
- Warehouse-wise stock view

### 5. Billing (Sales Module)
- Invoice creation
- POS integration
- Payment recording
- Return handling

### 6. Auditing (Common Module)
- Action audit logs
- Change tracking
- Branch accountability

---

## Database Schema Highlights

### Immutable Ledgers

```sql
-- Stock Movement History (Ledger)
inventory_movements
├── id (UUID)
├── productId → Product
├── quantity
├── movementType (TRANSFER, SALE, RETURN, etc)
├── status (PENDING, APPROVED, COMPLETED)
├── referenceId (Invoice, Transfer Order, etc)
└── createdAt, approvedAt

-- Stock Snapshot (Optimization Layer)
inventory_snapshots
├── productId → Product
├── batchId → Batch
├── warehouseId → Warehouse
├── quantity (derived from movements)
├── reservedQuantity
└── lastUpdatedAt
```

### Multi-Tenant Design

```sql
-- User Scoping
user_roles
├── userId → User
├── roleId → Role
├── branchId → Branch (optional)
├── warehouseId → Warehouse (optional)
└── storeId → Store (optional)

-- Data Isolation
invoices
├── branchId → Branch (scoped)
├── storeId → Store (scoped)
└── ...

audit_logs
├── userId → User (who)
├── branchId → Branch (which branch)
├── entity, action, changes (what)
└── createdAt (when)
```

---

## Common Development Tasks

### View Database

```bash
# Open Prisma Studio (visual DB manager)
docker-compose exec backend npm run db:studio

# Then open http://localhost:5555 in browser
```

### Check API Health

```bash
# Backend health check
curl http://localhost:3000/health

# Frontend health check
curl http://localhost:3001
```

### View Logs

```bash
# Backend logs
docker-compose logs -f backend

# Frontend logs
docker-compose logs -f frontend

# Database logs
docker-compose logs -f postgres

# All logs
docker-compose logs -f
```

### Reset Database

```bash
# Warning: This deletes all data
docker-compose down -v
docker-compose up -d postgres redis
docker-compose exec postgres psql -U pasalo -c "CREATE DATABASE pasalo_dev"
docker-compose up -d backend frontend
docker-compose exec backend npm run db:migrate
```

---

## Next Steps

### Understanding the System

1. **Read Architecture:**
   - `docs/architecture/01-system-foundation.md` — Overall philosophy
   - `docs/architecture/03-inventory-engine.md` — Inventory design
   - `docs/architecture/04-database-architecture.md` — Schema details

2. **Explore Code:**
   - Backend: `backend/src/inventory/` — Core ledger logic
   - Backend: `backend/src/sales/` — Billing workflows
   - Frontend: `frontend/src/app/` — Page routes

3. **Try APIs:**
   - Open http://localhost:3000/docs
   - Try endpoints interactively

### Making Changes

1. **Backend Changes:**
   ```bash
   # Edit files in backend/src/
   docker-compose exec backend npm run start:dev
   # Changes auto-reload
   ```

2. **Frontend Changes:**
   ```bash
   # Edit files in frontend/src/
   docker-compose exec frontend npm run dev
   # Changes auto-reload
   ```

3. **Database Schema Changes:**
   ```bash
   # Edit backend/prisma/schema.prisma
   docker-compose exec backend npm run db:migrate -- --name DescribeChange
   ```

---

## Troubleshooting

### Service Won't Start

```bash
# Check all services status
docker-compose ps

# Restart specific service
docker-compose restart backend

# View service logs
docker-compose logs backend --tail 50
```

### Database Connection Error

```bash
# Check PostgreSQL is running
docker-compose exec postgres psql -U pasalo -d pasalo_dev -c "SELECT 1"

# Check environment variables
docker-compose exec backend env | grep DATABASE_URL
```

### Port Already in Use

```bash
# Find and kill process using port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or change port in docker-compose.yml
```

### Prisma Generation Error

```bash
cd backend
rm -rf node_modules/.prisma
npm install
npm run db:generate
docker-compose up -d backend
```

---

## Phase 1 Deliverables

**✅ Completed:**
- Project scaffolding
- Database schema (Prisma)
- Backend skeleton (NestJS modules)
- Frontend skeleton (Next.js PWA)
- Docker setup (Docker Compose)
- CI/CD pipelines (GitHub Actions)

**📋 To Implement (Phase 1 Full):**
- Authentication service
- RBAC implementation
- Inventory ledger service
- Invoice posting transaction
- Barcode scanning integration
- Frontend UI components
- API endpoints

**⏳ Future Phases:**
- Phase 2: Warehouse transfers
- Phase 3: Production
- Phase 4: Reconciliation
- Phase 5: Retailer ordering
- Phase 6: Financial control
- Phase 7: Analytics

---

## Support

- **Questions?** Check `docs/architecture/` for design docs
- **API Help?** Visit http://localhost:3000/docs
- **Database?** Run `npm run db:studio` to explore

---

**Ready to build!** 🚀
