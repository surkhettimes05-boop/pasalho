-- Keep legacy franchise stores readable until an operator assigns a branch.
-- New stores and inventory receipts enforce an active explicit branch in the service.
ALTER TYPE "InventoryEventType" ADD VALUE IF NOT EXISTS 'FRANCHISE_RECEIPT';
ALTER TYPE "ReferenceType" ADD VALUE IF NOT EXISTS 'FRANCHISE_RECEIPT';

ALTER TABLE "FranchiseStore"
  ADD COLUMN "branchId" TEXT,
  ADD COLUMN "inventoryLocationId" TEXT;

CREATE UNIQUE INDEX "FranchiseStore_inventoryLocationId_key"
  ON "FranchiseStore"("inventoryLocationId");
CREATE INDEX "FranchiseStore_branchId_idx"
  ON "FranchiseStore"("branchId");

ALTER TABLE "FranchiseStore"
  ADD CONSTRAINT "FranchiseStore_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FranchiseStore_inventoryLocationId_fkey"
    FOREIGN KEY ("inventoryLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
