-- Sales-order transaction support: order-owned reservations and persisted idempotency.
ALTER TYPE "OrderSource" ADD VALUE IF NOT EXISTS 'SALES_REP';

CREATE TYPE "StockReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONSUMED', 'CANCELLED');
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "StockReservation" (
  "id" TEXT NOT NULL,
  "salesOrderId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "status" "StockReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockReservationItem" (
  "id" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "salesOrderItemId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "batchId" TEXT,
  "unitId" TEXT NOT NULL,
  "quantity" DECIMAL(18,6) NOT NULL,
  "baseQuantity" DECIMAL(18,6) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockReservationItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IdempotencyRecord" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "status" "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
  "responseStatus" INTEGER,
  "responseBody" JSONB,
  "resourceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockReservationItem_reservationId_salesOrderItemId_key"
  ON "StockReservationItem"("reservationId", "salesOrderItemId");
CREATE UNIQUE INDEX "IdempotencyRecord_scope_key_key"
  ON "IdempotencyRecord"("scope", "key");

CREATE INDEX "StockReservation_salesOrderId_idx" ON "StockReservation"("salesOrderId");
CREATE INDEX "StockReservation_locationId_idx" ON "StockReservation"("locationId");
CREATE INDEX "StockReservation_status_idx" ON "StockReservation"("status");
CREATE INDEX "StockReservationItem_salesOrderItemId_idx" ON "StockReservationItem"("salesOrderItemId");
CREATE INDEX "StockReservationItem_productId_batchId_idx" ON "StockReservationItem"("productId", "batchId");
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");
CREATE INDEX "IdempotencyRecord_status_idx" ON "IdempotencyRecord"("status");

ALTER TABLE "StockReservation"
  ADD CONSTRAINT "StockReservation_salesOrderId_fkey"
  FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockReservation"
  ADD CONSTRAINT "StockReservation_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockReservation"
  ADD CONSTRAINT "StockReservation_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockReservationItem"
  ADD CONSTRAINT "StockReservationItem_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "StockReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockReservationItem"
  ADD CONSTRAINT "StockReservationItem_salesOrderItemId_fkey"
  FOREIGN KEY ("salesOrderItemId") REFERENCES "SalesOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockReservationItem"
  ADD CONSTRAINT "StockReservationItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockReservationItem"
  ADD CONSTRAINT "StockReservationItem_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockReservationItem"
  ADD CONSTRAINT "StockReservationItem_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
