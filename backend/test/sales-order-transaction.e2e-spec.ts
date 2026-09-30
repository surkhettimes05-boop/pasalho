import { randomUUID } from "crypto";
import { AuditLogService } from "../src/audit/audit-log.service";
import { PrismaService } from "../src/database/prisma.service";
import { InventoryLedgerService } from "../src/inventory/services/inventory-ledger.service";
import { StockReservationService } from "../src/inventory/services/stock-reservation.service";
import { RetailerLedgerService } from "../src/finance/retailer-ledger/retailer-ledger.service";
import { InvoiceService } from "../src/sales/invoice.service";
import { SalesOrderService } from "../src/sales-orders/sales-order.service";
import { CreateSalesOrderDto } from "../src/sales-orders/dto/create-sales-order.dto";
import { RetailerNotificationService } from "../src/retailer-portal/retailer-notification.service";
import { RetailerOrderService } from "../src/retailer-portal/retailer-order.service";
import { FranchiseService } from "../src/franchise/franchise.service";
import { PaymentService } from "../src/sales/payment.service";

describe("Sales-order transaction (real PostgreSQL)", () => {
  let prisma: PrismaService;
  let salesOrders: SalesOrderService;
  let reservations: StockReservationService;
  let branchId: string;
  let userId: string;
  let salesRepId: string;
  let retailerId: string;
  let routeId: string;
  let warehouseId: string;
  let locationId: string;
  let productId: string;
  let unitId: string;
  let invoiceService: InvoiceService;
  let retailerOrders: RetailerOrderService;
  let franchiseOrderId: string | undefined;
  const franchiseOrderIds: string[] = [];
  let franchiseStoreId: string | undefined;
  const franchiseStoreIds: string[] = [];
  let franchisePartnerId: string | undefined;
  const franchisePartnerIds: string[] = [];
  let franchiseSecondaryBranchId: string | undefined;
  const prefix = `sales-order-it-${Date.now()}-${randomUUID().slice(0, 8)}`;

  const dto = (quantity: number, idempotencyKey: string): CreateSalesOrderDto => ({
    branchId,
    salesRepId,
    routeId,
    retailerId,
    channel: "SALES_REP",
    idempotencyKey,
    items: [{ productId, unitId, quantity }],
  });

  const buildServices = (reservationService = reservations) => {
    const audit = new AuditLogService(prisma);
    const ledger = new InventoryLedgerService(prisma);
    const retailerLedger = new RetailerLedgerService(prisma);
    invoiceService = new InvoiceService(
      prisma,
      audit,
      ledger,
      retailerLedger,
      reservationService,
    );
    return new SalesOrderService(prisma, audit, invoiceService, reservationService);
  };

  const seedAvailable = async (quantity: number) => {
    await new InventoryLedgerService(prisma).postEvent({
      eventType: "OPENING_STOCK",
      branchId,
      referenceType: "STOCK_ADJUSTMENT",
      referenceId: `${prefix}-opening-${randomUUID()}`,
      createdById: userId,
      movements: [
        {
          locationId,
          productId,
          unitId,
          stockState: "AVAILABLE",
          quantityDelta: quantity,
          baseQuantityDelta: quantity,
          movementType: "STOCK_IN",
        },
      ],
    });
  };

  const seedBatchStock = async (batches: Array<{ name: string; quantity: number; expiryDate?: Date; status?: "ACTIVE" | "BLOCKED" | "EXPIRED" }>) => {
    await prisma.product.update({ where: { id: productId }, data: { isBatchTracked: true, isExpiryTracked: true } });
    for (const batchInput of batches) {
      const batch = await prisma.batch.create({
        data: {
          productId,
          batchNumber: `${prefix}-${batchInput.name}`,
          expiryDate: batchInput.expiryDate,
          status: batchInput.status ?? "ACTIVE",
        },
      });
      await new InventoryLedgerService(prisma).postEvent({
        eventType: "OPENING_STOCK",
        branchId,
        referenceType: "STOCK_ADJUSTMENT",
        referenceId: `${prefix}-opening-${batchInput.name}-${randomUUID()}`,
        createdById: userId,
        movements: [{
          locationId,
          productId,
          batchId: batch.id,
          unitId,
          stockState: "AVAILABLE",
          quantityDelta: batchInput.quantity,
          baseQuantityDelta: batchInput.quantity,
          movementType: "STOCK_IN",
        }],
      });
    }
  };

  const batchBalances = async () => prisma.inventorySnapshot.findMany({
    where: { locationId, productId },
    select: { batchId: true, stockState: true, baseQuantity: true },
    orderBy: [{ batchId: "asc" }, { stockState: "asc" }],
  });

  const resetInventory = async () => {
    const receiptOrderIds = [...new Set([...franchiseOrderIds, ...(franchiseOrderId ? [franchiseOrderId] : [])])];
    const storeIds = [...new Set([...franchiseStoreIds, ...(franchiseStoreId ? [franchiseStoreId] : [])])];
    const partnerIds = [...new Set([...franchisePartnerIds, ...(franchisePartnerId ? [franchisePartnerId] : [])])];
    const franchiseStores = storeIds.length ? await prisma.franchiseStore.findMany({
      where: { id: { in: storeIds } }, select: { id: true, inventoryLocationId: true },
    }) : [];
    const franchiseLocationIds = franchiseStores.flatMap((store) => store.inventoryLocationId ? [store.inventoryLocationId] : []);
    if (receiptOrderIds.length) {
      await prisma.franchiseSupplyOrderItem.deleteMany({ where: { orderId: { in: receiptOrderIds } } });
      await prisma.franchiseSupplyOrderEvent.deleteMany({ where: { orderId: { in: receiptOrderIds } } });
      await prisma.franchiseSupplyOrder.deleteMany({ where: { id: { in: receiptOrderIds } } });
    }
    if (storeIds.length) await prisma.franchiseStore.updateMany({ where: { id: { in: storeIds } }, data: { inventoryLocationId: null } });
    franchiseOrderIds.length = 0;
    franchiseOrderId = undefined;
    await prisma.retailerNotification.deleteMany({ where: { branchId } });
    await prisma.retailerLedgerEntry.deleteMany({ where: { branchId } });
    await prisma.financialLedgerEntry.deleteMany({ where: { branchId } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { branchId } } });
    await prisma.invoice.deleteMany({ where: { branchId } });
    await prisma.stockReservationItem.deleteMany({
      where: { reservation: { salesOrder: { branchId } } },
    });
    await prisma.salesOrder.deleteMany({ where: { branchId } });
    await prisma.idempotencyRecord.deleteMany({
      where: { scope: "sales-order.create", key: { startsWith: prefix } },
    });
    const receiptEvents = receiptOrderIds.length ? await prisma.inventoryEvent.findMany({
      where: { referenceType: 'FRANCHISE_RECEIPT', referenceId: { in: receiptOrderIds } }, select: { id: true },
    }) : [];
    await prisma.inventoryMovement.deleteMany({ where: { OR: [
      { branchId },
      ...(franchiseLocationIds.length ? [{ locationId: { in: franchiseLocationIds } }] : []),
      ...(receiptEvents.length ? [{ inventoryEventId: { in: receiptEvents.map((event) => event.id) } }] : []),
    ] } });
    await prisma.inventoryEvent.deleteMany({ where: { OR: [
      { branchId },
      ...(receiptOrderIds.length ? [{ referenceType: 'FRANCHISE_RECEIPT' as const, referenceId: { in: receiptOrderIds } }] : []),
    ] } });
    await prisma.inventorySnapshot.deleteMany({ where: { locationId: { in: [locationId, ...franchiseLocationIds] } } });
    if (franchiseLocationIds.length) await prisma.inventoryLocation.deleteMany({ where: { id: { in: franchiseLocationIds } } });
    if (storeIds.length) await prisma.franchiseStore.deleteMany({ where: { id: { in: storeIds } } });
    franchiseStoreIds.length = 0;
    franchiseStoreId = undefined;
    if (partnerIds.length) await prisma.franchisePartner.deleteMany({ where: { id: { in: partnerIds } } });
    franchisePartnerIds.length = 0;
    franchisePartnerId = undefined;
    if (franchiseSecondaryBranchId) {
      await prisma.branch.deleteMany({ where: { id: franchiseSecondaryBranchId } });
      franchiseSecondaryBranchId = undefined;
    }
    await prisma.batch.deleteMany({ where: { productId } });
    await prisma.product.update({ where: { id: productId }, data: { isBatchTracked: false, isExpiryTracked: false } });
  };

  const snapshotBalances = async () => {
    const snapshots = await prisma.inventorySnapshot.findMany({
      where: { locationId, productId, unitId },
      select: { stockState: true, baseQuantity: true },
    });
    return new Map(
      snapshots.map((snapshot) => [
        snapshot.stockState,
        Number(snapshot.baseQuantity),
      ]),
    );
  };

  const orderState = async (key: string) => {
    const [orders, items, reservationsForOrder, idempotency] = await Promise.all([
      prisma.salesOrder.count({ where: { idempotencyKey: key } }),
      prisma.salesOrderItem.count({ where: { salesOrder: { idempotencyKey: key } } }),
      prisma.stockReservation.count({
        where: { salesOrder: { idempotencyKey: key } },
      }),
      prisma.idempotencyRecord.findMany({
        where: { scope: "sales-order.create", key },
      }),
    ]);
    return { orders, items, reservations: reservationsForOrder, idempotency };
  };

  const createDispatchableOrder = async (quantity: number, key: string) => {
    const order = (await salesOrders.create(dto(quantity, key), userId, key)) as any;
    const linkedOrder = (await salesOrders.convertToInvoice(
      order.id,
      { warehouseId, sourceLocationId: locationId },
      userId,
    )) as any;
    return { order: linkedOrder, invoiceId: linkedOrder.invoiceId! };
  };

  const movementCount = () =>
    prisma.inventoryMovement.count({ where: { branchId } });

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    const category = await prisma.category.create({
      data: { code: `${prefix}-category`, name: "Sales order integration" },
    });
    const unit = await prisma.unit.create({
      data: { code: `${prefix}-unit`, name: "Piece", symbol: "pc" },
    });
    unitId = unit.id;
    const product = await prisma.product.create({
      data: {
        skuCode: `${prefix}-sku`,
        name: "Sales order integration product",
        categoryId: category.id,
        defaultUnitId: unit.id,
        sellingPrice: 10,
        isBatchTracked: false,
        productUnits: {
          create: { unitId: unit.id, conversionToBase: 1, isBaseUnit: true },
        },
      },
    });
    productId = product.id;

    const branch = await prisma.branch.create({
      data: {
        code: `${prefix}-branch`,
        name: "Sales order integration branch",
        city: "Test city",
        district: "Test district",
      },
    });
    branchId = branch.id;
    const user = await prisma.user.create({
      data: {
        fullName: "Sales order integration user",
        phone: `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10),
        email: `${prefix}@example.test`,
        passwordHash: "test-only",
        status: "ACTIVE",
      },
    });
    userId = user.id;
    const warehouse = await prisma.warehouse.create({
      data: {
        branchId,
        code: `${prefix}-warehouse`,
        name: "Sales order integration warehouse",
        // Public order/franchise paths select the oldest active warehouse as
        // the central warehouse; keep this isolated fixture deterministic.
        createdAt: new Date("2000-01-01T00:00:00Z"),
      },
    });
    warehouseId = warehouse.id;
    const location = await prisma.inventoryLocation.create({
      data: {
        branchId,
        warehouseId: warehouse.id,
        code: `${prefix}-location`,
        name: "Sales order integration location",
      },
    });
    locationId = location.id;
    const retailer = await prisma.retailer.create({
      data: {
        branchId,
        code: `${prefix}-retailer`,
        shopName: "Integration retailer",
        ownerName: "Integration owner",
        phone: `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-10),
        creditLimit: 10000,
        createdById: userId,
      },
    });
    retailerId = retailer.id;
    const salesRep = await prisma.salesRep.create({
      data: {
        userId,
        branchId,
        employeeCode: `${prefix}-rep`,
        createdById: userId,
      },
    });
    salesRepId = salesRep.id;
    const route = await prisma.route.create({
      data: {
        branchId,
        salesRepId,
        code: `${prefix}-route`,
        name: "Integration route",
        createdById: userId,
      },
    });
    routeId = route.id;
    await prisma.routeStop.create({
      data: { routeId, retailerId, stopOrder: 1 },
    });

    reservations = new StockReservationService(
      prisma,
      new InventoryLedgerService(prisma),
      new AuditLogService(prisma),
    );
    salesOrders = buildServices();
    await prisma.user.upsert({
      where: { id: "99999999-9999-4999-a999-999999999999" },
      update: { status: "ACTIVE" },
      create: {
        id: "99999999-9999-4999-a999-999999999999",
        fullName: "Online order system user",
        phone: `${Date.now()}1`.slice(-10),
        email: `${prefix}-system@example.test`,
        passwordHash: "test-only",
        status: "ACTIVE",
      },
    });
    process.env.ONLINE_ORDER_BRANCH_ID = branchId;
    retailerOrders = new RetailerOrderService(
      prisma,
      new AuditLogService(prisma),
      new RetailerNotificationService(prisma),
      invoiceService,
      salesOrders,
    );
  });

  beforeEach(async () => {
    await resetInventory();
  });

  afterAll(async () => {
    await resetInventory();
    await prisma.retailerNotification.deleteMany({ where: { branchId } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: userId } });
    await prisma.retailerLedgerEntry.deleteMany({ where: { branchId } });
    await prisma.financialLedgerEntry.deleteMany({ where: { branchId } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { branchId } } });
    await prisma.invoice.deleteMany({ where: { branchId } });
    await prisma.stockReservationItem.deleteMany({
      where: { reservation: { salesOrder: { branchId } } },
    });
    await prisma.salesOrder.deleteMany({ where: { branchId } });
    await prisma.idempotencyRecord.deleteMany({
      where: { scope: "sales-order.create", key: { startsWith: prefix } },
    });
    await prisma.inventoryMovement.deleteMany({ where: { branchId } });
    await prisma.inventoryEvent.deleteMany({ where: { branchId } });
    await prisma.inventorySnapshot.deleteMany({ where: { locationId } });
    await prisma.batch.deleteMany({ where: { productId } });
    await prisma.routeStop.deleteMany({ where: { routeId } });
    await prisma.route.delete({ where: { id: routeId } });
    await prisma.salesRep.delete({ where: { id: salesRepId } });
    await prisma.retailer.delete({ where: { id: retailerId } });
    await prisma.inventoryLocation.delete({ where: { id: locationId } });
    const warehouse = await prisma.warehouse.findFirst({ where: { branchId } });
    if (warehouse) await prisma.warehouse.delete({ where: { id: warehouse.id } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.unit.delete({ where: { id: unitId } });
    await prisma.category.deleteMany({ where: { code: `${prefix}-category` } });
    await prisma.branch.delete({ where: { id: branchId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
    delete process.env.ONLINE_ORDER_BRANCH_ID;
  });

  it("atomically rolls back after reservation failure", async () => {
    const key = `${prefix}-rollback`;
    await seedAvailable(5);
    const beforeMovementCount = await prisma.inventoryMovement.count({
      where: { branchId },
    });
    const originalReserve = reservations.reserveStock.bind(reservations);
    const reserveSpy = jest
      .spyOn(reservations, "reserveStock")
      .mockImplementation(async (...args: any[]) => {
        await originalReserve(...args);
        throw new Error("forced failure after reservation");
      });

    await expect(salesOrders.create(dto(2, key), userId, key)).rejects.toThrow(
      "forced failure after reservation",
    );
    reserveSpy.mockRestore();

    expect(await orderState(key)).toMatchObject({
      orders: 0,
      items: 0,
      reservations: 0,
      idempotency: [],
    });
    expect(await prisma.inventoryMovement.count({ where: { branchId } })).toBe(
      beforeMovementCount,
    );
    expect(await snapshotBalances()).toEqual(new Map([["AVAILABLE", 5]]));
  });

  it("rejects insufficient stock without changing PostgreSQL state", async () => {
    const key = `${prefix}-insufficient`;
    await seedAvailable(5);
    const beforeMovementCount = await prisma.inventoryMovement.count({
      where: { branchId },
    });

    await expect(salesOrders.create(dto(6, key), userId, key)).rejects.toThrow(
      /Insufficient available stock|Insufficient stock/i,
    );

    expect(await orderState(key)).toMatchObject({
      orders: 0,
      items: 0,
      reservations: 0,
      idempotency: [],
    });
    expect(await prisma.inventoryMovement.count({ where: { branchId } })).toBe(
      beforeMovementCount,
    );
    expect(await snapshotBalances()).toEqual(new Map([["AVAILABLE", 5]]));
  });

  it("serializes concurrent reservations and never reserves ten units", async () => {
    await seedAvailable(5);
    const results = await Promise.allSettled([
      salesOrders.create(dto(5, `${prefix}-concurrent-a`), userId),
      salesOrders.create(dto(5, `${prefix}-concurrent-b`), userId),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const balances = await snapshotBalances();
    expect(balances.get("RESERVED")).toBe(5);
    expect(balances.get("AVAILABLE") ?? 0).toBe(0);
    expect(
      await prisma.stockReservation.count({
        where: { salesOrder: { branchId } },
      }),
    ).toBe(1);
    expect(await prisma.salesOrder.count({ where: { branchId } })).toBe(1);
  });

  it("returns the same result for repeated idempotent submission", async () => {
    const key = `${prefix}-same-request`;
    await seedAvailable(5);
    const first = (await salesOrders.create(dto(2, key), userId, key)) as any;
    const second = (await salesOrders.create(dto(2, key), userId, key)) as any;

    expect(second.id).toBe(first.id);
    expect(await prisma.salesOrder.count({ where: { branchId } })).toBe(1);
    expect(
      await prisma.stockReservation.count({
        where: { salesOrder: { branchId } },
      }),
    ).toBe(1);
    expect(await prisma.inventoryMovement.count({ where: { branchId } })).toBe(3);
    expect((await snapshotBalances()).get("RESERVED")).toBe(2);
  });

  it("rejects a changed payload for an existing idempotency key", async () => {
    const key = `${prefix}-changed-request`;
    await seedAvailable(5);
    await salesOrders.create(dto(2, key), userId, key);

    await expect(salesOrders.create(dto(3, key), userId, key)).rejects.toThrow(
      "different request",
    );
    expect(await prisma.salesOrder.count({ where: { branchId } })).toBe(1);
    expect(
      await prisma.stockReservation.count({
        where: { salesOrder: { branchId } },
      }),
    ).toBe(1);
    expect((await snapshotBalances()).get("RESERVED")).toBe(2);
  });

  it("releases a reservation exactly once on repeated cancellation", async () => {
    const key = `${prefix}-cancel`;
    await seedAvailable(5);
    const order = (await salesOrders.create(dto(2, key), userId, key)) as any;
    const reservationMovementCount = await prisma.inventoryMovement.count({
      where: { branchId },
    });

    await salesOrders.cancel(order.id, userId);
    const afterFirstCancel = await prisma.inventoryMovement.count({
      where: { branchId },
    });
    expect(afterFirstCancel).toBe(reservationMovementCount + 2);
    expect((await snapshotBalances()).get("AVAILABLE")).toBe(5);
    expect((await snapshotBalances()).get("RESERVED") ?? 0).toBe(0);
    expect(
      await prisma.stockReservation.count({
        where: { salesOrderId: order.id, status: "RELEASED" },
      }),
    ).toBe(1);

    await salesOrders.cancel(order.id, userId);
    expect(await prisma.inventoryMovement.count({ where: { branchId } })).toBe(
      afterFirstCancel,
    );
    expect((await snapshotBalances()).get("AVAILABLE")).toBe(5);
  });

  it("consumes RESERVED stock exactly once during invoice dispatch", async () => {
    await seedAvailable(5);
    const { order, invoiceId } = await createDispatchableOrder(2, `${prefix}-dispatch`);
    const beforeDispatch = await movementCount();

    await invoiceService.post(invoiceId, userId);

    const reservation = await prisma.stockReservation.findFirstOrThrow({
      where: { salesOrderId: order.id },
    });
    expect(reservation.status).toBe("CONSUMED");
    expect((await snapshotBalances()).get("AVAILABLE")).toBe(3);
    expect((await snapshotBalances()).get("RESERVED") ?? 0).toBe(0);
    expect(await movementCount()).toBe(beforeDispatch + 1);
    expect(
      await prisma.inventoryMovement.count({
        where: { branchId, referenceType: "INVOICE", referenceId: invoiceId },
      }),
    ).toBe(1);
  });

  it("makes duplicate dispatch idempotent", async () => {
    await seedAvailable(5);
    const { order, invoiceId } = await createDispatchableOrder(2, `${prefix}-dispatch-duplicate`);
    await invoiceService.post(invoiceId, userId);
    const afterFirst = await movementCount();

    await invoiceService.post(invoiceId, userId);

    const reservation = await prisma.stockReservation.findFirstOrThrow({
      where: { salesOrderId: order.id },
    });
    expect(reservation.status).toBe("CONSUMED");
    expect(await movementCount()).toBe(afterFirst);
    expect(
      await prisma.inventoryMovement.count({
        where: { branchId, referenceType: "INVOICE", referenceId: invoiceId },
      }),
    ).toBe(1);
  });

  it("cancels an active reservation without physical deduction", async () => {
    await seedAvailable(5);
    const { order } = await (async () => {
      const created = (await salesOrders.create(dto(2, `${prefix}-cancel-dispatch`), userId)) as any;
      return { order: created };
    })();
    const beforeCancel = await movementCount();

    await salesOrders.cancel(order.id, userId);

    const reservation = await prisma.stockReservation.findFirstOrThrow({
      where: { salesOrderId: order.id },
    });
    expect(reservation.status).toBe("RELEASED");
    expect((await snapshotBalances()).get("AVAILABLE")).toBe(5);
    expect((await snapshotBalances()).get("RESERVED") ?? 0).toBe(0);
    expect(await movementCount()).toBe(beforeCancel + 2);
  });

  it("does not release an already released reservation twice", async () => {
    await seedAvailable(5);
    const order = (await salesOrders.create(dto(2, `${prefix}-cancel-duplicate`), userId)) as any;
    await salesOrders.cancel(order.id, userId);
    const afterFirst = await movementCount();

    await salesOrders.cancel(order.id, userId);

    expect(await movementCount()).toBe(afterFirst);
    expect((await snapshotBalances()).get("AVAILABLE")).toBe(5);
  });

  it("rejects consumption after cancellation without deducting stock", async () => {
    await seedAvailable(5);
    const order = (await salesOrders.create(dto(2, `${prefix}-cancel-then-dispatch`), userId)) as any;
    await salesOrders.cancel(order.id, userId);
    const beforeDispatch = await movementCount();

    await expect(
      prisma.$transaction((tx) =>
        reservations.consumeForOrder(tx, {
          salesOrderId: order.id,
          invoiceId: randomUUID(),
          branchId,
          createdById: userId,
        }),
      ),
    ).rejects.toThrow("No active reservation");
    expect(await movementCount()).toBe(beforeDispatch);
    expect((await snapshotBalances()).get("AVAILABLE")).toBe(5);
  });

  it("rejects cancellation after dispatch without restoring consumed stock", async () => {
    await seedAvailable(5);
    const { order, invoiceId } = await createDispatchableOrder(2, `${prefix}-dispatch-then-cancel`);
    await invoiceService.post(invoiceId, userId);
    const beforeCancel = await movementCount();

    await expect(salesOrders.cancel(order.id, userId)).rejects.toThrow(
      "Order cannot be cancelled",
    );
    expect(await movementCount()).toBe(beforeCancel);
    expect((await snapshotBalances()).get("AVAILABLE")).toBe(3);
    expect((await snapshotBalances()).get("RESERVED") ?? 0).toBe(0);
  });

  it("rolls back invoice, consumption, and movement on forced dispatch failure", async () => {
    await seedAvailable(5);
    const { order, invoiceId } = await createDispatchableOrder(2, `${prefix}-dispatch-failure`);
    const beforeDispatch = await movementCount();
    const originalConsume = reservations.consumeForOrder.bind(reservations);
    const consumeSpy = jest
      .spyOn(reservations, "consumeForOrder")
      .mockImplementation(async (...args: any[]) => {
        await originalConsume(...args);
        throw new Error("forced dispatch failure");
      });

    await expect(invoiceService.post(invoiceId, userId)).rejects.toThrow(
      "forced dispatch failure",
    );
    consumeSpy.mockRestore();

    const reservation = await prisma.stockReservation.findFirstOrThrow({
      where: { salesOrderId: order.id },
    });
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(reservation.status).toBe("ACTIVE");
    expect(invoice.status).toBe("DRAFT");
    expect(await movementCount()).toBe(beforeDispatch);
    expect((await snapshotBalances()).get("AVAILABLE")).toBe(3);
    expect((await snapshotBalances()).get("RESERVED")).toBe(2);
    expect(
      await prisma.financialLedgerEntry.count({ where: { referenceId: invoiceId } }),
    ).toBe(0);
  });

  it("serializes concurrent duplicate dispatch requests", async () => {
    await seedAvailable(5);
    const { order, invoiceId } = await createDispatchableOrder(2, `${prefix}-dispatch-race`);
    const beforeDispatch = await movementCount();

    const results = await Promise.allSettled([
      invoiceService.post(invoiceId, userId),
      invoiceService.post(invoiceId, userId),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    const reservation = await prisma.stockReservation.findFirstOrThrow({
      where: { salesOrderId: order.id },
    });
    expect(reservation.status).toBe("CONSUMED");
    expect(await movementCount()).toBe(beforeDispatch + 1);
    expect(
      await prisma.inventoryMovement.count({
        where: { branchId, referenceType: "INVOICE", referenceId: invoiceId },
      }),
    ).toBe(1);
  });

  it("routes public checkout through authoritative pricing and reservation", async () => {
    await seedAvailable(5);
    const key = `${prefix}-public-create`;
    const order = (await salesOrders.createPublicOrder({
      firstName: "Online",
      lastName: "Customer",
      phone: `${Date.now()}`.slice(-10),
      address: "Test address",
      idempotencyKey: key,
      items: [{ productId, quantity: 2 }],
    }, key)) as any;

    const stored = await prisma.salesOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true, reservations: { include: { items: true } } },
    });
    expect(stored.source).toBe("STOREFRONT");
    expect(Number(stored.items[0].unitPrice)).toBe(10);
    expect(Number(stored.items[0].baseQuantity)).toBe(2);
    expect(stored.reservations).toHaveLength(1);
    expect(stored.reservations[0].status).toBe("ACTIVE");
    expect((await snapshotBalances()).get("AVAILABLE")).toBe(3);
    expect((await snapshotBalances()).get("RESERVED")).toBe(2);
    expect(await prisma.idempotencyRecord.count({ where: { key: `${key}` } })).toBe(1);
  });

  it("routes retailer portal orders through the same reservation path", async () => {
    await seedAvailable(5);
    const key = `${prefix}-retailer-create`;
    const order = (await retailerOrders.placeOrder(
      retailerId,
      [{ productId, unitId, quantity: 2 }],
      "retailer order",
      key,
    )) as any;
    const reservation = await prisma.stockReservation.findFirstOrThrow({
      where: { salesOrderId: order.id },
    });
    const item = await prisma.salesOrderItem.findFirstOrThrow({
      where: { salesOrderId: order.id },
    });
    expect(Number(item.unitPrice)).toBe(10);
    expect(reservation.status).toBe("ACTIVE");
    expect((await snapshotBalances()).get("AVAILABLE")).toBe(3);
    expect((await snapshotBalances()).get("RESERVED")).toBe(2);
  });

  it.each([
    ["public", async (key: string) => salesOrders.createPublicOrder({
      firstName: "Online", lastName: "Customer", phone: `${Date.now()}`.slice(-10),
      address: "Test address", idempotencyKey: key, items: [{ productId, quantity: 6 }],
    }, key)],
    ["retailer", async (key: string) => retailerOrders.placeOrder(
      retailerId, [{ productId, unitId, quantity: 6 }], undefined, key,
    )],
  ])("rejects insufficient stock for %s orders without partial state", async (_channel, operation) => {
    await seedAvailable(5);
    const key = `${prefix}-insufficient-${_channel}`;
    const before = await movementCount();
    await expect(operation(key)).rejects.toThrow(/Insufficient (available )?stock/i);
    expect(await prisma.salesOrder.count({ where: { branchId } })).toBe(0);
    expect(await prisma.stockReservation.count({ where: { salesOrder: { branchId } } })).toBe(0);
    expect(await movementCount()).toBe(before);
    expect((await snapshotBalances()).get("AVAILABLE")).toBe(5);
  });

  it("replays a public order by idempotency key without duplicates", async () => {
    await seedAvailable(5);
    const key = `${prefix}-public-retry`;
    const input = {
      firstName: "Retry", lastName: "Customer", phone: `${Date.now()}`.slice(-10),
      address: "Retry address", idempotencyKey: key, items: [{ productId, quantity: 2 }],
    };
    const first = (await salesOrders.createPublicOrder(input, key)) as any;
    const second = (await salesOrders.createPublicOrder(input, key)) as any;
    expect(second.id).toBe(first.id);
    expect(await prisma.salesOrder.count({ where: { branchId } })).toBe(1);
    expect(await prisma.stockReservation.count({ where: { salesOrder: { branchId } } })).toBe(1);
    expect(await prisma.idempotencyRecord.count({ where: { scope: "sales-order.create", key } })).toBe(1);
  });

  it("replays a retailer order by idempotency key without duplicates", async () => {
    await seedAvailable(5);
    const key = `${prefix}-retailer-retry`;
    const first = (await retailerOrders.placeOrder(retailerId, [{ productId, unitId, quantity: 2 }], undefined, key)) as any;
    const second = (await retailerOrders.placeOrder(retailerId, [{ productId, unitId, quantity: 2 }], undefined, key)) as any;
    expect(second.id).toBe(first.id);
    expect(await prisma.salesOrder.count({ where: { branchId } })).toBe(1);
    expect(await prisma.stockReservation.count({ where: { salesOrder: { branchId } } })).toBe(1);
  });

  it("rejects a conflicting public idempotency key", async () => {
    await seedAvailable(5);
    const key = `${prefix}-public-conflict`;
    const base = { firstName: "Conflict", lastName: "Customer", phone: `${Date.now()}`.slice(-10), address: "Address", idempotencyKey: key };
    await salesOrders.createPublicOrder({ ...base, items: [{ productId, quantity: 2 }] }, key);
    await expect(salesOrders.createPublicOrder({ ...base, items: [{ productId, quantity: 3 }] }, key)).rejects.toThrow("different request");
    expect(await prisma.salesOrder.count({ where: { branchId } })).toBe(1);
  });

  it("releases an online retailer reservation exactly once on cancellation", async () => {
    await seedAvailable(5);
    const key = `${prefix}-retailer-cancel`;
    const order = (await retailerOrders.placeOrder(retailerId, [{ productId, unitId, quantity: 2 }], undefined, key)) as any;
    const before = await movementCount();
    await retailerOrders.cancelOrder(retailerId, order.id);
    const after = await movementCount();
    await retailerOrders.cancelOrder(retailerId, order.id);
    expect(await movementCount()).toBe(after);
    expect(after).toBe(before + 2);
    expect((await prisma.stockReservation.findFirstOrThrow({ where: { salesOrderId: order.id } })).status).toBe("RELEASED");
    expect((await snapshotBalances()).get("AVAILABLE")).toBe(5);
  });

  it("dispatches a public order through reservation consumption", async () => {
    await seedAvailable(5);
    const key = `${prefix}-public-dispatch`;
    const order = (await salesOrders.createPublicOrder({
      firstName: "Dispatch", lastName: "Customer", phone: `${Date.now()}`.slice(-10),
      address: "Address", idempotencyKey: key, items: [{ productId, quantity: 2 }],
    }, key)) as any;
    const converted = (await salesOrders.convertToInvoice(order.id, { warehouseId, sourceLocationId: locationId }, userId)) as any;
    const before = await movementCount();
    await invoiceService.post(converted.invoiceId, userId);
    expect((await prisma.stockReservation.findFirstOrThrow({ where: { salesOrderId: order.id } })).status).toBe("CONSUMED");
    expect((await snapshotBalances()).get("AVAILABLE")).toBe(3);
    expect((await snapshotBalances()).get("RESERVED") ?? 0).toBe(0);
    expect(await movementCount()).toBe(before + 1);
  });

  it("allows only one concurrent public order to reserve five units", async () => {
    await seedAvailable(5);
    const makeInput = (key: string) => ({
      firstName: "Concurrent", lastName: "Customer", phone: `${Date.now()}${key.slice(-2)}`.slice(-10),
      address: "Address", idempotencyKey: key, items: [{ productId, quantity: 5 }],
    });
    const results = await Promise.allSettled([
      salesOrders.createPublicOrder(makeInput(`${prefix}-online-a`), `${prefix}-online-a`),
      salesOrders.createPublicOrder(makeInput(`${prefix}-online-b`), `${prefix}-online-b`),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await prisma.stockReservation.count({ where: { salesOrder: { branchId } } })).toBe(1);
    expect((await snapshotBalances()).get("RESERVED")).toBe(5);
    expect((await snapshotBalances()).get("AVAILABLE") ?? 0).toBe(0);
  });

  it("reserves a batch-tracked sales order from a single eligible batch", async () => {
    await seedBatchStock([{ name: "single", quantity: 80, expiryDate: new Date("2027-11-01T00:00:00Z") }]);
    const key = `${prefix}-batch-single`;
    const order = (await salesOrders.createPublicOrder({
      firstName: "Batch", lastName: "Customer", phone: `${Date.now()}`.slice(-10),
      address: "Batch address", idempotencyKey: key, items: [{ productId, quantity: 10 }],
    }, key)) as any;
    const allocations = await prisma.stockReservationItem.findMany({ where: { reservation: { salesOrderId: order.id } } });
    expect(allocations).toHaveLength(1);
    expect(Number(allocations[0].baseQuantity)).toBe(10);
    expect((await batchBalances()).map((row) => [row.stockState, Number(row.baseQuantity)])).toEqual([["AVAILABLE", 70], ["RESERVED", 10]]);
  });

  it("allocates multiple batches in FEFO order and persists both allocations", async () => {
    await seedBatchStock([
      { name: "later", quantity: 20, expiryDate: new Date("2027-01-01T00:00:00Z") },
      { name: "earlier", quantity: 6, expiryDate: new Date("2026-11-01T00:00:00Z") },
    ]);
    const key = `${prefix}-batch-fefo`;
    const order = (await salesOrders.createPublicOrder({
      firstName: "FEFO", lastName: "Customer", phone: `${Date.now()}`.slice(-10),
      address: "Batch address", idempotencyKey: key, items: [{ productId, quantity: 10 }],
    }, key)) as any;
    const allocations = await prisma.stockReservationItem.findMany({
      where: { reservation: { salesOrderId: order.id } },
      include: { batch: { select: { batchNumber: true } } },
      orderBy: { createdAt: "asc" },
    });
    expect(allocations.map((row) => [row.batch?.batchNumber, Number(row.baseQuantity)])).toEqual([
      [`${prefix}-earlier`, 6], [`${prefix}-later`, 4],
    ]);
  });

  it("rejects insufficient total eligible batch stock without partial records or ledger movements", async () => {
    await seedBatchStock([
      { name: "short-a", quantity: 4, expiryDate: new Date("2027-01-01T00:00:00Z") },
      { name: "short-b", quantity: 5, expiryDate: new Date("2027-02-01T00:00:00Z") },
    ]);
    const before = await movementCount();
    const key = `${prefix}-batch-insufficient`;
    await expect(salesOrders.createPublicOrder({
      firstName: "Short", lastName: "Customer", phone: `${Date.now()}`.slice(-10),
      address: "Batch address", idempotencyKey: key, items: [{ productId, quantity: 10 }],
    }, key)).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
    expect(await prisma.salesOrder.count({ where: { branchId } })).toBe(0);
    expect(await prisma.stockReservation.count({ where: { salesOrder: { branchId } } })).toBe(0);
    expect(await movementCount()).toBe(before);
    expect((await batchBalances()).filter((row) => row.stockState === "RESERVED")).toHaveLength(0);
  });

  it("does not allocate expired or blocked batches", async () => {
    await seedBatchStock([
      { name: "expired", quantity: 100, expiryDate: new Date(Date.now() - 86_400_000) },
      { name: "blocked", quantity: 100, expiryDate: new Date("2027-01-01T00:00:00Z"), status: "BLOCKED" },
      { name: "valid-short", quantity: 5, expiryDate: new Date("2027-02-01T00:00:00Z") },
    ]);
    const key = `${prefix}-batch-expired`;
    await expect(salesOrders.createPublicOrder({
      firstName: "Expiry", lastName: "Customer", phone: `${Date.now()}`.slice(-10),
      address: "Batch address", idempotencyKey: key, items: [{ productId, quantity: 10 }],
    }, key)).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
  });

  it("preserves an explicitly selected batch without substituting another", async () => {
    await seedBatchStock([
      { name: "explicit", quantity: 10, expiryDate: new Date("2027-01-01T00:00:00Z") },
      { name: "not-selected", quantity: 20, expiryDate: new Date("2027-02-01T00:00:00Z") },
    ]);
    const batch = await prisma.batch.findFirstOrThrow({ where: { productId, batchNumber: `${prefix}-explicit` } });
    const key = `${prefix}-batch-explicit`;
    const order = (await salesOrders.create({
      ...dto(4, key), items: [{ productId, unitId, quantity: 4, batchId: batch.id }],
    }, userId, key)) as any;
    const allocations = await prisma.stockReservationItem.findMany({ where: { reservation: { salesOrderId: order.id } } });
    expect(allocations).toHaveLength(1);
    expect(allocations[0].batchId).toBe(batch.id);
    expect(Number(allocations[0].baseQuantity)).toBe(4);
  });

  it("reserves, dispatches, and replays a batch-tracked franchise order exactly once", async () => {
    await seedBatchStock([{ name: "franchise", quantity: 80, expiryDate: new Date("2027-01-01T00:00:00Z") }]);
    const franchise = new FranchiseService(prisma, salesOrders, new InventoryLedgerService(prisma));
    const partner = await franchise.createPartner({ name: `${prefix} partner`, phone: "9800000000" });
    franchisePartnerId = String((partner as any).id);
    franchisePartnerIds.push(franchisePartnerId);
    const store = await franchise.createStore({ partnerId: String((partner as any).id), branchId, name: `${prefix} franchise`, address: "Test" });
    franchiseStoreId = String((store as any).id);
    franchiseStoreIds.push(franchiseStoreId);
    const supply = await franchise.createSupplyOrder({
      storeId: String((store as any).id), items: [{ productId, unitId, quantity: 10 }],
    }, userId);
    franchiseOrderId = String((supply as any).id);
    franchiseOrderIds.push(franchiseOrderId);
    const approved = await franchise.transition(String((supply as any).id), "approve", userId);
    const salesOrderId = String((approved as any).salesOrderId);
    expect((await batchBalances()).map((row) => [row.stockState, Number(row.baseQuantity)])).toEqual([["AVAILABLE", 70], ["RESERVED", 10]]);
    await franchise.transition(String((supply as any).id), "pick", userId);
    await franchise.transition(String((supply as any).id), "pack", userId);
    await franchise.transition(String((supply as any).id), "dispatch", userId);
    await franchise.transition(String((supply as any).id), "dispatch", userId);
    expect((await prisma.stockReservation.findFirstOrThrow({ where: { salesOrderId } })).status).toBe("CONSUMED");
    expect((await batchBalances())
      .filter((row) => Number(row.baseQuantity) > 0)
      .map((row) => [row.stockState, Number(row.baseQuantity)])).toEqual([["AVAILABLE", 70]]);
    const received = await franchise.transition(String((supply as any).id), "receive", userId);
    const storeAfterReceipt = await prisma.franchiseStore.findUniqueOrThrow({ where: { id: franchiseStoreId! }, select: { inventoryLocationId: true } });
    const franchiseLocationId = String(storeAfterReceipt.inventoryLocationId);
    expect((received as any).status).toBe("RECEIVED");
    expect(await prisma.inventoryLocation.findUniqueOrThrow({ where: { id: franchiseLocationId } })).toMatchObject({ branchId, type: "FRANCHISE_STORE" });
    const receiptMovements = await prisma.inventoryMovement.findMany({ where: { referenceType: "FRANCHISE_RECEIPT", referenceId: franchiseOrderId, locationId: franchiseLocationId } });
    expect(receiptMovements).toHaveLength(1);
    expect(receiptMovements.reduce((sum, movement) => sum + Number(movement.baseQuantityDelta), 0)).toBe(10);
    await franchise.transition(String((supply as any).id), "receive", userId);
    expect(await prisma.inventoryMovement.count({ where: { referenceType: "FRANCHISE_RECEIPT", referenceId: franchiseOrderId } })).toBe(1);
    expect(Number((await prisma.inventorySnapshot.findFirstOrThrow({ where: { locationId: franchiseLocationId, productId, stockState: "AVAILABLE" } })).baseQuantity)).toBe(10);
    expect((await batchBalances()).filter((row) => row.stockState === "AVAILABLE").reduce((sum, row) => sum + Number(row.baseQuantity), 0)).toBe(70);
  });

  it("receives exact multi-batch allocations, reuses locations, and isolates franchise branches", async () => {
    await seedBatchStock([
      { name: "franchise-a", quantity: 6, expiryDate: new Date("2027-01-01T00:00:00Z") },
      { name: "franchise-b", quantity: 20, expiryDate: new Date("2027-02-01T00:00:00Z") },
    ]);
    const franchise = new FranchiseService(prisma, salesOrders, new InventoryLedgerService(prisma));
    const partner = await franchise.createPartner({ name: `${prefix} multi partner`, phone: "9800000001" });
    franchisePartnerId = String((partner as any).id);
    franchisePartnerIds.push(franchisePartnerId);
    const storeA = await franchise.createStore({ partnerId: franchisePartnerId, branchId, name: `${prefix} franchise A`, address: "Branch A" });
    franchiseStoreId = String((storeA as any).id);
    franchiseStoreIds.push(franchiseStoreId);
    const branchB = await prisma.branch.create({ data: {
      code: `${prefix}-branch-b`, name: "Franchise branch B", city: "Test city", district: "Test district",
    } });
    franchiseSecondaryBranchId = branchB.id;
    const storeB = await franchise.createStore({ partnerId: franchisePartnerId, branchId: branchB.id, name: `${prefix} franchise B`, address: "Branch B" });
    const storeBId = String((storeB as any).id);
    franchiseStoreIds.push(storeBId);

    const createOrder = async (storeId: string, quantity: number) => {
      const supply = await franchise.createSupplyOrder({ storeId, items: [{ productId, unitId, quantity }] }, userId) as any;
      franchiseOrderId = String(supply.id);
      franchiseOrderIds.push(franchiseOrderId);
      await franchise.transition(franchiseOrderId, "approve", userId);
      await franchise.transition(franchiseOrderId, "pick", userId);
      await franchise.transition(franchiseOrderId, "pack", userId);
      await franchise.transition(franchiseOrderId, "dispatch", userId);
      return supply;
    };
    const first = await createOrder(franchiseStoreId, 10);
    const firstSalesOrderId = (await prisma.franchiseSupplyOrder.findUniqueOrThrow({ where: { id: String(first.id) }, select: { salesOrderId: true } })).salesOrderId!;
    const firstLines = await prisma.stockReservationItem.findMany({
      where: { reservation: { salesOrderId: firstSalesOrderId } },
      include: { batch: { select: { batchNumber: true } } },
    });
    expect(firstLines.map((line) => [line.batch?.batchNumber, Number(line.baseQuantity)]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))).toEqual([
      [`${prefix}-franchise-a`, 6], [`${prefix}-franchise-b`, 4],
    ].sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
    expect((await batchBalances()).reduce((sum, row) => sum + Number(row.baseQuantity), 0)).toBe(16);
    await franchise.transition(franchiseOrderId!, "receive", userId);
    const storeALocationId = (await prisma.franchiseStore.findUniqueOrThrow({ where: { id: franchiseStoreId }, select: { inventoryLocationId: true } })).inventoryLocationId!;
    const firstReceipt = await prisma.inventorySnapshot.findMany({ where: { locationId: storeALocationId, productId, stockState: "AVAILABLE" }, include: { batch: { select: { batchNumber: true } } } });
    expect(firstReceipt.map((row) => [row.batch?.batchNumber, Number(row.baseQuantity)]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))).toEqual([
      [`${prefix}-franchise-a`, 6], [`${prefix}-franchise-b`, 4],
    ].sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
    await franchise.transition(franchiseOrderId!, "receive", userId);
    expect(await prisma.inventoryMovement.count({ where: { referenceType: "FRANCHISE_RECEIPT", referenceId: franchiseOrderId } })).toBe(2);
    expect((await batchBalances()).reduce((sum, row) => sum + Number(row.baseQuantity), 0)).toBe(16);

    const second = await createOrder(franchiseStoreId, 2);
    await franchise.transition(franchiseOrderId!, "receive", userId);
    const reusedStore = await prisma.franchiseStore.findUniqueOrThrow({ where: { id: franchiseStoreId }, select: { inventoryLocationId: true, branchId: true } });
    expect(reusedStore.inventoryLocationId).toBe(storeALocationId);
    expect(reusedStore.branchId).toBe(branchId);
    expect(await prisma.inventoryLocation.count({ where: { type: "FRANCHISE_STORE", branchId } })).toBe(1);
    expect((await prisma.inventorySnapshot.findMany({ where: { locationId: storeALocationId, productId, stockState: "AVAILABLE" } })).reduce((sum, row) => sum + Number(row.baseQuantity), 0)).toBe(12);

    const third = await createOrder(storeBId, 1);
    await franchise.transition(franchiseOrderId!, "receive", userId);
    const storeBLocationId = (await prisma.franchiseStore.findUniqueOrThrow({ where: { id: storeBId }, select: { inventoryLocationId: true } })).inventoryLocationId!;
    expect(storeBLocationId).not.toBe(storeALocationId);
    expect(await prisma.inventoryLocation.findUniqueOrThrow({ where: { id: storeBLocationId } })).toMatchObject({ branchId: branchB.id, type: "FRANCHISE_STORE" });
    expect((await prisma.inventorySnapshot.findMany({ where: { locationId: storeBLocationId, productId, stockState: "AVAILABLE" } })).reduce((sum, row) => sum + Number(row.baseQuantity), 0)).toBe(1);
    expect((await prisma.inventorySnapshot.findMany({ where: { locationId: storeALocationId, productId, stockState: "AVAILABLE" } })).reduce((sum, row) => sum + Number(row.baseQuantity), 0)).toBe(12);
    expect((await batchBalances()).reduce((sum, row) => sum + Number(row.baseQuantity), 0)).toBe(13);
    expect((await prisma.franchiseSupplyOrder.findMany({ where: { id: { in: [String(first.id), String(second.id), String(third.id)] } }, select: { status: true } })).every((row) => row.status === "RECEIVED")).toBe(true);
  });

  it("rejects missing branch and invalid receipt and rolls back location creation on failure", async () => {
    await seedBatchStock([{ name: "franchise-rollback", quantity: 20, expiryDate: new Date("2027-01-01T00:00:00Z") }]);
    const franchise = new FranchiseService(prisma, salesOrders, new InventoryLedgerService(prisma));
    const partner = await franchise.createPartner({ name: `${prefix} legacy partner`, phone: "9800000002" });
    franchisePartnerId = String((partner as any).id);
    franchisePartnerIds.push(franchisePartnerId);
    const legacyStore = await prisma.franchiseStore.create({ data: {
      partnerId: franchisePartnerId, branchId: null, name: `${prefix} unassigned franchise`, address: "Needs branch",
    } });
    franchiseStoreId = legacyStore.id;
    franchiseStoreIds.push(franchiseStoreId);
    const supply = await franchise.createSupplyOrder({ storeId: legacyStore.id, items: [{ productId, unitId, quantity: 10 }] }, userId) as any;
    franchiseOrderId = String(supply.id);
    franchiseOrderIds.push(franchiseOrderId);
    await expect(franchise.transition(franchiseOrderId, "receive", userId)).rejects.toMatchObject({ statusCode: 422 });
    const approved = await franchise.transition(franchiseOrderId, "approve", userId) as any;
    await expect(franchise.transition(franchiseOrderId, "receive", userId)).rejects.toMatchObject({ statusCode: 422 });
    await franchise.transition(franchiseOrderId, "pick", userId);
    await franchise.transition(franchiseOrderId, "pack", userId);
    await franchise.transition(franchiseOrderId, "dispatch", userId);
    await expect(franchise.transition(franchiseOrderId, "receive", userId)).rejects.toThrow(/FRANCHISE_BRANCH_REQUIRED/);
    expect((await prisma.franchiseStore.findUniqueOrThrow({ where: { id: legacyStore.id } })).inventoryLocationId).toBeNull();
    expect((await prisma.franchiseSupplyOrder.findUniqueOrThrow({ where: { id: franchiseOrderId } })).status).toBe("DISPATCHED");
    expect(await prisma.inventoryMovement.count({ where: { referenceType: "FRANCHISE_RECEIPT", referenceId: franchiseOrderId } })).toBe(0);

    await franchise.assignStoreBranch(legacyStore.id, branchId);
    const failingLedger = { postEvent: jest.fn().mockRejectedValue(new Error("forced receipt failure")) } as unknown as InventoryLedgerService;
    const failingFranchise = new FranchiseService(prisma, salesOrders, failingLedger);
    await expect(failingFranchise.transition(franchiseOrderId, "receive", userId)).rejects.toThrow("forced receipt failure");
    expect((await prisma.franchiseStore.findUniqueOrThrow({ where: { id: legacyStore.id } })).inventoryLocationId).toBeNull();
    expect((await prisma.franchiseSupplyOrder.findUniqueOrThrow({ where: { id: franchiseOrderId } })).status).toBe("DISPATCHED");
    expect((await prisma.salesOrder.findUniqueOrThrow({ where: { id: approved.salesOrderId } })).status).toBe("DISPATCHED");
    expect(await prisma.inventoryMovement.count({ where: { referenceType: "FRANCHISE_RECEIPT", referenceId: franchiseOrderId } })).toBe(0);

    await franchise.transition(franchiseOrderId, "receive", userId);
    expect((await prisma.franchiseSupplyOrder.findUniqueOrThrow({ where: { id: franchiseOrderId } })).status).toBe("RECEIVED");
    expect((await prisma.franchiseStore.findUniqueOrThrow({ where: { id: legacyStore.id } })).inventoryLocationId).toBeTruthy();
  });

  it("allocates public online and B2B orders through the shared allocator", async () => {
    await seedBatchStock([
      { name: "channels-a", quantity: 6, expiryDate: new Date("2027-01-01T00:00:00Z") },
      { name: "channels-b", quantity: 20, expiryDate: new Date("2027-02-01T00:00:00Z") },
    ]);
    const onlineKey = `${prefix}-batch-online`;
    const online = (await salesOrders.createPublicOrder({
      firstName: "Online", lastName: "Customer", phone: `${Date.now()}`.slice(-10),
      address: "Batch address", idempotencyKey: onlineKey, items: [{ productId, quantity: 10 }],
    }, onlineKey)) as any;
    const onlineLines = await prisma.stockReservationItem.findMany({ where: { reservation: { salesOrderId: online.id } } });
    expect(onlineLines.map((line) => Number(line.baseQuantity))).toEqual([6, 4]);

    const b2bKey = `${prefix}-batch-b2b`;
    const b2b = (await retailerOrders.placeOrder(retailerId, [{ productId, unitId, quantity: 5 }], undefined, b2bKey)) as any;
    const b2bLines = await prisma.stockReservationItem.findMany({ where: { reservation: { salesOrderId: b2b.id } } });
    expect(b2bLines.reduce((sum, line) => sum + Number(line.baseQuantity), 0)).toBe(5);
    expect(b2bLines.every((line) => Boolean(line.batchId))).toBe(true);
  });

  it("proves B2B multi-batch FEFO allocation through invoice, dispatch, delivery, and payment", async () => {
    await seedBatchStock([
      { name: "p1-3a-batch-a", quantity: 3, expiryDate: new Date("2026-11-01T00:00:00Z") },
      { name: "p1-3a-batch-b", quantity: 20, expiryDate: new Date("2027-01-01T00:00:00Z") },
    ]);
    const batchRecords = await prisma.batch.findMany({
      where: { productId, batchNumber: { startsWith: `${prefix}-p1-3a-` } },
      orderBy: { expiryDate: "asc" },
    });
    expect(batchRecords.map((batch) => batch.batchNumber)).toEqual([
      `${prefix}-p1-3a-batch-a`,
      `${prefix}-p1-3a-batch-b`,
    ]);
    const [batchA, batchB] = batchRecords;
    const idempotencyKey = `${prefix}-p1-3a-b2b-order`;

    // No batchId is supplied: the B2B caller relies on the shared allocator.
    const order = (await retailerOrders.placeOrder(
      retailerId,
      [{ productId, unitId, quantity: 5 }],
      "P1-3A FEFO acceptance",
      idempotencyKey,
    )) as any;
    expect(order.source).toBe("DNP");
    expect(order.retailerId).toBe(retailerId);
    expect(order.branchId).toBe(branchId);
    expect(Number(order.items[0].unitPrice)).toBe(10);
    expect(Number(order.grandTotal)).toBe(50);

    const reservation = await prisma.stockReservation.findFirstOrThrow({
      where: { salesOrderId: order.id },
      include: { items: true },
    });
    const allocationByBatch = new Map(
      reservation.items.map((item) => [item.batchId, Number(item.baseQuantity)]),
    );
    expect(reservation.status).toBe("ACTIVE");
    expect(allocationByBatch).toEqual(new Map([[batchA.id, 3], [batchB.id, 2]]));

    const physicalByBatch = async () => {
      const rows = await prisma.inventorySnapshot.findMany({
        where: { locationId, productId, batchId: { in: [batchA.id, batchB.id] } },
        select: { batchId: true, stockState: true, baseQuantity: true },
      });
      return new Map([batchA.id, batchB.id].map((batchId) => [
        batchId,
        rows
          .filter((row) => row.batchId === batchId && ["AVAILABLE", "RESERVED"].includes(row.stockState))
          .reduce((sum, row) => sum + Number(row.baseQuantity), 0),
      ]));
    };
    const reservedByBatch = await prisma.inventorySnapshot.findMany({
      where: { locationId, productId, batchId: { in: [batchA.id, batchB.id] }, stockState: "RESERVED" },
      select: { batchId: true, baseQuantity: true },
    });
    expect(new Map(reservedByBatch.map((row) => [row.batchId, Number(row.baseQuantity)]))).toEqual(
      new Map([[batchA.id, 3], [batchB.id, 2]]),
    );
    expect([...((await physicalByBatch()).values())].reduce((sum, quantity) => sum + quantity, 0)).toBe(23);

    // Picking and packing are status-only transitions; persisted batch allocation must remain unchanged.
    await salesOrders.updateStatus(order.id, "PICKING", userId);
    await salesOrders.updateStatus(order.id, "PACKED", userId);
    const pickedPackedAllocations = await prisma.stockReservationItem.findMany({
      where: { reservation: { salesOrderId: order.id } },
    });
    expect(new Map(pickedPackedAllocations.map((item) => [item.batchId, Number(item.baseQuantity)]))).toEqual(
      new Map([[batchA.id, 3], [batchB.id, 2]]),
    );

    const invoiced = (await salesOrders.convertToInvoice(
      order.id,
      { warehouseId, sourceLocationId: locationId },
      userId,
    )) as any;
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: invoiced.invoiceId },
      include: { items: true },
    });
    expect(await prisma.invoice.count({ where: { salesOrder: { id: order.id } } })).toBe(1);
    expect(invoice.retailerId).toBe(retailerId);
    expect(invoice.items).toHaveLength(1);
    expect(Number(invoice.items[0].quantity)).toBe(5);
    expect(Number(invoice.items[0].unitPrice)).toBe(10);
    expect(Number(invoice.subtotal)).toBe(50);
    expect(Number(invoice.grandTotal)).toBe(50);
    await expect(
      salesOrders.convertToInvoice(order.id, { warehouseId, sourceLocationId: locationId }, userId),
    ).rejects.toThrow();
    expect(await prisma.invoice.count({ where: { salesOrder: { id: order.id } } })).toBe(1);

    const movementsBeforePost = await movementCount();
    await invoiceService.post(invoice.id, userId);
    await invoiceService.post(invoice.id, userId);
    expect(await movementCount()).toBe(movementsBeforePost + 2);
    const consumption = await prisma.inventoryMovement.findMany({
      where: {
        referenceType: "INVOICE",
        referenceId: invoice.id,
        movementType: "SALE_DEDUCTION",
      },
      select: { batchId: true, stockState: true, baseQuantityDelta: true },
    });
    expect(consumption).toHaveLength(2);
    expect(consumption.every((movement) => movement.stockState === "RESERVED")).toBe(true);
    expect(new Map(consumption.map((movement) => [movement.batchId, Number(movement.baseQuantityDelta)]))).toEqual(
      new Map([[batchA.id, -3], [batchB.id, -2]]),
    );
    expect(new Map(reservation.items.map((item) => [item.batchId, Number(item.baseQuantity)]))).toEqual(
      new Map([[batchA.id, 3], [batchB.id, 2]]),
    );
    expect((await prisma.stockReservation.findUniqueOrThrow({ where: { id: reservation.id } })).status).toBe("CONSUMED");
    expect(await physicalByBatch()).toEqual(new Map([[batchA.id, 0], [batchB.id, 18]]));
    expect(await prisma.retailerLedgerEntry.count({
      where: { retailerId, referenceType: "INVOICE", referenceId: invoice.id },
    })).toBe(1);

    const movementsBeforeDispatch = await movementCount();
    await salesOrders.updateStatus(order.id, "DISPATCHED", userId);
    await salesOrders.updateStatus(order.id, "DISPATCHED", userId);
    expect(await movementCount()).toBe(movementsBeforeDispatch);
    expect(await physicalByBatch()).toEqual(new Map([[batchA.id, 0], [batchB.id, 18]]));
    await salesOrders.updateStatus(order.id, "DELIVERED", userId);
    await salesOrders.updateStatus(order.id, "DELIVERED", userId);
    expect((await salesOrders.findById(order.id)).status).toBe("DELIVERED");
    expect(await movementCount()).toBe(movementsBeforeDispatch);
    expect(await physicalByBatch()).toEqual(new Map([[batchA.id, 0], [batchB.id, 18]]));
    expect(await prisma.inventoryLocation.count({ where: { type: "RETAILER" } })).toBe(0);

    const paymentKey = `${prefix}-p1-3a-b2b-payment`;
    const paymentService = new PaymentService(
      prisma,
      new AuditLogService(prisma),
      new RetailerLedgerService(prisma),
    );
    let paymentId: string | undefined;
    try {
      const paymentInput = {
        branchId,
        retailerId,
        invoiceId: invoice.id,
        amount: Number(invoice.grandTotal),
        method: "CASH" as const,
      };
      const payment = await paymentService.create(paymentInput, userId, paymentKey);
      paymentId = payment.id;
      const paymentReplay = await paymentService.create(paymentInput, userId, paymentKey);
      expect(paymentReplay.id).toBe(payment.id);
      expect(await prisma.payment.count({ where: { id: payment.id } })).toBe(1);
      expect(await prisma.retailerLedgerEntry.count({
        where: { retailerId, referenceType: "PAYMENT", referenceId: payment.id },
      })).toBe(1);
      expect(Number((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).dueAmount)).toBe(0);
    } finally {
      if (paymentId) {
        await prisma.retailerLedgerEntry.deleteMany({ where: { retailerId, referenceType: "PAYMENT", referenceId: paymentId } });
        await prisma.payment.deleteMany({ where: { id: paymentId } });
      }
      await prisma.idempotencyRecord.deleteMany({ where: { scope: "payment.create", key: paymentKey } });
    }
  });

  it("releases multi-batch reservations on cancellation and makes cancellation replay safe", async () => {
    await seedBatchStock([
      { name: "cancel-a", quantity: 6, expiryDate: new Date("2027-01-01T00:00:00Z") },
      { name: "cancel-b", quantity: 20, expiryDate: new Date("2027-02-01T00:00:00Z") },
    ]);
    const key = `${prefix}-batch-cancel`;
    const order = (await salesOrders.createPublicOrder({
      firstName: "Cancel", lastName: "Customer", phone: `${Date.now()}`.slice(-10),
      address: "Batch address", idempotencyKey: key, items: [{ productId, quantity: 10 }],
    }, key)) as any;
    const beforeCancel = await movementCount();
    await salesOrders.cancel(order.id, userId);
    const afterCancel = await movementCount();
    await salesOrders.cancel(order.id, userId);
    expect(await movementCount()).toBe(afterCancel);
    expect(afterCancel).toBe(beforeCancel + 4);
    expect((await prisma.stockReservation.findFirstOrThrow({ where: { salesOrderId: order.id } })).status).toBe("RELEASED");
    expect((await batchBalances()).filter((row) => row.stockState === "AVAILABLE").reduce((sum, row) => sum + Number(row.baseQuantity), 0)).toBe(26);
    expect((await batchBalances()).filter((row) => row.stockState === "RESERVED")).toHaveLength(0);
  });

  it("does not oversubscribe competing orders across batch snapshots", async () => {
    await seedBatchStock([
      { name: "race-a", quantity: 6, expiryDate: new Date("2027-01-01T00:00:00Z") },
      { name: "race-b", quantity: 4, expiryDate: new Date("2027-02-01T00:00:00Z") },
    ]);
    const makeInput = (key: string) => ({
      firstName: "Race", lastName: "Customer", phone: `${Date.now()}${key.slice(-1)}`.slice(-10),
      address: "Batch address", idempotencyKey: key, items: [{ productId, quantity: 8 }],
    });
    const results = await Promise.allSettled([
      salesOrders.createPublicOrder(makeInput(`${prefix}-batch-race-a`), `${prefix}-batch-race-a`),
      salesOrders.createPublicOrder(makeInput(`${prefix}-batch-race-b`), `${prefix}-batch-race-b`),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect((await batchBalances()).filter((row) => row.stockState === "RESERVED").reduce((sum, row) => sum + Number(row.baseQuantity), 0)).toBe(8);
    expect((await batchBalances()).filter((row) => row.stockState === "AVAILABLE").reduce((sum, row) => sum + Number(row.baseQuantity), 0)).toBe(2);
  });
});
