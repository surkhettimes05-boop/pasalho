-- Align StockReservation with the Prisma schema's optional Branch relation.
ALTER TABLE "StockReservation"
  ADD COLUMN "branchId" TEXT;

CREATE INDEX "StockReservation_branchId_idx"
  ON "StockReservation"("branchId");

ALTER TABLE "StockReservation"
  ADD CONSTRAINT "StockReservation_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;