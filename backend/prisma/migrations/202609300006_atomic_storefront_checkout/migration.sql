-- P0-07: authenticated, idempotent storefront checkout and COD payment intent.

ALTER TYPE "SalesOrderStatus" ADD VALUE IF NOT EXISTS 'PICKING';
ALTER TYPE "SalesOrderStatus" ADD VALUE IF NOT EXISTS 'OUT_FOR_DELIVERY';
ALTER TYPE "SalesOrderStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_FULFILLED';
ALTER TYPE "SalesOrderStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "SalesOrderStatus" ADD VALUE IF NOT EXISTS 'REFUND_PENDING';
ALTER TYPE "SalesOrderStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

CREATE TYPE "CommercePaymentMethod" AS ENUM ('COD', 'ESEWA', 'KHALTI', 'BANK');
CREATE TYPE "CommercePaymentStatus" AS ENUM (
  'PENDING',
  'AUTHORIZED',
  'PAID',
  'FAILED',
  'CANCELLED',
  'REFUND_PENDING',
  'REFUNDED',
  'PARTIALLY_REFUNDED'
);
CREATE TYPE "OrderStatusEventActor" AS ENUM ('CUSTOMER', 'STAFF', 'SYSTEM', 'RIDER');

ALTER TABLE "SalesOrder"
  ADD COLUMN "customerId" TEXT,
  ADD COLUMN "customerAddressId" TEXT,
  ADD COLUMN "fulfillmentLocationId" TEXT,
  ADD COLUMN "cartId" TEXT,
  ADD COLUMN "deliveryFee" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "handlingFee" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "couponDiscount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "deliveryAddressSnapshot" JSONB,
  ADD COLUMN "deliveryInstructions" TEXT,
  ADD COLUMN "placedAt" TIMESTAMP(3),
  ADD COLUMN "pickingStartedAt" TIMESTAMP(3),
  ADD COLUMN "packedAt" TIMESTAMP(3),
  ADD COLUMN "outForDeliveryAt" TIMESTAMP(3),
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancellationReason" TEXT;

CREATE UNIQUE INDEX "SalesOrder_cartId_key" ON "SalesOrder"("cartId");
CREATE INDEX "SalesOrder_customerId_createdAt_idx" ON "SalesOrder"("customerId", "createdAt");
CREATE INDEX "SalesOrder_fulfillmentLocationId_status_idx" ON "SalesOrder"("fulfillmentLocationId", "status");
CREATE INDEX "SalesOrder_source_status_createdAt_idx" ON "SalesOrder"("source", "status", "createdAt");

ALTER TABLE "SalesOrder"
  ADD CONSTRAINT "SalesOrder_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesOrder"
  ADD CONSTRAINT "SalesOrder_customerAddressId_fkey"
  FOREIGN KEY ("customerAddressId") REFERENCES "CustomerAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesOrder"
  ADD CONSTRAINT "SalesOrder_fulfillmentLocationId_fkey"
  FOREIGN KEY ("fulfillmentLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrder"
  ADD CONSTRAINT "SalesOrder_cartId_fkey"
  FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CommercePayment" (
    "id" TEXT NOT NULL,
    "paymentNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "method" "CommercePaymentMethod" NOT NULL,
    "status" "CommercePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(18,4) NOT NULL,
    "provider" TEXT,
    "providerReference" TEXT,
    "providerPayload" JSONB,
    "idempotencyKey" TEXT,
    "authorizedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommercePayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommercePayment_paymentNo_key" ON "CommercePayment"("paymentNo");
CREATE UNIQUE INDEX "CommercePayment_idempotencyKey_key" ON "CommercePayment"("idempotencyKey");
CREATE INDEX "CommercePayment_customerId_idx" ON "CommercePayment"("customerId");
CREATE INDEX "CommercePayment_salesOrderId_idx" ON "CommercePayment"("salesOrderId");
CREATE INDEX "CommercePayment_status_idx" ON "CommercePayment"("status");

ALTER TABLE "CommercePayment"
  ADD CONSTRAINT "CommercePayment_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercePayment"
  ADD CONSTRAINT "CommercePayment_salesOrderId_fkey"
  FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "OrderStatusEvent" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "fromStatus" "SalesOrderStatus",
    "toStatus" "SalesOrderStatus" NOT NULL,
    "actorType" "OrderStatusEventActor" NOT NULL,
    "actorUserId" TEXT,
    "customerId" TEXT,
    "reasonCode" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderStatusEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderStatusEvent_salesOrderId_createdAt_idx"
  ON "OrderStatusEvent"("salesOrderId", "createdAt");

ALTER TABLE "OrderStatusEvent"
  ADD CONSTRAINT "OrderStatusEvent_salesOrderId_fkey"
  FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
