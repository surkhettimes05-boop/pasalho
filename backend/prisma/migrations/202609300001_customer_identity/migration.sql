-- Customer identity foundation for Pasalho customer commerce.
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'DELETED');
CREATE TYPE "CustomerAddressLabel" AS ENUM ('HOME', 'WORK', 'OTHER');

CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "fullName" TEXT,
    "email" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerSession" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "deviceId" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "CustomerSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerOtpChallenge" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerOtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" "CustomerAddressLabel" NOT NULL DEFAULT 'HOME',
    "customLabel" TEXT,
    "recipientName" TEXT,
    "phone" TEXT,
    "province" TEXT,
    "district" TEXT,
    "municipality" TEXT,
    "ward" TEXT,
    "area" TEXT NOT NULL,
    "street" TEXT,
    "landmark" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "instructions" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");
CREATE INDEX "Customer_status_idx" ON "Customer"("status");
CREATE INDEX "Customer_createdAt_idx" ON "Customer"("createdAt");
CREATE INDEX "CustomerSession_customerId_idx" ON "CustomerSession"("customerId");
CREATE INDEX "CustomerSession_refreshExpiresAt_idx" ON "CustomerSession"("refreshExpiresAt");
CREATE INDEX "CustomerOtpChallenge_phone_createdAt_idx" ON "CustomerOtpChallenge"("phone", "createdAt");
CREATE INDEX "CustomerOtpChallenge_expiresAt_idx" ON "CustomerOtpChallenge"("expiresAt");
CREATE INDEX "CustomerAddress_customerId_idx" ON "CustomerAddress"("customerId");
CREATE INDEX "CustomerAddress_customerId_isDefault_idx" ON "CustomerAddress"("customerId", "isDefault");

ALTER TABLE "CustomerSession" ADD CONSTRAINT "CustomerSession_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
