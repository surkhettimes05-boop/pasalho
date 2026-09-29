-- One sales-order item may reserve stock from several eligible batches.
DROP INDEX "StockReservationItem_reservationId_salesOrderItemId_key";
CREATE INDEX "StockReservationItem_reservationId_salesOrderItemId_idx"
  ON "StockReservationItem"("reservationId", "salesOrderItemId");
