-- Store fulfillment picking state for storefront orders.
CREATE TYPE "FulfillmentShortageAction" AS ENUM ('REMOVE_ITEM', 'CONTACT_CUSTOMER');

CREATE TABLE "FulfillmentPickItem" (
    "id" TEXT NOT NULL,
    "salesOrderItemId" TEXT NOT NULL,
    "orderedQuantity" DECIMAL(18,6) NOT NULL,
    "orderedBaseQty" DECIMAL(18,6) NOT NULL,
    "pickedQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "pickedBaseQty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "shortageBaseQty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "shortageAction" "FulfillmentShortageAction",
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "pickedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FulfillmentPickItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FulfillmentPickItem_salesOrderItemId_key"
  ON "FulfillmentPickItem"("salesOrderItemId");
CREATE INDEX "FulfillmentPickItem_pickedById_idx"
  ON "FulfillmentPickItem"("pickedById");
CREATE INDEX "FulfillmentPickItem_isResolved_idx"
  ON "FulfillmentPickItem"("isResolved");

ALTER TABLE "FulfillmentPickItem"
  ADD CONSTRAINT "FulfillmentPickItem_salesOrderItemId_fkey"
  FOREIGN KEY ("salesOrderItemId") REFERENCES "SalesOrderItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FulfillmentPickItem"
  ADD CONSTRAINT "FulfillmentPickItem_pickedById_fkey"
  FOREIGN KEY ("pickedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing operational roles should be able to use the existing order/delivery
-- permissions for the storefront fulfillment queue when those roles exist.
INSERT INTO "RolePermission" ("roleId", "permissionId", "createdAt")
SELECT r.id, p.id, CURRENT_TIMESTAMP
FROM "Role" r
JOIN "Permission" p ON p.code IN ('sales-orders.view', 'deliveries.manage')
WHERE r.code IN ('STORE_STAFF', 'BRANCH_MANAGER')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
