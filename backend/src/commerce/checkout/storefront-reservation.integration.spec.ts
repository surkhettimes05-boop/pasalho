import { Prisma, StockState } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { InventoryLedgerService } from '../../inventory/services/inventory-ledger.service';
import { StockReservationService } from '../../inventory/services/stock-reservation.service';
import { StorefrontReservationService } from './storefront-reservation.service';

const describeWithDatabase = process.env.DATABASE_URL ? describe : describe.skip;

describeWithDatabase('StorefrontReservationService PostgreSQL concurrency', () => {
  jest.setTimeout(30000);

  const reference = `storefront-race-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  let prisma: PrismaService;
  let service: StorefrontReservationService;
  let branchId: string;
  let locationId: string;
  let productId: string;
  let unitId: string;
  let userId: string;
  const orderIds: string[] = [];
  const orderItemIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    const ledger = new InventoryLedgerService(prisma);
    const audit = { record: jest.fn() } as any;
    const lowLevelReservation = new StockReservationService(
      prisma,
      ledger,
      audit,
    );
    service = new StorefrontReservationService(prisma, lowLevelReservation);

    const category = await prisma.category.create({
      data: {
        code: `${reference}-category`,
        name: 'Storefront race category',
      },
    });

    const unit = await prisma.unit.create({
      data: {
        code: `${reference}-unit`,
        name: 'Piece',
        symbol: 'pc',
      },
    });
    unitId = unit.id;

    const product = await prisma.product.create({
      data: {
        skuCode: `${reference}-sku`,
        name: 'Storefront race product',
        categoryId: category.id,
        defaultUnitId: unit.id,
        sellingPrice: 10,
        storefrontVisible: true,
      },
    });
    productId = product.id;

    await prisma.productUnit.create({
      data: {
        productId: product.id,
        unitId: unit.id,
        conversionToBase: 1,
        isBaseUnit: true,
      },
    });

    const branch = await prisma.branch.create({
      data: {
        code: `${reference}-branch`,
        name: 'Storefront race branch',
        city: 'Birendranagar',
        district: 'Surkhet',
      },
    });
    branchId = branch.id;

    const location = await prisma.inventoryLocation.create({
      data: {
        branchId: branch.id,
        code: `${reference}-store`,
        name: 'Storefront race store',
        type: 'STORE',
      },
    });
    locationId = location.id;

    const user = await prisma.user.create({
      data: {
        fullName: 'Storefront race system actor',
        phone: `98${String(Date.now()).slice(-8)}`,
        email: `${reference}@example.test`,
        passwordHash: 'test-only',
        status: 'ACTIVE',
      },
    });
    userId = user.id;

    await prisma.storeProductConfig.create({
      data: {
        inventoryLocationId: location.id,
        productId: product.id,
        isVisible: true,
        sellingPrice: 10,
        safetyStockBaseQty: 0,
      },
    });

    await prisma.inventorySnapshot.create({
      data: {
        locationId: location.id,
        productId: product.id,
        stockState: StockState.AVAILABLE,
        unitId: unit.id,
        quantity: 3,
        baseQuantity: 3,
      },
    });

    for (let index = 0; index < 2; index += 1) {
      const order = await prisma.salesOrder.create({
        data: {
          orderNo: `${reference}-order-${index}`,
          source: 'STOREFRONT',
          branchId: branch.id,
          fulfillmentLocationId: location.id,
          status: 'PLACED',
          subtotal: 20,
          grandTotal: 20,
          createdById: user.id,
          placedAt: new Date(),
        },
      });
      orderIds.push(order.id);

      const item = await prisma.salesOrderItem.create({
        data: {
          salesOrderId: order.id,
          productId: product.id,
          unitId: unit.id,
          quantity: 2,
          baseQuantity: 2,
          unitPrice: 10,
          lineTotal: 20,
        },
      });
      orderItemIds.push(item.id);
    }
  });

  afterAll(async () => {
    if (!prisma) return;

    await prisma.stockReservationItem.deleteMany({
      where: { productId },
    });
    await prisma.stockReservation.deleteMany({
      where: { salesOrderId: { in: orderIds } },
    });
    await prisma.salesOrderItem.deleteMany({
      where: { salesOrderId: { in: orderIds } },
    });
    await prisma.salesOrder.deleteMany({
      where: { id: { in: orderIds } },
    });
    await prisma.inventoryMovement.deleteMany({
      where: { locationId, productId },
    });
    await prisma.inventoryEvent.deleteMany({
      where: { referenceId: { in: orderIds } },
    });
    await prisma.inventorySnapshot.deleteMany({
      where: { locationId, productId },
    });
    await prisma.storeProductConfig.deleteMany({
      where: { inventoryLocationId: locationId, productId },
    });
    await prisma.productUnit.deleteMany({ where: { productId } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.unit.delete({ where: { id: unitId } });
    await prisma.category.deleteMany({
      where: { code: `${reference}-category` },
    });
    await prisma.inventoryLocation.delete({ where: { id: locationId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.branch.delete({ where: { id: branchId } });
    await prisma.$disconnect();
  });

  it('allows only one of two simultaneous orders when stock is 3 and each requests 2', async () => {
    const reserve = (index: number) =>
      prisma.$transaction(
        (tx) =>
          service.reserveOrder(tx, {
            salesOrderId: orderIds[index],
            branchId,
            locationId,
            createdById: userId,
            expiresAt: new Date(Date.now() + 20 * 60 * 1000),
            items: [
              {
                salesOrderItemId: orderItemIds[index],
                productId,
                requestedBaseQuantity: 2,
              },
            ],
          }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

    const results = await Promise.allSettled([reserve(0), reserve(1)]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);

    const snapshots = await prisma.inventorySnapshot.findMany({
      where: { locationId, productId, unitId },
      select: { stockState: true, baseQuantity: true },
    });
    const balances = new Map(
      snapshots.map((snapshot) => [
        snapshot.stockState,
        Number(snapshot.baseQuantity),
      ]),
    );

    expect(balances.get('AVAILABLE')).toBe(1);
    expect(balances.get('RESERVED')).toBe(2);
    expect(
      (balances.get('AVAILABLE') ?? 0) + (balances.get('RESERVED') ?? 0),
    ).toBe(3);

    const activeReservations = await prisma.stockReservation.count({
      where: {
        salesOrderId: { in: orderIds },
        status: 'ACTIVE',
      },
    });
    expect(activeReservations).toBe(1);
  });
});
