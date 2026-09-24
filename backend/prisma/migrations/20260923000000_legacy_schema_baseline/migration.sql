-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILURE', 'USER_CREATED', 'USER_UPDATED', 'ROLE_ASSIGNED', 'BRANCH_CREATED', 'BRANCH_UPDATED', 'BRANCH_DEACTIVATED', 'WAREHOUSE_CREATED', 'WAREHOUSE_UPDATED', 'WAREHOUSE_DEACTIVATED', 'CATEGORY_CREATED', 'CATEGORY_UPDATED', 'UNIT_CREATED', 'UNIT_UPDATED', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'BATCH_CREATED', 'BATCH_UPDATED', 'STOCK_ADJUSTMENT_CREATED', 'STOCK_ADJUSTMENT_SUBMITTED', 'STOCK_ADJUSTMENT_APPROVED', 'STOCK_ADJUSTMENT_POSTED', 'STOCK_TRANSFER_CREATED', 'STOCK_TRANSFER_SHIPPED', 'STOCK_TRANSFER_RECEIVED', 'RETAILER_CREATED', 'RETAILER_UPDATED', 'SALES_REP_CREATED', 'SALES_REP_UPDATED', 'INVOICE_CREATED', 'INVOICE_UPDATED', 'INVOICE_POSTED', 'INVOICE_VOIDED', 'INVOICE_CANCELLED', 'PAYMENT_RECORDED', 'ROUTE_CREATED', 'ROUTE_UPDATED', 'SALES_ORDER_CREATED', 'SALES_ORDER_CONFIRMED', 'SALES_ORDER_INVOICED', 'SALES_ORDER_CANCELLED', 'DELIVERY_CREATED', 'DELIVERY_UPDATED', 'DELIVERY_COMPLETED', 'STOCK_COUNT_STARTED', 'STOCK_COUNT_UPDATED', 'STOCK_COUNT_SUBMITTED', 'STOCK_COUNT_RECONCILED', 'STOCK_COUNT_CANCELLED', 'DAMAGE_REPORTED', 'DAMAGE_APPROVED', 'DAMAGE_POSTED', 'EXPIRY_DETECTED', 'BATCH_BLOCKED', 'BATCH_EXPIRED', 'RETAILER_LOGIN', 'RETAILER_PIN_SET', 'RETAILER_ORDER_PLACED', 'RETAILER_ORDER_CANCELLED', 'RETAILER_DEVICE_REGISTERED', 'RETAILER_NOTIFICATION_SENT', 'CREDIT_LIMIT_REQUESTED', 'CREDIT_LIMIT_APPROVED', 'CREDIT_LIMIT_REJECTED', 'CASH_SESSION_OPENED', 'CASH_SESSION_CLOSED', 'PAYMENT_ALLOCATED', 'LEDGER_ENTRY_CREATED');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CreditApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DamageReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinancialLedgerEntryType" AS ENUM ('CASH_DEBIT', 'RECEIVABLE_DEBIT', 'SALES_CREDIT', 'PAYMENT_CREDIT', 'EXPENSE_DEBIT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "InventoryEventStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "InventoryEventType" AS ENUM ('OPENING_STOCK', 'MANUAL_ADJUSTMENT', 'STOCK_ADJUSTMENT_APPROVED', 'SALE_DEDUCTED', 'REVERSAL_EVENT', 'STOCK_TRANSFER');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'SALE_DEDUCTION', 'REVERSAL', 'TRANSFER_OUT', 'TRANSFER_IN');

-- CreateEnum
CREATE TYPE "InvoicePaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'POSTED', 'PAID', 'PARTIALLY_PAID', 'CREDIT_OPEN', 'VOIDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('SALE');

-- CreateEnum
CREATE TYPE "MasterDataStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'DISMISSED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LOW_STOCK', 'OUT_OF_STOCK', 'ORDER_CONFIRMED', 'DELIVERY_UPDATE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('STOREFRONT', 'DNP');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'QR', 'BANK', 'WALLET', 'CHEQUE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('RECORDED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ReferenceType" AS ENUM ('STOCK_ADJUSTMENT', 'STOCK_TRANSFER', 'INVOICE', 'PAYMENT', 'RETAILER', 'PRODUCT', 'BATCH', 'BRANCH', 'WAREHOUSE', 'USER', 'ROLE', 'SALES_REP', 'AUTH', 'DASHBOARD', 'ROUTE', 'SALES_ORDER', 'DELIVERY', 'NOTIFICATION', 'STOCK_COUNT', 'DAMAGE_REPORT', 'RETAILER_PORTAL', 'RETAILER_NOTIFICATION', 'RETAILER_LEDGER', 'FINANCIAL_LEDGER', 'CASH_SESSION', 'CREDIT_APPROVAL');

-- CreateEnum
CREATE TYPE "RetailerLedgerEntryType" AS ENUM ('INVOICE_DEBIT', 'PAYMENT_CREDIT', 'REVERSAL', 'ADJUSTMENT_DEBIT', 'ADJUSTMENT_CREDIT', 'CREDIT_LIMIT_INCREASE', 'CREDIT_LIMIT_DECREASE');

-- CreateEnum
CREATE TYPE "RetailerNotificationStatus" AS ENUM ('UNREAD', 'READ');

-- CreateEnum
CREATE TYPE "RetailerNotificationType" AS ENUM ('ORDER_CONFIRMED', 'ORDER_SHIPPED', 'DELIVERY_UPDATE', 'PAYMENT_RECEIVED', 'PROMOTIONAL');

-- CreateEnum
CREATE TYPE "RetailerStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RouteStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'INVOICED', 'CANCELLED', 'PLACED', 'PACKED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "SalesRepStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "StockAdjustmentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockState" AS ENUM ('AVAILABLE', 'RESERVED', 'IN_TRANSIT', 'DAMAGED', 'EXPIRED', 'QUARANTINED', 'RETURNED_PENDING_CHECK', 'ADJUSTED');

-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('DRAFT', 'SHIPPED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INVITED');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" "ReferenceType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "manufacturingDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "supplierName" TEXT,
    "costPrice" DECIMAL(18,4),
    "mrp" DECIMAL(18,4),
    "status" "BatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "region" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "contactPerson" TEXT,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashSession" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "closedById" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingBalance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "closingBalance" DECIMAL(18,4),
    "expectedCash" DECIMAL(18,4),
    "actualCash" DECIMAL(18,4),
    "variance" DECIMAL(18,4),
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditApproval" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "oldLimit" DECIMAL(18,4) NOT NULL,
    "newLimit" DECIMAL(18,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "CreditApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DamageReport" (
    "id" TEXT NOT NULL,
    "reportNo" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "status" "DamageReportStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "postedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DamageReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DamageReportItem" (
    "id" TEXT NOT NULL,
    "damageReportId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "unitId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "baseQuantity" DECIMAL(18,6) NOT NULL,
    "damageType" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DamageReportItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "deliveryNo" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "routeId" TEXT,
    "vehicleRef" TEXT,
    "driverName" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryItem" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "orderId" TEXT,
    "notes" TEXT,
    "isDelivered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceType" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "isTrusted" BOOLEAN NOT NULL DEFAULT false,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpiryEvent" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "daysToExpiry" INTEGER NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActedUpon" BOOLEAN NOT NULL DEFAULT false,
    "actionNote" TEXT,

    CONSTRAINT "ExpiryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialLedgerEntry" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "entryType" "FinancialLedgerEntryType" NOT NULL,
    "referenceType" "ReferenceType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "debitAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "creditAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryEvent" (
    "id" TEXT NOT NULL,
    "eventType" "InventoryEventType" NOT NULL,
    "eventStatus" "InventoryEventStatus" NOT NULL DEFAULT 'POSTED',
    "branchId" TEXT NOT NULL,
    "referenceType" "ReferenceType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "reversalOfEventId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLocation" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'WAREHOUSE',
    "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "inventoryEventId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "stockState" "StockState" NOT NULL DEFAULT 'AVAILABLE',
    "quantityDelta" DECIMAL(18,6) NOT NULL,
    "baseQuantityDelta" DECIMAL(18,6) NOT NULL,
    "unitId" TEXT NOT NULL,
    "movementType" "InventoryMovementType" NOT NULL,
    "referenceType" "ReferenceType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "reasonCode" TEXT,
    "createdById" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySnapshot" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "stockState" "StockState" NOT NULL DEFAULT 'AVAILABLE',
    "unitId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "baseQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "lastMovementId" TEXT,
    "lastMovementAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventorySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceType" "InvoiceType" NOT NULL DEFAULT 'SALE',
    "retailerId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "sourceLocationId" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" "InvoicePaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "subtotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "dueAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "postedById" TEXT,
    "voidedById" TEXT,
    "postedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "unitId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "baseQuantity" DECIMAL(18,6) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "discountAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "success" BOOLEAN NOT NULL,
    "failureReason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT,
    "type" "NotificationType" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" "ReferenceType",
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "retailerId" TEXT,
    "invoiceId" TEXT,
    "amount" DECIMAL(18,4) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "referenceNumber" TEXT,
    "receivedById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PaymentStatus" NOT NULL DEFAULT 'RECORDED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "skuCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "brandId" TEXT,
    "defaultUnitId" TEXT NOT NULL,
    "barcode" TEXT,
    "isBatchTracked" BOOLEAN NOT NULL DEFAULT true,
    "isExpiryTracked" BOOLEAN NOT NULL DEFAULT false,
    "costPrice" DECIMAL(18,4),
    "mrp" DECIMAL(18,4),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "imageUrl" TEXT,
    "sellingPrice" DECIMAL(18,4),
    "stock" INTEGER NOT NULL DEFAULT 0,
    "storefrontCategory" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductUnit" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "conversionToBase" DECIMAL(18,6) NOT NULL,
    "isBaseUnit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Retailer" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "creditLimit" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "RetailerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "pinHash" TEXT,

    CONSTRAINT "Retailer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailerDevice" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceType" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "isTrusted" BOOLEAN NOT NULL DEFAULT false,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetailerDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailerLedgerEntry" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "entryType" "RetailerLedgerEntryType" NOT NULL,
    "referenceType" "ReferenceType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "debitAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "creditAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "balanceAfter" DECIMAL(18,4),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetailerLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailerNotification" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "branchId" TEXT,
    "type" "RetailerNotificationType" NOT NULL,
    "status" "RetailerNotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" "ReferenceType",
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "RetailerNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailerOrderPreference" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "preferredDay" TEXT,
    "notes" TEXT,
    "autoReorder" BOOLEAN NOT NULL DEFAULT false,
    "notifyBySms" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetailerOrderPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetailerSession" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "tokenHash" TEXT,
    "refreshTokenHash" TEXT,
    "refreshExpiresAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RetailerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystemRole" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "salesRepId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RouteStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteStop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "stopOrder" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "branchId" TEXT,
    "salesRepId" TEXT,
    "routeId" TEXT,
    "retailerId" TEXT,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "subtotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "invoiceId" TEXT,
    "createdById" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "source" "OrderSource" NOT NULL DEFAULT 'DNP',

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderItem" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "unitId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "baseQuantity" DECIMAL(18,6) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "lineTotal" DECIMAL(18,4) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesRep" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "status" "SalesRepStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SalesRep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT,
    "refreshTokenHash" TEXT,
    "refreshExpiresAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAdjustment" (
    "id" TEXT NOT NULL,
    "adjustmentNo" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "status" "StockAdjustmentStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "submittedById" TEXT,
    "approvedById" TEXT,
    "postedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAdjustmentItem" (
    "id" TEXT NOT NULL,
    "stockAdjustmentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "unitId" TEXT NOT NULL,
    "stockState" "StockState" NOT NULL DEFAULT 'AVAILABLE',
    "quantityDelta" DECIMAL(18,6) NOT NULL,
    "baseQuantityDelta" DECIMAL(18,6) NOT NULL,
    "reasonCode" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockAdjustmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCount" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "countedById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "reconciledAt" TIMESTAMP(3),

    CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCountItem" (
    "id" TEXT NOT NULL,
    "stockCountId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "unitId" TEXT NOT NULL,
    "systemQuantity" DECIMAL(18,6) NOT NULL,
    "countedQuantity" DECIMAL(18,6) NOT NULL,
    "variance" DECIMAL(18,6) NOT NULL,
    "isReconciled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StockCountItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "transferNo" TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "fromWarehouseId" TEXT NOT NULL,
    "fromLocationId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "toLocationId" TEXT NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "shippedById" TEXT,
    "receivedById" TEXT,
    "shippedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferItem" (
    "id" TEXT NOT NULL,
    "stockTransferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "unitId" TEXT NOT NULL,
    "stockState" "StockState" NOT NULL DEFAULT 'AVAILABLE',
    "quantity" DECIMAL(18,6) NOT NULL,
    "baseQuantity" DECIMAL(18,6) NOT NULL,
    "receivedQuantity" DECIMAL(18,6),
    "receivedBaseQuantity" DECIMAL(18,6),
    "varianceQuantity" DECIMAL(18,6),
    "varianceBaseQuantity" DECIMAL(18,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "defaultBranchId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "branchId" TEXT,
    "warehouseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "MasterDataStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_branchId_idx" ON "AuditLog"("branchId" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType" ASC, "entityId" ASC);

-- CreateIndex
CREATE INDEX "Batch_expiryDate_idx" ON "Batch"("expiryDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Batch_productId_batchNumber_key" ON "Batch"("productId" ASC, "batchNumber" ASC);

-- CreateIndex
CREATE INDEX "Batch_productId_idx" ON "Batch"("productId" ASC);

-- CreateIndex
CREATE INDEX "Batch_status_idx" ON "Batch"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code" ASC);

-- CreateIndex
CREATE INDEX "Branch_status_idx" ON "Branch"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Brand_code_key" ON "Brand"("code" ASC);

-- CreateIndex
CREATE INDEX "CashSession_branchId_idx" ON "CashSession"("branchId" ASC);

-- CreateIndex
CREATE INDEX "CashSession_openedAt_idx" ON "CashSession"("openedAt" ASC);

-- CreateIndex
CREATE INDEX "CashSession_status_idx" ON "CashSession"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Category_code_key" ON "Category"("code" ASC);

-- CreateIndex
CREATE INDEX "CreditApproval_branchId_idx" ON "CreditApproval"("branchId" ASC);

-- CreateIndex
CREATE INDEX "CreditApproval_createdAt_idx" ON "CreditApproval"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "CreditApproval_retailerId_idx" ON "CreditApproval"("retailerId" ASC);

-- CreateIndex
CREATE INDEX "CreditApproval_status_idx" ON "CreditApproval"("status" ASC);

-- CreateIndex
CREATE INDEX "DamageReport_branchId_idx" ON "DamageReport"("branchId" ASC);

-- CreateIndex
CREATE INDEX "DamageReport_createdAt_idx" ON "DamageReport"("createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DamageReport_reportNo_key" ON "DamageReport"("reportNo" ASC);

-- CreateIndex
CREATE INDEX "DamageReport_status_idx" ON "DamageReport"("status" ASC);

-- CreateIndex
CREATE INDEX "DamageReport_warehouseId_idx" ON "DamageReport"("warehouseId" ASC);

-- CreateIndex
CREATE INDEX "DamageReportItem_damageReportId_idx" ON "DamageReportItem"("damageReportId" ASC);

-- CreateIndex
CREATE INDEX "DamageReportItem_productId_idx" ON "DamageReportItem"("productId" ASC);

-- CreateIndex
CREATE INDEX "Delivery_branchId_idx" ON "Delivery"("branchId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_deliveryNo_key" ON "Delivery"("deliveryNo" ASC);

-- CreateIndex
CREATE INDEX "Delivery_routeId_idx" ON "Delivery"("routeId" ASC);

-- CreateIndex
CREATE INDEX "Delivery_scheduledAt_idx" ON "Delivery"("scheduledAt" ASC);

-- CreateIndex
CREATE INDEX "Delivery_status_idx" ON "Delivery"("status" ASC);

-- CreateIndex
CREATE INDEX "DeliveryItem_deliveryId_idx" ON "DeliveryItem"("deliveryId" ASC);

-- CreateIndex
CREATE INDEX "DeliveryItem_retailerId_idx" ON "DeliveryItem"("retailerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Device_userId_deviceId_key" ON "Device"("userId" ASC, "deviceId" ASC);

-- CreateIndex
CREATE INDEX "Device_userId_idx" ON "Device"("userId" ASC);

-- CreateIndex
CREATE INDEX "ExpiryEvent_batchId_idx" ON "ExpiryEvent"("batchId" ASC);

-- CreateIndex
CREATE INDEX "ExpiryEvent_branchId_idx" ON "ExpiryEvent"("branchId" ASC);

-- CreateIndex
CREATE INDEX "ExpiryEvent_expiryDate_idx" ON "ExpiryEvent"("expiryDate" ASC);

-- CreateIndex
CREATE INDEX "ExpiryEvent_isActedUpon_idx" ON "ExpiryEvent"("isActedUpon" ASC);

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_branchId_idx" ON "FinancialLedgerEntry"("branchId" ASC);

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_createdAt_idx" ON "FinancialLedgerEntry"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "FinancialLedgerEntry_referenceType_referenceId_idx" ON "FinancialLedgerEntry"("referenceType" ASC, "referenceId" ASC);

-- CreateIndex
CREATE INDEX "InventoryEvent_branchId_idx" ON "InventoryEvent"("branchId" ASC);

-- CreateIndex
CREATE INDEX "InventoryEvent_eventType_idx" ON "InventoryEvent"("eventType" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryEvent_idempotencyKey_key" ON "InventoryEvent"("idempotencyKey" ASC);

-- CreateIndex
CREATE INDEX "InventoryEvent_occurredAt_idx" ON "InventoryEvent"("occurredAt" ASC);

-- CreateIndex
CREATE INDEX "InventoryEvent_referenceType_referenceId_idx" ON "InventoryEvent"("referenceType" ASC, "referenceId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLocation_branchId_code_key" ON "InventoryLocation"("branchId" ASC, "code" ASC);

-- CreateIndex
CREATE INDEX "InventoryLocation_branchId_idx" ON "InventoryLocation"("branchId" ASC);

-- CreateIndex
CREATE INDEX "InventoryLocation_status_idx" ON "InventoryLocation"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLocation_warehouseId_key" ON "InventoryLocation"("warehouseId" ASC);

-- CreateIndex
CREATE INDEX "InventoryMovement_batchId_idx" ON "InventoryMovement"("batchId" ASC);

-- CreateIndex
CREATE INDEX "InventoryMovement_branchId_idx" ON "InventoryMovement"("branchId" ASC);

-- CreateIndex
CREATE INDEX "InventoryMovement_inventoryEventId_idx" ON "InventoryMovement"("inventoryEventId" ASC);

-- CreateIndex
CREATE INDEX "InventoryMovement_locationId_idx" ON "InventoryMovement"("locationId" ASC);

-- CreateIndex
CREATE INDEX "InventoryMovement_occurredAt_idx" ON "InventoryMovement"("occurredAt" ASC);

-- CreateIndex
CREATE INDEX "InventoryMovement_productId_idx" ON "InventoryMovement"("productId" ASC);

-- CreateIndex
CREATE INDEX "InventoryMovement_referenceType_referenceId_idx" ON "InventoryMovement"("referenceType" ASC, "referenceId" ASC);

-- CreateIndex
CREATE INDEX "InventorySnapshot_batchId_idx" ON "InventorySnapshot"("batchId" ASC);

-- CreateIndex
CREATE INDEX "InventorySnapshot_locationId_idx" ON "InventorySnapshot"("locationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "InventorySnapshot_locationId_productId_batchId_stockState_key" ON "InventorySnapshot"("locationId" ASC, "productId" ASC, "batchId" ASC, "stockState" ASC);

-- CreateIndex
CREATE INDEX "InventorySnapshot_productId_idx" ON "InventorySnapshot"("productId" ASC);

-- CreateIndex
CREATE INDEX "InventorySnapshot_stockState_idx" ON "InventorySnapshot"("stockState" ASC);

-- CreateIndex
CREATE INDEX "Invoice_branchId_idx" ON "Invoice"("branchId" ASC);

-- CreateIndex
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber" ASC);

-- CreateIndex
CREATE INDEX "Invoice_paymentStatus_idx" ON "Invoice"("paymentStatus" ASC);

-- CreateIndex
CREATE INDEX "Invoice_retailerId_idx" ON "Invoice"("retailerId" ASC);

-- CreateIndex
CREATE INDEX "Invoice_sourceLocationId_idx" ON "Invoice"("sourceLocationId" ASC);

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status" ASC);

-- CreateIndex
CREATE INDEX "Invoice_warehouseId_idx" ON "Invoice"("warehouseId" ASC);

-- CreateIndex
CREATE INDEX "InvoiceItem_batchId_idx" ON "InvoiceItem"("batchId" ASC);

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId" ASC);

-- CreateIndex
CREATE INDEX "InvoiceItem_productId_idx" ON "InvoiceItem"("productId" ASC);

-- CreateIndex
CREATE INDEX "LoginAttempt_createdAt_idx" ON "LoginAttempt"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "LoginAttempt_email_idx" ON "LoginAttempt"("email" ASC);

-- CreateIndex
CREATE INDEX "LoginAttempt_phone_idx" ON "LoginAttempt"("phone" ASC);

-- CreateIndex
CREATE INDEX "LoginAttempt_userId_idx" ON "LoginAttempt"("userId" ASC);

-- CreateIndex
CREATE INDEX "Notification_branchId_idx" ON "Notification"("branchId" ASC);

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status" ASC);

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type" ASC);

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId" ASC);

-- CreateIndex
CREATE INDEX "PasswordResetToken_tokenHash_idx" ON "PasswordResetToken"("tokenHash" ASC);

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId" ASC);

-- CreateIndex
CREATE INDEX "Payment_branchId_idx" ON "Payment"("branchId" ASC);

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentNumber_key" ON "Payment"("paymentNumber" ASC);

-- CreateIndex
CREATE INDEX "Payment_receivedAt_idx" ON "Payment"("receivedAt" ASC);

-- CreateIndex
CREATE INDEX "Payment_retailerId_idx" ON "Payment"("retailerId" ASC);

-- CreateIndex
CREATE INDEX "Permission_action_idx" ON "Permission"("action" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code" ASC);

-- CreateIndex
CREATE INDEX "Permission_module_idx" ON "Permission"("module" ASC);

-- CreateIndex
CREATE INDEX "Product_barcode_idx" ON "Product"("barcode" ASC);

-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId" ASC);

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId" ASC);

-- CreateIndex
CREATE INDEX "Product_defaultUnitId_idx" ON "Product"("defaultUnitId" ASC);

-- CreateIndex
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Product_skuCode_key" ON "Product"("skuCode" ASC);

-- CreateIndex
CREATE INDEX "ProductUnit_productId_idx" ON "ProductUnit"("productId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProductUnit_productId_unitId_key" ON "ProductUnit"("productId" ASC, "unitId" ASC);

-- CreateIndex
CREATE INDEX "ProductUnit_unitId_idx" ON "ProductUnit"("unitId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Retailer_branchId_code_key" ON "Retailer"("branchId" ASC, "code" ASC);

-- CreateIndex
CREATE INDEX "Retailer_branchId_idx" ON "Retailer"("branchId" ASC);

-- CreateIndex
CREATE INDEX "Retailer_phone_idx" ON "Retailer"("phone" ASC);

-- CreateIndex
CREATE INDEX "Retailer_status_idx" ON "Retailer"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RetailerDevice_retailerId_deviceId_key" ON "RetailerDevice"("retailerId" ASC, "deviceId" ASC);

-- CreateIndex
CREATE INDEX "RetailerDevice_retailerId_idx" ON "RetailerDevice"("retailerId" ASC);

-- CreateIndex
CREATE INDEX "RetailerLedgerEntry_branchId_idx" ON "RetailerLedgerEntry"("branchId" ASC);

-- CreateIndex
CREATE INDEX "RetailerLedgerEntry_createdAt_idx" ON "RetailerLedgerEntry"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "RetailerLedgerEntry_entryType_idx" ON "RetailerLedgerEntry"("entryType" ASC);

-- CreateIndex
CREATE INDEX "RetailerLedgerEntry_referenceType_referenceId_idx" ON "RetailerLedgerEntry"("referenceType" ASC, "referenceId" ASC);

-- CreateIndex
CREATE INDEX "RetailerLedgerEntry_retailerId_idx" ON "RetailerLedgerEntry"("retailerId" ASC);

-- CreateIndex
CREATE INDEX "RetailerNotification_createdAt_idx" ON "RetailerNotification"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "RetailerNotification_retailerId_idx" ON "RetailerNotification"("retailerId" ASC);

-- CreateIndex
CREATE INDEX "RetailerNotification_status_idx" ON "RetailerNotification"("status" ASC);

-- CreateIndex
CREATE INDEX "RetailerNotification_type_idx" ON "RetailerNotification"("type" ASC);

-- CreateIndex
CREATE INDEX "RetailerOrderPreference_retailerId_idx" ON "RetailerOrderPreference"("retailerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RetailerOrderPreference_retailerId_key" ON "RetailerOrderPreference"("retailerId" ASC);

-- CreateIndex
CREATE INDEX "RetailerSession_expiresAt_idx" ON "RetailerSession"("expiresAt" ASC);

-- CreateIndex
CREATE INDEX "RetailerSession_refreshTokenHash_idx" ON "RetailerSession"("refreshTokenHash" ASC);

-- CreateIndex
CREATE INDEX "RetailerSession_retailerId_idx" ON "RetailerSession"("retailerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Route_branchId_code_key" ON "Route"("branchId" ASC, "code" ASC);

-- CreateIndex
CREATE INDEX "Route_branchId_idx" ON "Route"("branchId" ASC);

-- CreateIndex
CREATE INDEX "Route_salesRepId_idx" ON "Route"("salesRepId" ASC);

-- CreateIndex
CREATE INDEX "Route_status_idx" ON "Route"("status" ASC);

-- CreateIndex
CREATE INDEX "RouteStop_retailerId_idx" ON "RouteStop"("retailerId" ASC);

-- CreateIndex
CREATE INDEX "RouteStop_routeId_idx" ON "RouteStop"("routeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RouteStop_routeId_retailerId_key" ON "RouteStop"("routeId" ASC, "retailerId" ASC);

-- CreateIndex
CREATE INDEX "SalesOrder_branchId_idx" ON "SalesOrder"("branchId" ASC);

-- CreateIndex
CREATE INDEX "SalesOrder_createdAt_idx" ON "SalesOrder"("createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_invoiceId_key" ON "SalesOrder"("invoiceId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_orderNo_key" ON "SalesOrder"("orderNo" ASC);

-- CreateIndex
CREATE INDEX "SalesOrder_retailerId_idx" ON "SalesOrder"("retailerId" ASC);

-- CreateIndex
CREATE INDEX "SalesOrder_routeId_idx" ON "SalesOrder"("routeId" ASC);

-- CreateIndex
CREATE INDEX "SalesOrder_salesRepId_idx" ON "SalesOrder"("salesRepId" ASC);

-- CreateIndex
CREATE INDEX "SalesOrder_status_idx" ON "SalesOrder"("status" ASC);

-- CreateIndex
CREATE INDEX "SalesOrderItem_productId_idx" ON "SalesOrderItem"("productId" ASC);

-- CreateIndex
CREATE INDEX "SalesOrderItem_salesOrderId_idx" ON "SalesOrderItem"("salesOrderId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SalesRep_branchId_employeeCode_key" ON "SalesRep"("branchId" ASC, "employeeCode" ASC);

-- CreateIndex
CREATE INDEX "SalesRep_branchId_idx" ON "SalesRep"("branchId" ASC);

-- CreateIndex
CREATE INDEX "SalesRep_status_idx" ON "SalesRep"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SalesRep_userId_key" ON "SalesRep"("userId" ASC);

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt" ASC);

-- CreateIndex
CREATE INDEX "Session_refreshTokenHash_idx" ON "Session"("refreshTokenHash" ASC);

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StockAdjustment_adjustmentNo_key" ON "StockAdjustment"("adjustmentNo" ASC);

-- CreateIndex
CREATE INDEX "StockAdjustment_branchId_idx" ON "StockAdjustment"("branchId" ASC);

-- CreateIndex
CREATE INDEX "StockAdjustment_locationId_idx" ON "StockAdjustment"("locationId" ASC);

-- CreateIndex
CREATE INDEX "StockAdjustment_status_idx" ON "StockAdjustment"("status" ASC);

-- CreateIndex
CREATE INDEX "StockAdjustment_warehouseId_idx" ON "StockAdjustment"("warehouseId" ASC);

-- CreateIndex
CREATE INDEX "StockAdjustmentItem_batchId_idx" ON "StockAdjustmentItem"("batchId" ASC);

-- CreateIndex
CREATE INDEX "StockAdjustmentItem_productId_idx" ON "StockAdjustmentItem"("productId" ASC);

-- CreateIndex
CREATE INDEX "StockAdjustmentItem_stockAdjustmentId_idx" ON "StockAdjustmentItem"("stockAdjustmentId" ASC);

-- CreateIndex
CREATE INDEX "StockCount_branchId_idx" ON "StockCount"("branchId" ASC);

-- CreateIndex
CREATE INDEX "StockCount_locationId_idx" ON "StockCount"("locationId" ASC);

-- CreateIndex
CREATE INDEX "StockCount_status_idx" ON "StockCount"("status" ASC);

-- CreateIndex
CREATE INDEX "StockCount_warehouseId_idx" ON "StockCount"("warehouseId" ASC);

-- CreateIndex
CREATE INDEX "StockCountItem_productId_idx" ON "StockCountItem"("productId" ASC);

-- CreateIndex
CREATE INDEX "StockCountItem_stockCountId_idx" ON "StockCountItem"("stockCountId" ASC);

-- CreateIndex
CREATE INDEX "StockTransfer_fromBranchId_idx" ON "StockTransfer"("fromBranchId" ASC);

-- CreateIndex
CREATE INDEX "StockTransfer_status_idx" ON "StockTransfer"("status" ASC);

-- CreateIndex
CREATE INDEX "StockTransfer_toBranchId_idx" ON "StockTransfer"("toBranchId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_transferNo_key" ON "StockTransfer"("transferNo" ASC);

-- CreateIndex
CREATE INDEX "StockTransferItem_batchId_idx" ON "StockTransferItem"("batchId" ASC);

-- CreateIndex
CREATE INDEX "StockTransferItem_productId_idx" ON "StockTransferItem"("productId" ASC);

-- CreateIndex
CREATE INDEX "StockTransferItem_stockTransferId_idx" ON "StockTransferItem"("stockTransferId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Unit_code_key" ON "Unit"("code" ASC);

-- CreateIndex
CREATE INDEX "User_defaultBranchId_idx" ON "User"("defaultBranchId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone" ASC);

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status" ASC);

-- CreateIndex
CREATE INDEX "UserRole_branchId_idx" ON "UserRole"("branchId" ASC);

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId" ASC);

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_branchId_warehouseId_key" ON "UserRole"("userId" ASC, "roleId" ASC, "branchId" ASC, "warehouseId" ASC);

-- CreateIndex
CREATE INDEX "UserRole_warehouseId_idx" ON "UserRole"("warehouseId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_branchId_code_key" ON "Warehouse"("branchId" ASC, "code" ASC);

-- CreateIndex
CREATE INDEX "Warehouse_branchId_idx" ON "Warehouse"("branchId" ASC);

-- CreateIndex
CREATE INDEX "Warehouse_status_idx" ON "Warehouse"("status" ASC);

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditApproval" ADD CONSTRAINT "CreditApproval_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditApproval" ADD CONSTRAINT "CreditApproval_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditApproval" ADD CONSTRAINT "CreditApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditApproval" ADD CONSTRAINT "CreditApproval_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReport" ADD CONSTRAINT "DamageReport_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReport" ADD CONSTRAINT "DamageReport_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReport" ADD CONSTRAINT "DamageReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReport" ADD CONSTRAINT "DamageReport_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReport" ADD CONSTRAINT "DamageReport_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReport" ADD CONSTRAINT "DamageReport_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReportItem" ADD CONSTRAINT "DamageReportItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReportItem" ADD CONSTRAINT "DamageReportItem_damageReportId_fkey" FOREIGN KEY ("damageReportId") REFERENCES "DamageReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReportItem" ADD CONSTRAINT "DamageReportItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DamageReportItem" ADD CONSTRAINT "DamageReportItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpiryEvent" ADD CONSTRAINT "ExpiryEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpiryEvent" ADD CONSTRAINT "ExpiryEvent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpiryEvent" ADD CONSTRAINT "ExpiryEvent_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpiryEvent" ADD CONSTRAINT "ExpiryEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialLedgerEntry" ADD CONSTRAINT "FinancialLedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_reversalOfEventId_fkey" FOREIGN KEY ("reversalOfEventId") REFERENCES "InventoryEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLocation" ADD CONSTRAINT "InventoryLocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLocation" ADD CONSTRAINT "InventoryLocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_inventoryEventId_fkey" FOREIGN KEY ("inventoryEventId") REFERENCES "InventoryEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySnapshot" ADD CONSTRAINT "InventorySnapshot_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySnapshot" ADD CONSTRAINT "InventorySnapshot_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySnapshot" ADD CONSTRAINT "InventorySnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySnapshot" ADD CONSTRAINT "InventorySnapshot_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginAttempt" ADD CONSTRAINT "LoginAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_defaultUnitId_fkey" FOREIGN KEY ("defaultUnitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retailer" ADD CONSTRAINT "Retailer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retailer" ADD CONSTRAINT "Retailer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerDevice" ADD CONSTRAINT "RetailerDevice_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerLedgerEntry" ADD CONSTRAINT "RetailerLedgerEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerLedgerEntry" ADD CONSTRAINT "RetailerLedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerLedgerEntry" ADD CONSTRAINT "RetailerLedgerEntry_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerNotification" ADD CONSTRAINT "RetailerNotification_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerOrderPreference" ADD CONSTRAINT "RetailerOrderPreference_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailerSession" ADD CONSTRAINT "RetailerSession_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "SalesRep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "Retailer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "SalesRep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRep" ADD CONSTRAINT "SalesRep_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRep" ADD CONSTRAINT "SalesRep_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesRep" ADD CONSTRAINT "SalesRep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustmentItem" ADD CONSTRAINT "StockAdjustmentItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustmentItem" ADD CONSTRAINT "StockAdjustmentItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustmentItem" ADD CONSTRAINT "StockAdjustmentItem_stockAdjustmentId_fkey" FOREIGN KEY ("stockAdjustmentId") REFERENCES "StockAdjustment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustmentItem" ADD CONSTRAINT "StockAdjustmentItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_countedById_fkey" FOREIGN KEY ("countedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountItem" ADD CONSTRAINT "StockCountItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountItem" ADD CONSTRAINT "StockCountItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountItem" ADD CONSTRAINT "StockCountItem_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "StockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountItem" ADD CONSTRAINT "StockCountItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_shippedById_fkey" FOREIGN KEY ("shippedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_stockTransferId_fkey" FOREIGN KEY ("stockTransferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_defaultBranchId_fkey" FOREIGN KEY ("defaultBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
