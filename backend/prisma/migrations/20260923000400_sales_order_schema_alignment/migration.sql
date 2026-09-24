-- Align the sales-order tables with the current Prisma schema and service contract.
ALTER TABLE "SalesOrder"
  ADD COLUMN "discountTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "taxTotal" DECIMAL(18,4) NOT NULL DEFAULT 0;

ALTER TABLE "SalesOrderItem"
  ADD COLUMN "discountAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "taxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "SalesOrder_idempotencyKey_key"
  ON "SalesOrder"("idempotencyKey");

DROP INDEX "StockReservation_branchId_idx";