/**
 * Seed opening stock for all active products in all warehouses.
 *
 * Run separately AFTER the main seed:
 *   cd backend
 *   npx ts-node prisma/seed-inventory.ts
 *
 * Idempotent — skips products that already have stock.
 */
import { PrismaClient, InventoryEventType, InventoryEventStatus, InventoryMovementType, ReferenceType, StockState } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📦 Seeding opening stock...\n');

  const admin = await prisma.user.findFirstOrThrow({ where: { email: 'superadmin@pasalo.com' } });
  const warehouses = await prisma.warehouse.findMany({
    include: { inventoryLocation: true },
  });

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { batches: true, defaultUnit: true },
  });

  if (warehouses.length === 0) {
    console.log('⚠️  No warehouses found. Run the main seed first: npx ts-node prisma/seed.ts');
    process.exit(0);
  }

  // Default opening stock quantities per product
  const defaultStockQty: Record<string, number> = {
    'WAI-WAI-75G': 500,
    'SUNFLOWER-OIL-1L': 200,
    'COCA-COLA-250ML': 600,
    'PARLE-G-100G': 1000,
    'TURMERIC-100G': 300,
  };

  let created = 0;
  let skipped = 0;

  for (const warehouse of warehouses) {
    const location = warehouse.inventoryLocation;
    if (!location) {
      console.log(`  ⚠️  ${warehouse.name} has no inventory location — skipping`);
      continue;
    }

    for (const product of products) {
      // Check if stock already exists for this product + location
      const existingSnapshot = await prisma.inventorySnapshot.findFirst({
        where: {
          locationId: location.id,
          productId: product.id,
          batchId: null,
        },
      });

      if (existingSnapshot) {
        skipped++;
        continue;
      }

      const qty = defaultStockQty[product.skuCode] ?? 100;

      // Use the product's first batch if it exists, otherwise stock without batch
      const batch = product.batches[0] ?? null;

      // Create InventoryEvent (OPENING_STOCK) + InventoryMovement + Snapshot in a transaction
      await prisma.$transaction(async (tx) => {
        const event = await tx.inventoryEvent.create({
          data: {
            eventType: InventoryEventType.OPENING_STOCK,
            eventStatus: InventoryEventStatus.POSTED,
            branchId: warehouse.branchId,
            referenceType: ReferenceType.PRODUCT,
            referenceId: product.id,
            createdById: admin.id,
            metadata: { note: 'Opening stock seed' },
          },
        });

        const movement = await tx.inventoryMovement.create({
          data: {
            inventoryEventId: event.id,
            branchId: warehouse.branchId,
            locationId: location.id,
            productId: product.id,
            batchId: batch?.id ?? null,
            unitId: product.defaultUnitId,
            stockState: StockState.AVAILABLE,
            quantityDelta: qty,
            baseQuantityDelta: qty,
            movementType: InventoryMovementType.STOCK_IN,
            referenceType: ReferenceType.PRODUCT,
            referenceId: product.id,
            createdById: admin.id,
          },
        });

        await tx.inventorySnapshot.create({
          data: {
            locationId: location.id,
            productId: product.id,
            batchId: batch?.id ?? null,
            stockState: StockState.AVAILABLE,
            unitId: product.defaultUnitId,
            quantity: qty,
            baseQuantity: qty,
            lastMovementId: movement.id,
            lastMovementAt: new Date(),
          },
        });
      });

      console.log(`  ✅ ${warehouse.name} → ${product.name}: ${qty} ${product.defaultUnit.symbol}`);
      created++;
    }
  }

  console.log(`\n🎉 Done! ${created} snapshots created, ${skipped} already existed.`);
}

main()
  .catch((e) => {
    console.error('❌ Inventory seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());