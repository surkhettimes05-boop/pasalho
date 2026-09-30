-- Storefront dispatch and direct-customer delivery support.

-- Direct store invoices may originate from an InventoryLocation without a
-- Warehouse parent. Existing B2B invoices keep their warehouse references.
ALTER TABLE "Invoice"
  ALTER COLUMN "warehouseId" DROP NOT NULL;

-- Direct-customer deliveries do not have a Retailer.
ALTER TABLE "DeliveryItem"
  ALTER COLUMN "retailerId" DROP NOT NULL;

-- Refuse to silently discard any legacy orderId values that do not reference
-- a real sales order before adding the foreign key.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "DeliveryItem" di
    LEFT JOIN "SalesOrder" so ON so.id = di."orderId"
    WHERE di."orderId" IS NOT NULL
      AND so.id IS NULL
  ) THEN
    RAISE EXCEPTION 'DeliveryItem contains orderId values that do not reference SalesOrder';
  END IF;
END $$;

ALTER TABLE "DeliveryItem"
  ADD CONSTRAINT "DeliveryItem_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DeliveryItem_orderId_idx"
  ON "DeliveryItem"("orderId");
