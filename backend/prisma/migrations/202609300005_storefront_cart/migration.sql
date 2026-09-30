-- P0-06: server-authoritative customer carts.

CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'ABANDONED', 'EXPIRED');

CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "cartToken" TEXT NOT NULL,
    "customerId" TEXT,
    "inventoryLocationId" TEXT NOT NULL,
    "serviceZoneId" TEXT,
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "currency" TEXT NOT NULL DEFAULT 'NPR',
    "subtotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "deliveryFee" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Cart_cartToken_key" ON "Cart"("cartToken");
CREATE INDEX "Cart_customerId_status_idx" ON "Cart"("customerId", "status");
CREATE INDEX "Cart_inventoryLocationId_idx" ON "Cart"("inventoryLocationId");
CREATE INDEX "Cart_expiresAt_idx" ON "Cart"("expiresAt");
CREATE UNIQUE INDEX "CartItem_cartId_productId_unitId_key"
  ON "CartItem"("cartId", "productId", "unitId");
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");

ALTER TABLE "Cart"
  ADD CONSTRAINT "Cart_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Cart"
  ADD CONSTRAINT "Cart_inventoryLocationId_fkey"
  FOREIGN KEY ("inventoryLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cart"
  ADD CONSTRAINT "Cart_serviceZoneId_fkey"
  FOREIGN KEY ("serviceZoneId") REFERENCES "ServiceZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_cartId_fkey"
  FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
