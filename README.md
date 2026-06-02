# PASALO OS — Phase 1 Implementation

**FMCG Distribution Operating System for Nepal**

A production-grade backend and PWA frontend for managing inventory, billing, and warehouse operations.

**Status:** Phase 1 - Core Inventory & Billing Foundation

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+
- PostgreSQL 16 (or use Docker)
- Redis 7 (or use Docker)

### Option 1: Docker Compose (Recommended)

```bash
# Clone and setup
git clone <repo-url>
cd pasalo-os

# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Start all services
docker-compose up -d

# Run database migrations
docker-compose exec backend npm run db:migrate
```

Services will be available at:
- **API:** http://localhost:3000/api
- **Swagger Docs:** http://localhost:3000/docs
- **Frontend:** http://localhost:3001
- **Nginx:** http://localhost:80

### Option 2: Local Development

#### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Database setup
npm run db:push
npm run db:seed  # optional

# Start development server
npm run start:dev

# API runs on http://localhost:3000
# Swagger docs on http://localhost:3000/docs
```

#### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Start development server
npm run dev

# Frontend runs on http://localhost:3001
```

---

## Project Structure

```
pasalo-os/
├── backend/               # NestJS API server
│   ├── src/
│   │   ├── auth/         # Authentication module
│   │   ├── identity/     # Users, roles, permissions
│   │   ├── organization/ # Branches, warehouses, stores
│   │   ├── catalog/      # Products, categories, units
│   │   ├── inventory/    # Inventory ledger & management
│   │   ├── sales/        # Invoices, payments
│   │   └── common/       # Shared guards, interceptors
│   ├── prisma/           # Database schema
│   └── Dockerfile
│
├── frontend/              # Next.js PWA frontend
│   ├── src/
│   │   ├── app/          # Page routes
│   │   ├── components/   # Reusable components
│   │   ├── lib/          # Utilities, API client
│   │   └── styles/       # Global styles
│   ├── public/           # Static assets & PWA manifest
│   └── Dockerfile
│
├── infra/                 # Infrastructure
│   ├── nginx.conf
│   └── docker-compose.yml
│
├── docs/                  # Architecture documentation
│   └── architecture/      # Phase roadmap, design docs
│
└── .github/workflows/     # CI/CD pipelines
```

---

## Key Features (Phase 1)

### Core Modules

✅ **Authentication & RBAC**
- User login/logout
- Role-based access control
- Branch/warehouse/store scoping
- Device session tracking

✅ **Organization**
- Multi-branch support
- Warehouse management
- Store/retail point management
- Location-based inventory tracking

✅ **Catalog**
- Product & SKU management
- Categories & brands
- Unit conversions (carton, piece, etc.)
- Batch tracking with expiry dates

✅ **Inventory (Ledger-Based)**
- Immutable stock movement ledger
- Real-time inventory snapshots
- Stock states (available, reserved, in-transit, etc.)
- Batch & expiry tracking
- Stock reservations

✅ **Billing & Sales**
- Invoice creation & posting
- POS billing integration
- Payment recording (cash, cheque, bank transfer)
- Return handling

✅ **Barcode & Scanning**
- Barcode lookup integration
- Scanning workflow support
- Receipt printing

✅ **Audit & Compliance**
- Complete audit trail
- Immutable event logs
- Branch/warehouse accountability

---

## Architecture Principles

### 1. Inventory is Sacred
Stock is never directly mutated. All changes flow through:
```
Business Action → Inventory Event → Inventory Movement → Snapshot Update
```

### 2. Ledger-Driven
Two immutable ledgers form the backbone:
- `inventory_movements` — Stock truth
- `financial_ledger_entries` — Money truth (future phases)

### 3. Branch-Aware from Day One
Every action knows:
- Who is doing it (user)
- From which branch
- From which warehouse/store
- Under which role

### 4. Offline-First Design
Operations work offline, sync when connected.
Uses IndexedDB locally with eventual sync to PostgreSQL.

### 5. Auditability > Convenience
No silent edits. All corrections use reversals/adjustments.
Complete history preserved forever.

---

## API Documentation

### Authentication

```bash
# Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

# Response
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": { ... }
}
```

### Inventory Operations

```bash
# Get warehouse stock
GET /api/inventory/warehouse/:warehouseId/stock

# Get stock snapshots
GET /api/inventory/snapshots?productId=xxx&warehouseId=xxx

# Record stock movement
POST /api/inventory/movements
{
  "productId": "xxx",
  "batchId": "xxx",
  "quantity": 100,
  "movementType": "TRANSFER",
  "sourceLocationId": "xxx",
  "destLocationId": "xxx"
}
```

### Billing

```bash
# Create invoice
POST /api/sales/invoices
{
  "branchId": "xxx",
  "storeId": "xxx",
  "items": [
    {
      "productId": "xxx",
      "quantity": 5,
      "unitPrice": 100
    }
  ]
}

# Post invoice (finalize)
POST /api/sales/invoices/:id/post

# Record payment
POST /api/sales/payments
{
  "invoiceId": "xxx",
  "amount": 500,
  "paymentMethod": "CASH"
}
```

Full API docs available at `http://localhost:3000/docs`

---

## Database Schema

### Key Tables

**Identity:**
- `users` — System users
- `roles` — User roles
- `permissions` — Fine-grained permissions
- `user_roles` — User-role assignments with scope

**Organization:**
- `branches` — Business branches
- `warehouses` — Storage locations
- `stores` — Retail points
- `inventory_locations` — Warehouse shelf/bin locations

**Catalog:**
- `products` — Product master
- `categories`, `brands`, `units`
- `product_units` — Unit conversions
- `batches` — Stock batches with expiry

**Inventory (Ledger-Based):**
- `inventory_events` — Immutable stock events
- `inventory_movements` — Ledger of all movements
- `inventory_snapshots` — Optimized current stock view
- `stock_reservations` — Reserved inventory

**Sales:**
- `invoices`, `invoice_items`
- `payments` — Payment records

**Audit:**
- `audit_logs` — Complete action history

---

## Development Workflow

### Adding a New Feature

1. **Design Phase**
   - Update relevant docs in `docs/architecture/`
   - Review with team

2. **Backend**
   ```bash
   cd backend
   
   # Update Prisma schema if DB changes needed
   # Run migration: npm run db:migrate
   
   # Create module: src/mymodule/
   # Create service, controller, DTO, module files
   
   npm run start:dev
   npm test
   ```

3. **Frontend**
   ```bash
   cd frontend
   
   # Create component/page
   # Add API integration via lib/api/
   # Add Zustand store if needed
   
   npm run dev
   npm run type-check
   npm run lint
   ```

4. **Test & Deploy**
   ```bash
   # Test with Docker Compose
   docker-compose up
   
   # Verify at http://localhost:3000 and http://localhost:3001
   ```

---

## Testing

### Backend Tests

```bash
cd backend
npm test                    # Run all tests
npm run test:watch        # Watch mode
npm run test:cov          # Coverage report
npm run test:e2e          # E2E tests
```

### Frontend Tests

```bash
cd frontend
npm test                   # Run tests (when configured)
npm run type-check        # TypeScript check
npm run lint              # ESLint check
```

---

## Deployment

### To DigitalOcean

1. Create Droplet (2-4 vCPU, 4 GB RAM)
2. Install Docker & Docker Compose
3. Clone repo and set environment variables
4. Run: `docker-compose -f docker-compose.prod.yml up -d`

See `docs/deployment.md` for detailed steps.

---

## Common Tasks

### Database Migrations

```bash
cd backend

# Create migration
npm run db:migrate -- --name AddNewTable

# Sync without migration (dev)
npm run db:push

# Open Prisma Studio
npm run db:studio
```

### User Management

```bash
# Seeds will be added (Phase 2)
# For now, create users via API
POST /api/identity/users
{
  "fullName": "John Doe",
  "phone": "+977981234567",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

### Viewing Logs

```bash
# Docker Compose
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres

# Individual service
docker-compose logs backend --tail 100
```

---

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL
docker-compose exec postgres psql -U pasalo -d pasalo_dev -c "\dt"

# Recreate database
docker-compose down -v
docker-compose up -d postgres
docker-compose exec postgres psql -U pasalo -c "CREATE DATABASE pasalo_dev"
```

### Port Already in Use

```bash
# Backend (3000)
lsof -i :3000 | grep LISTEN
kill -9 <PID>

# Frontend (3001)
lsof -i :3001 | grep LISTEN
kill -9 <PID>
```

### Prisma Client Issues

```bash
cd backend
rm -rf node_modules/.prisma
npm install
npm run db:generate
```

---

## Phase 1 Scope

This Phase 1 includes core functionality to establish operational backbone:

✅ Authentication & RBAC  
✅ Organization structure (branches, warehouses, stores)  
✅ Product & SKU catalog  
✅ Inventory ledger system  
✅ POS billing  
✅ Basic payments  
✅ Barcode scanning  
✅ Audit logging  

⏳ Phase 2: Warehouse Transfer Workflows  
⏳ Phase 3: Production Management  
⏳ Phase 4: Advanced Reconciliation  
⏳ Phase 5: Retailer Ordering  
⏳ Phase 6: Financial & Credit Control  
⏳ Phase 7: Analytics & Intelligence  

---

## Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and commit: `git commit -am 'Add feature'`
3. Push: `git push origin feature/your-feature`
4. Create Pull Request

---

## Support & Documentation

- **Architecture Docs:** `docs/architecture/`
- **API Docs:** http://localhost:3000/docs (when running)
- **Design Philosophy:** `docs/architecture/01-system-foundation.md`
- **Database Schema:** `docs/architecture/04-database-architecture.md`

---

## License

MIT

---

**Built for FMCG Distribution in Nepal** 🇳🇵
