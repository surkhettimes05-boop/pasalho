-- P0-04: explicit store-scoped storefront catalog and pricing configuration.

ALTER TABLE "Category"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "imageUrl" TEXT,
  ADD COLUMN "sortRank" INTEGER;

ALTER TABLE "Brand"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "logoUrl" TEXT;

ALTER TABLE "Product"
  ADD COLUMN "productGroupId" TEXT,
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "shortDescription" TEXT,
  ADD COLUMN "searchKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "storefrontVisible" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_productGroupId_idx" ON "Product"("productGroupId");
CREATE INDEX "Product_storefrontVisible_isActive_idx" ON "Product"("storefrontVisible", "isActive");

CREATE TABLE "ProductGroup" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "brandId" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductGroup_slug_key" ON "ProductGroup"("slug");
CREATE INDEX "ProductGroup_categoryId_idx" ON "ProductGroup"("categoryId");
CREATE INDEX "ProductGroup_brandId_idx" ON "ProductGroup"("brandId");
CREATE INDEX "ProductGroup_isActive_idx" ON "ProductGroup"("isActive");

CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId", "sortOrder");

CREATE TABLE "StoreProductConfig" (
    "id" TEXT NOT NULL,
    "inventoryLocationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sellingPrice" DECIMAL(18,4),
    "mrp" DECIMAL(18,4),
    "safetyStockBaseQty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "maxOrderBaseQty" DECIMAL(18,6),
    "sortRank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StoreProductConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreProductConfig_inventoryLocationId_productId_key"
  ON "StoreProductConfig"("inventoryLocationId", "productId");
CREATE INDEX "StoreProductConfig_productId_idx" ON "StoreProductConfig"("productId");
CREATE INDEX "StoreProductConfig_inventoryLocationId_isVisible_idx"
  ON "StoreProductConfig"("inventoryLocationId", "isVisible");

ALTER TABLE "ProductGroup"
  ADD CONSTRAINT "ProductGroup_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductGroup"
  ADD CONSTRAINT "ProductGroup_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_productGroupId_fkey"
  FOREIGN KEY ("productGroupId") REFERENCES "ProductGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductImage"
  ADD CONSTRAINT "ProductImage_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreProductConfig"
  ADD CONSTRAINT "StoreProductConfig_inventoryLocationId_fkey"
  FOREIGN KEY ("inventoryLocationId") REFERENCES "InventoryLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreProductConfig"
  ADD CONSTRAINT "StoreProductConfig_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
