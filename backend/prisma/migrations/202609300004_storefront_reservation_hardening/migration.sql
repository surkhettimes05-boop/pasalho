-- P0-05: unit-correct snapshots and attributable storefront reservations.

DROP INDEX IF EXISTS "InventorySnapshot_locationId_productId_batchId_stockState_key";
CREATE UNIQUE INDEX "InventorySnapshot_locationId_productId_batchId_stockState_unitId_key"
  ON "InventorySnapshot"("locationId", "productId", "batchId", "stockState", "unitId");

ALTER TABLE "StockReservation"
  ADD COLUMN "expiresAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "StockReservationItem_reservationId_salesOrderItemId_key";
CREATE INDEX "StockReservationItem_reservationId_salesOrderItemId_idx"
  ON "StockReservationItem"("reservationId", "salesOrderItemId");
CREATE INDEX "StockReservationItem_reservationId_productId_batchId_unitId_idx"
  ON "StockReservationItem"("reservationId", "productId", "batchId", "unitId");
CREATE INDEX "StockReservation_expiresAt_status_idx"
  ON "StockReservation"("expiresAt", "status");
