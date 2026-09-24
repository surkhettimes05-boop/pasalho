import { PrismaService } from "../src/database/prisma.service";
import { InventoryLedgerService } from "../src/inventory/services/inventory-ledger.service";

describe("Inventory snapshot invariant (PostgreSQL)", () => {
  let prisma: PrismaService;
  let ledger: InventoryLedgerService;
  let branchId: string;
  let userId: string;
  let locationId: string;
  let productId: string;
  let unitId: string;
  const referenceId = `inventory-invariant-${Date.now()}`;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    ledger = new InventoryLedgerService(prisma);

    const category = await prisma.category.create({
      data: {
        code: `${referenceId}-category`,
        name: "Invariant category",
      },
    });
    const unit = await prisma.unit.create({
      data: {
        code: `${referenceId}-unit`,
        name: "Invariant unit",
        symbol: "iu",
      },
    });
    unitId = unit.id;
    const product = await prisma.product.create({
      data: {
        skuCode: `${referenceId}-sku`,
        name: "Invariant product",
        categoryId: category.id,
        defaultUnitId: unit.id,
      },
    });
    productId = product.id;

    const branch = await prisma.branch.create({
      data: {
        code: `${referenceId}-branch`,
        name: "Invariant branch",
        city: "Test city",
        district: "Test district",
      },
    });
    branchId = branch.id;
    const warehouse = await prisma.warehouse.create({
      data: {
        branchId: branch.id,
        code: `${referenceId}-warehouse`,
        name: "Invariant warehouse",
      },
    });
    const location = await prisma.inventoryLocation.create({
      data: {
        branchId: branch.id,
        warehouseId: warehouse.id,
        code: `${referenceId}-location`,
        name: "Invariant location",
      },
    });
    locationId = location.id;

    const user = await prisma.user.create({
      data: {
        fullName: "Inventory invariant test",
        phone: `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10),
        email: `${referenceId}@example.test`,
        passwordHash: "test-only",
        status: "ACTIVE",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.inventoryMovement.deleteMany({
      where: { referenceId },
    });
    await prisma.inventoryEvent.deleteMany({
      where: { referenceId },
    });
    await prisma.inventorySnapshot.deleteMany({ where: { locationId } });
    await prisma.inventoryLocation.delete({ where: { id: locationId } });
    await prisma.warehouse.deleteMany({ where: { branchId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.unit.delete({ where: { id: unitId } });
    await prisma.category.deleteMany({
      where: { code: `${referenceId}-category` },
    });
    await prisma.branch.delete({ where: { id: branchId } });
    await prisma.$disconnect();
  });

  it("has no physical ON_HAND column or state", async () => {
    const onHandColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'InventorySnapshot'
        AND lower(column_name) = 'onhand'
    `;
    const stockStates = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel
      FROM pg_enum
      WHERE enumtypid = '"StockState"'::regtype
        AND lower(enumlabel) = 'on_hand'
    `;

    expect(onHandColumns).toHaveLength(0);
    expect(stockStates).toHaveLength(0);
  });

  it("preserves the partitioned physical balance during concurrent reservations", async () => {
    await ledger.postEvent({
      eventType: "OPENING_STOCK",
      branchId,
      referenceType: "STOCK_ADJUSTMENT",
      referenceId,
      createdById: userId,
      movements: [
        {
          locationId,
          productId,
          unitId,
          stockState: "AVAILABLE",
          quantityDelta: 10,
          baseQuantityDelta: 10,
          movementType: "STOCK_IN",
        },
      ],
    });

    const reserve = () =>
      ledger.postEvent({
        eventType: "MANUAL_ADJUSTMENT",
        branchId,
        referenceType: "SALES_ORDER",
        referenceId,
        createdById: userId,
        movements: [
          {
            locationId,
            productId,
            unitId,
            stockState: "AVAILABLE",
            quantityDelta: -7,
            baseQuantityDelta: -7,
            movementType: "SALE_DEDUCTION",
          },
          {
            locationId,
            productId,
            unitId,
            stockState: "RESERVED",
            quantityDelta: 7,
            baseQuantityDelta: 7,
            movementType: "ADJUSTMENT",
          },
        ],
      });

    const results = await Promise.allSettled([reserve(), reserve()]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);

    const snapshots = await prisma.inventorySnapshot.findMany({
      where: { locationId, productId, unitId },
      select: { stockState: true, baseQuantity: true },
    });
    const balances = new Map(
      snapshots.map((snapshot) => [snapshot.stockState, Number(snapshot.baseQuantity)]),
    );

    expect(balances.get("AVAILABLE")).toBe(3);
    expect(balances.get("RESERVED")).toBe(7);
    expect((balances.get("AVAILABLE") ?? 0) + (balances.get("RESERVED") ?? 0)).toBe(10);
  });
});