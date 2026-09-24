-- Warehouse-to-store transfer lifecycle and dispatch audit fields.
ALTER TYPE "StockTransferStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED';
ALTER TYPE "StockTransferStatus" ADD VALUE IF NOT EXISTS 'IN_TRANSIT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STOCK_TRANSFER_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'STOCK_TRANSFER_DISPATCHED';

ALTER TABLE "StockTransfer"
  ADD COLUMN "dispatchedById" TEXT,
  ADD COLUMN "dispatchedAt" TIMESTAMP(3),
  ADD COLUMN "externalReference" TEXT;

CREATE UNIQUE INDEX "StockTransfer_externalReference_key"
  ON "StockTransfer"("externalReference");

ALTER TABLE "StockTransfer"
  ADD CONSTRAINT "StockTransfer_dispatchedById_fkey"
  FOREIGN KEY ("dispatchedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
