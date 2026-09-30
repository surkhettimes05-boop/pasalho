-- Hyperlocal serviceability and explicit store fulfillment mapping.
CREATE TYPE "ServiceZoneStatus" AS ENUM ('ACTIVE', 'INACTIVE');

ALTER TABLE "InventoryLocation"
  ADD COLUMN "latitude" DECIMAL(10,7),
  ADD COLUMN "longitude" DECIMAL(10,7);

CREATE TABLE "ServiceZone" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ServiceZoneStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "polygon" JSONB,
    "centerLat" DECIMAL(10,7),
    "centerLng" DECIMAL(10,7),
    "radiusMeters" INTEGER,
    "minOrder" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "deliveryFee" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "freeDeliveryThreshold" DECIMAL(18,4),
    "etaMinMinutes" INTEGER NOT NULL DEFAULT 30,
    "etaMaxMinutes" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceZone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceZoneFulfillmentLocation" (
    "id" TEXT NOT NULL,
    "serviceZoneId" TEXT NOT NULL,
    "inventoryLocationId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxActiveOrders" INTEGER,
    CONSTRAINT "ServiceZoneFulfillmentLocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceZone_code_key" ON "ServiceZone"("code");
CREATE INDEX "ServiceZone_status_priority_idx" ON "ServiceZone"("status", "priority");
CREATE UNIQUE INDEX "ServiceZoneFulfillmentLocation_serviceZoneId_inventoryLocationId_key"
  ON "ServiceZoneFulfillmentLocation"("serviceZoneId", "inventoryLocationId");
CREATE INDEX "ServiceZoneFulfillmentLocation_inventoryLocationId_idx"
  ON "ServiceZoneFulfillmentLocation"("inventoryLocationId");
CREATE INDEX "ServiceZoneFulfillmentLocation_serviceZoneId_isEnabled_priority_idx"
  ON "ServiceZoneFulfillmentLocation"("serviceZoneId", "isEnabled", "priority");

ALTER TABLE "ServiceZoneFulfillmentLocation"
  ADD CONSTRAINT "ServiceZoneFulfillmentLocation_serviceZoneId_fkey"
  FOREIGN KEY ("serviceZoneId") REFERENCES "ServiceZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceZoneFulfillmentLocation"
  ADD CONSTRAINT "ServiceZoneFulfillmentLocation_inventoryLocationId_fkey"
  FOREIGN KEY ("inventoryLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
