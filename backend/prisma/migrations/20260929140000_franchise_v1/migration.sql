CREATE TYPE "FranchiseSupplyStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PICKING', 'PACKED', 'DISPATCHED', 'RECEIVED', 'CANCELLED');
ALTER TYPE "OrderSource" ADD VALUE IF NOT EXISTS 'FRANCHISE';

CREATE TABLE "FranchisePartner" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FranchisePartner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FranchiseStore" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "partnerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FranchiseStore_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FranchiseStore_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "FranchisePartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "FranchiseSupplyOrder" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "orderNumber" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "salesOrderId" TEXT,
  "status" "FranchiseSupplyStatus" NOT NULL DEFAULT 'REQUESTED',
  "totalAmount" DECIMAL(18,4),
  "requestedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FranchiseSupplyOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FranchiseSupplyOrder_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "FranchiseStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FranchiseSupplyOrder_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "FranchiseSupplyOrderItem" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "quantity" DECIMAL(18,6) NOT NULL CHECK ("quantity" > 0),
  "unitPrice" DECIMAL(18,4),
  "lineTotal" DECIMAL(18,4),
  CONSTRAINT "FranchiseSupplyOrderItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FranchiseSupplyOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "FranchiseSupplyOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FranchiseSupplyOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FranchiseSupplyOrderItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "FranchiseSupplyOrderEvent" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "orderId" TEXT NOT NULL,
  "fromStatus" "FranchiseSupplyStatus",
  "toStatus" "FranchiseSupplyStatus" NOT NULL,
  "actorId" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FranchiseSupplyOrderEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FranchiseSupplyOrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "FranchiseSupplyOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FranchiseSupplyOrder_orderNumber_key" ON "FranchiseSupplyOrder"("orderNumber");
CREATE UNIQUE INDEX "FranchiseSupplyOrder_salesOrderId_key" ON "FranchiseSupplyOrder"("salesOrderId");
CREATE INDEX "FranchisePartner_status_idx" ON "FranchisePartner"("status");
CREATE INDEX "FranchiseStore_partnerId_status_idx" ON "FranchiseStore"("partnerId", "status");
CREATE INDEX "FranchiseSupplyOrder_storeId_status_idx" ON "FranchiseSupplyOrder"("storeId", "status");
CREATE INDEX "FranchiseSupplyOrder_status_createdAt_idx" ON "FranchiseSupplyOrder"("status", "createdAt");
CREATE INDEX "FranchiseSupplyOrderItem_orderId_idx" ON "FranchiseSupplyOrderItem"("orderId");
CREATE INDEX "FranchiseSupplyOrderItem_productId_idx" ON "FranchiseSupplyOrderItem"("productId");
CREATE INDEX "FranchiseSupplyOrderEvent_orderId_createdAt_idx" ON "FranchiseSupplyOrderEvent"("orderId", "createdAt");
