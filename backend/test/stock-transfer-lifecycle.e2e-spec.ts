import { createHash, randomUUID } from "crypto";
import { AuditLogService } from "../src/audit/audit-log.service";
import { PrismaService } from "../src/database/prisma.service";
import { InventoryLedgerService } from "../src/inventory/services/inventory-ledger.service";
import { StockTransferService } from "../src/inventory/services/stock-transfer.service";
import { StockReservationService } from "../src/inventory/services/stock-reservation.service";
import { InvoiceService } from "../src/sales/invoice.service";
import { RetailerLedgerService } from "../src/finance/retailer-ledger/retailer-ledger.service";

describe("Warehouse to store transfer lifecycle (real PostgreSQL)", () => {
  let prisma: PrismaService;
  let ledger: InventoryLedgerService;
  let transfers: StockTransferService;
  let invoices: InvoiceService;
  let branchA: string;
  let branchB: string;
  let warehouseA: string;
  let warehouseB: string;
  let sourceLocationId: string;
  let storeLocationId: string;
  let productId: string;
  let unitId: string;
  let userId: string;
  const prefix = `transfer-it-${Date.now()}-${randomUUID().slice(0, 8)}`;

  const dto = (key: string, quantity = 5) => ({
    fromBranchId: branchA,
    fromWarehouseId: warehouseA,
    fromLocationId: sourceLocationId,
    toBranchId: branchB,
    toWarehouseId: warehouseB,
    toLocationId: storeLocationId,
    items: [{ productId, unitId, quantity, baseQuantity: quantity }],
    notes: `transfer-${key}`,
  });

  const balances = async (locationId: string) => {
    const snapshots = await prisma.inventorySnapshot.findMany({
      where: { locationId, productId, unitId },
      select: { stockState: true, baseQuantity: true },
    });
    return new Map(
      snapshots.map((row) => [row.stockState, Number(row.baseQuantity)]),
    );
  };

  const seedWarehouseStock = async () => {
    await ledger.postEvent({
      eventType: "OPENING_STOCK",
      branchId: branchA,
      referenceType: "STOCK_ADJUSTMENT",
      referenceId: `${prefix}-opening-${randomUUID()}`,
      createdById: userId,
      movements: [
        {
          locationId: sourceLocationId,
          productId,
          unitId,
          stockState: "AVAILABLE",
          quantityDelta: 10,
          baseQuantityDelta: 10,
          movementType: "STOCK_IN",
        },
      ],
    });
  };

  const createConfirmedTransfer = async (key: string, quantity = 5) => {
    const transfer = await transfers.create(dto(key, quantity), userId, key);
    return transfers.confirm(transfer.id, userId);
  };

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    ledger = new InventoryLedgerService(prisma);
    transfers = new StockTransferService(
      prisma,
      new AuditLogService(prisma),
      ledger,
    );
    invoices = new InvoiceService(
      prisma,
      new AuditLogService(prisma),
      ledger,
      new RetailerLedgerService(prisma),
      new StockReservationService(prisma, ledger, new AuditLogService(prisma)),
    );

    const [fromBranch, toBranch] = await Promise.all([
      prisma.branch.create({
        data: {
          code: `${prefix}-from`,
          name: "Transfer warehouse branch",
          city: "A",
          district: "A",
        },
      }),
      prisma.branch.create({
        data: {
          code: `${prefix}-to`,
          name: "Transfer store branch",
          city: "B",
          district: "B",
        },
      }),
    ]);
    branchA = fromBranch.id;
    branchB = toBranch.id;
    const user = await prisma.user.create({
      data: {
        fullName: "Transfer integration user",
        phone: `${Date.now()}21`.slice(-10),
        email: `${prefix}@example.test`,
        passwordHash: "test-only",
        status: "ACTIVE",
      },
    });
    userId = user.id;
    const unit = await prisma.unit.create({
      data: { code: `${prefix}-unit`, name: "Piece", symbol: "pc" },
    });
    unitId = unit.id;
    const category = await prisma.category.create({
      data: { code: `${prefix}-category`, name: "Transfer category" },
    });
    const product = await prisma.product.create({
      data: {
        skuCode: `${prefix}-sku`,
        name: "Transfer product",
        categoryId: category.id,
        defaultUnitId: unitId,
        productUnits: {
          create: { unitId, conversionToBase: 1, isBaseUnit: true },
        },
      },
    });
    productId = product.id;
    const warehouse = await prisma.warehouse.create({
      data: {
        branchId: branchA,
        code: `${prefix}-warehouse-a`,
        name: "Origin warehouse",
      },
    });
    warehouseA = warehouse.id;
    const destinationWarehouse = await prisma.warehouse.create({
      data: {
        branchId: branchB,
        code: `${prefix}-warehouse-b`,
        name: "Destination warehouse",
      },
    });
    warehouseB = destinationWarehouse.id;
    sourceLocationId = (
      await prisma.inventoryLocation.create({
        data: {
          branchId: branchA,
          warehouseId: warehouseA,
          code: `${prefix}-source`,
          name: "Origin location",
        },
      })
    ).id;
    storeLocationId = (
      await prisma.inventoryLocation.create({
        data: {
          branchId: branchB,
          code: `${prefix}-store`,
          name: "Destination store",
          type: "STORE",
        },
      })
    ).id;
  });

  beforeEach(async () => {
    delete process.env.STORE_SYNC_WEBHOOK_URL;
    delete process.env.STORE_SYNC_WEBHOOK_SECRET;
    await prisma.invoice.deleteMany({
      where: { branchId: { in: [branchA, branchB] } },
    });
    await prisma.inventoryMovement.deleteMany({
      where: { branchId: { in: [branchA, branchB] } },
    });
    await prisma.inventoryEvent.deleteMany({
      where: { branchId: { in: [branchA, branchB] } },
    });
    await prisma.stockTransfer.deleteMany({
      where: { fromBranchId: { in: [branchA, branchB] } },
    });
    await prisma.inventorySnapshot.deleteMany({
      where: { locationId: { in: [sourceLocationId, storeLocationId] } },
    });
    await prisma.idempotencyRecord.deleteMany({
      where: { key: { startsWith: prefix } },
    });
    await seedWarehouseStock();
  });

  afterAll(async () => {
    await prisma.invoice.deleteMany({
      where: { branchId: { in: [branchA, branchB] } },
    });
    await prisma.inventoryMovement.deleteMany({
      where: { branchId: { in: [branchA, branchB] } },
    });
    await prisma.inventoryEvent.deleteMany({
      where: { branchId: { in: [branchA, branchB] } },
    });
    await prisma.stockTransfer.deleteMany({
      where: { fromBranchId: { in: [branchA, branchB] } },
    });
    await prisma.inventorySnapshot.deleteMany({
      where: { locationId: { in: [sourceLocationId, storeLocationId] } },
    });
    await prisma.idempotencyRecord.deleteMany({
      where: { key: { startsWith: prefix } },
    });
    await prisma.auditLog.deleteMany({ where: { actorUserId: userId } });
    await prisma.inventoryLocation.deleteMany({
      where: { id: { in: [sourceLocationId, storeLocationId] } },
    });
    await prisma.warehouse.deleteMany({
      where: { id: { in: [warehouseA, warehouseB] } },
    });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.category.delete({ where: { code: `${prefix}-category` } });
    await prisma.unit.delete({ where: { id: unitId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.branch.deleteMany({
      where: { id: { in: [branchA, branchB] } },
    });
    await prisma.$disconnect();
  });

  it("creates and confirms a DRAFT transfer", async () => {
    const draft = await transfers.create(
      dto("create"),
      userId,
      `${prefix}-create`,
    );
    expect(draft.status).toBe("DRAFT");
    const confirmed = await transfers.confirm(draft.id, userId);
    expect(confirmed.status).toBe("CONFIRMED");
  });

  it("dispatches once and moves warehouse AVAILABLE to IN_TRANSIT", async () => {
    const transfer = await createConfirmedTransfer(`${prefix}-dispatch`);
    await transfers.dispatch(transfer.id, userId, `${prefix}-dispatch-key`);
    await transfers.dispatch(transfer.id, userId, `${prefix}-dispatch-retry`);
    const source = await balances(sourceLocationId);
    expect(source.get("AVAILABLE")).toBe(5);
    expect(source.get("IN_TRANSIT")).toBe(5);
    expect(
      await prisma.inventoryMovement.count({
        where: { referenceId: transfer.id },
      }),
    ).toBe(2);
  });

  it("rejects reuse of a dispatch key for a different transfer", async () => {
    const first = await createConfirmedTransfer(
      `${prefix}-dispatch-conflict-a`,
    );
    const second = await createConfirmedTransfer(
      `${prefix}-dispatch-conflict-b`,
    );
    const key = `${prefix}-dispatch-conflict-key`;
    await transfers.dispatch(first.id, userId, key);
    await expect(
      transfers.dispatch(second.id, userId, key),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(
      (
        await prisma.stockTransfer.findUniqueOrThrow({
          where: { id: second.id },
        })
      ).status,
    ).toBe("CONFIRMED");
  });

  it("receives once, increases store inventory, and never deducts warehouse again", async () => {
    const transfer = await createConfirmedTransfer(`${prefix}-receive`);
    await transfers.dispatch(transfer.id, userId, `${prefix}-receive-dispatch`);
    await transfers.receive(transfer.id, userId, `${prefix}-receive-key`);
    await transfers.receive(transfer.id, userId, `${prefix}-receive-retry`);
    const source = await balances(sourceLocationId);
    const store = await balances(storeLocationId);
    expect(source.get("AVAILABLE")).toBe(5);
    expect(source.get("IN_TRANSIT") ?? 0).toBe(0);
    expect(store.get("AVAILABLE")).toBe(5);
    expect(
      await prisma.inventoryMovement.count({
        where: { referenceId: transfer.id },
      }),
    ).toBe(4);
    expect(
      (
        await prisma.stockTransfer.findUniqueOrThrow({
          where: { id: transfer.id },
        })
      ).status,
    ).toBe("RECEIVED");
  });

  it("proves warehouse to store to POS flow with concurrent replays", async () => {
    await ledger.postEvent({
      eventType: "OPENING_STOCK",
      branchId: branchA,
      referenceType: "STOCK_ADJUSTMENT",
      referenceId: `${prefix}-flow-opening-${randomUUID()}`,
      createdById: userId,
      movements: [
        {
          locationId: sourceLocationId,
          productId,
          unitId,
          stockState: "AVAILABLE",
          quantityDelta: 90,
          baseQuantityDelta: 90,
          movementType: "STOCK_IN",
        },
      ],
    });

    const transfer = await createConfirmedTransfer(`${prefix}-flow`, 10);
    await Promise.all([
      transfers.dispatch(transfer.id, userId, `${prefix}-flow-dispatch`),
      transfers.dispatch(transfer.id, userId, `${prefix}-flow-dispatch`),
    ]);
    expect((await balances(sourceLocationId)).get("AVAILABLE")).toBe(90);
    expect((await balances(sourceLocationId)).get("IN_TRANSIT")).toBe(10);
    expect(
      (
        await prisma.stockTransfer.findUniqueOrThrow({
          where: { id: transfer.id },
        })
      ).status,
    ).toBe("IN_TRANSIT");

    await Promise.all([
      transfers.receive(transfer.id, userId, `${prefix}-flow-receive`),
      transfers.receive(transfer.id, userId, `${prefix}-flow-receive`),
    ]);
    expect((await balances(sourceLocationId)).get("AVAILABLE")).toBe(90);
    expect((await balances(storeLocationId)).get("AVAILABLE")).toBe(10);
    expect(
      (
        await prisma.stockTransfer.findUniqueOrThrow({
          where: { id: transfer.id },
        })
      ).status,
    ).toBe("RECEIVED");

    const invoice = await invoices.create(
      {
        branchId: branchB,
        warehouseId: warehouseB,
        sourceLocationId: storeLocationId,
        items: [
          {
            productId,
            unitId,
            quantity: 3,
            baseQuantity: 3,
            unitPrice: 10,
          },
        ],
      },
      userId,
    );
    await Promise.all([
      invoices.post(invoice.id, userId),
      invoices.post(invoice.id, userId),
    ]);

    expect((await balances(sourceLocationId)).get("AVAILABLE")).toBe(90);
    expect((await balances(storeLocationId)).get("AVAILABLE")).toBe(7);
    expect(
      await prisma.inventoryMovement.count({
        where: { referenceId: transfer.id },
      }),
    ).toBe(4);
    expect(
      await prisma.inventoryMovement.count({
        where: { referenceId: invoice.id },
      }),
    ).toBe(1);
    expect(
      await prisma.inventoryMovement.count({
        where: { referenceId: invoice.id, movementType: "SALE_DEDUCTION" },
      }),
    ).toBe(1);
    expect(
      await prisma.inventoryEvent.count({
        where: { referenceId: transfer.id, eventType: "STOCK_TRANSFER" },
      }),
    ).toBe(4);
    expect(
      (await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } }))
        .status,
    ).toBe("POSTED");

    await expect(
      invoices.create(
        {
          branchId: branchB,
          warehouseId: warehouseA,
          sourceLocationId: storeLocationId,
          items: [
            { productId, unitId, quantity: 1, baseQuantity: 1, unitPrice: 10 },
          ],
        },
        userId,
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it("rolls back dispatch state and inventory when the ledger fails", async () => {
    const transfer = await createConfirmedTransfer(`${prefix}-rollback`);
    const original = ledger.postEvent.bind(ledger);
    const spy = jest
      .spyOn(ledger, "postEvent")
      .mockImplementation(async (...args: any[]) => {
        await original(...args);
        throw new Error("forced transfer ledger failure");
      });
    await expect(
      transfers.dispatch(transfer.id, userId, `${prefix}-rollback-key`),
    ).rejects.toThrow("forced transfer ledger failure");
    spy.mockRestore();
    expect(
      (
        await prisma.stockTransfer.findUniqueOrThrow({
          where: { id: transfer.id },
        })
      ).status,
    ).toBe("CONFIRMED");
    const source = await balances(sourceLocationId);
    expect(source.get("AVAILABLE")).toBe(10);
    expect(source.get("IN_TRANSIT") ?? 0).toBe(0);
    expect(
      await prisma.inventoryMovement.count({
        where: { referenceId: transfer.id },
      }),
    ).toBe(0);
  });

  it("replays transfer creation and rejects a conflicting creation key", async () => {
    const key = `${prefix}-create-replay`;
    const first = await transfers.create(dto("same"), userId, key);
    const second = await transfers.create(dto("same"), userId, key);
    expect(second.id).toBe(first.id);
    expect(await prisma.stockTransfer.count({ where: { id: first.id } })).toBe(
      1,
    );
    await expect(
      transfers.create(
        {
          ...dto("different"),
          items: [{ productId, unitId, quantity: 4, baseQuantity: 4 }],
        },
        userId,
        key,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(
      await prisma.stockTransfer.count({ where: { fromBranchId: branchA } }),
    ).toBe(1);
  });

  it("rejects mismatched warehouse and store endpoints server-side", async () => {
    await expect(
      transfers.create(
        {
          ...dto("mismatch"),
          toWarehouseId: warehouseA,
        },
        userId,
        `${prefix}-mismatch`,
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(
      await prisma.stockTransfer.count({ where: { fromBranchId: branchA } }),
    ).toBe(0);
  });

  it("persists pending sync after webhook failure and retries without duplicating store stock", async () => {
    process.env.STORE_SYNC_WEBHOOK_URL =
      "https://ceo-dashboard.test/api/sync/inbound-transfers";
    process.env.STORE_SYNC_WEBHOOK_SECRET = "integration-secret";
    const transfer = await createConfirmedTransfer(`${prefix}-sync`);
    await transfers.dispatch(transfer.id, userId, `${prefix}-sync-dispatch`);
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockRejectedValueOnce(new Error("dashboard unavailable"))
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);
    await expect(
      transfers.receive(transfer.id, userId, `${prefix}-sync-receive`),
    ).rejects.toMatchObject({ statusCode: 502 });
    const pending = await prisma.inventoryEvent.findUniqueOrThrow({
      where: { idempotencyKey: `store-sync-${transfer.id}` },
    });
    expect((pending.metadata as any).status).toBe("PENDING");
    expect((pending.metadata as any).payload.eventId).toBe(pending.id);
    expect((pending.metadata as any).payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect((await balances(storeLocationId)).get("AVAILABLE")).toBe(5);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: expect.objectContaining({
        "x-pasalo-webhook-secret": "integration-secret",
        "x-event-id": pending.id,
        "x-payload-sha256": (pending.metadata as any).payloadHash,
      }),
    });
    expect(
      createHash("sha256")
        .update(String(fetchMock.mock.calls[0][1]?.body))
        .digest("hex"),
    ).toBe((pending.metadata as any).payloadHash);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      eventId: pending.id,
      occurredAt: expect.any(String),
      items: [{ quantity: 5 }],
    });
    await transfers.retryStoreSync(transfer.id, userId);
    const sent = await prisma.inventoryEvent.findUniqueOrThrow({
      where: { id: pending.id },
    });
    expect(sent.eventStatus).toBe("POSTED");
    expect((await balances(storeLocationId)).get("AVAILABLE")).toBe(5);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]?.body).toBe(fetchMock.mock.calls[0][1]?.body);
    await expect(transfers.retryStoreSync(transfer.id, userId)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRestore();
  });

  it("moves exactly 10 of 100 warehouse units through dispatch and receive", async () => {
    await ledger.postEvent({
      eventType: "OPENING_STOCK",
      branchId: branchA,
      referenceType: "STOCK_ADJUSTMENT",
      referenceId: `${prefix}-opening-extra-90`,
      createdById: userId,
      idempotencyKey: `${prefix}-opening-extra-90`,
      movements: [{
        locationId: sourceLocationId,
        productId,
        unitId,
        stockState: "AVAILABLE",
        quantityDelta: 90,
        baseQuantityDelta: 90,
        movementType: "STOCK_IN",
      }],
    });
    process.env.STORE_SYNC_WEBHOOK_URL = "https://ceo-dashboard.test/api/sync/inbound-transfers";
    process.env.STORE_SYNC_WEBHOOK_SECRET = "integration-secret";
    const transfer = await createConfirmedTransfer(`${prefix}-hundred-flow`, 10);
    const fetchMock = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce({ ok: true, status: 201 } as Response);
    await transfers.dispatch(transfer.id, userId, `${prefix}-hundred-dispatch`);
    expect((await balances(sourceLocationId)).get("AVAILABLE")).toBe(90);
    expect((await balances(sourceLocationId)).get("IN_TRANSIT")).toBe(10);
    await transfers.receive(transfer.id, userId, `${prefix}-hundred-receive`);
    expect((await balances(storeLocationId)).get("AVAILABLE")).toBe(10);
    expect((await balances(sourceLocationId)).get("AVAILABLE")).toBe(90);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).items).toEqual([{ productId, quantity: 10 }]);
    await transfers.receive(transfer.id, userId, `${prefix}-hundred-receive-replay`);
    expect((await balances(storeLocationId)).get("AVAILABLE")).toBe(10);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRestore();
  });

  it("sends the actual received quantity rather than the dispatched quantity", async () => {
    const transfer = await createConfirmedTransfer(`${prefix}-variance`, 5);
    await transfers.dispatch(
      transfer.id,
      userId,
      `${prefix}-variance-dispatch`,
    );
    await prisma.stockTransferItem.updateMany({
      where: { stockTransferId: transfer.id },
      data: { receivedQuantity: 3, receivedBaseQuantity: 3 },
    });
    await transfers.receive(transfer.id, userId, `${prefix}-variance-receive`);
    process.env.STORE_SYNC_WEBHOOK_URL =
      "https://ceo-dashboard.test/api/sync/inbound-transfers";
    process.env.STORE_SYNC_WEBHOOK_SECRET = "integration-secret";
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({ ok: true, status: 201 } as Response);
    await transfers.retryStoreSync(transfer.id, userId);
    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(payload.items).toEqual([{ productId, quantity: 3 }]);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      "x-payload-sha256": createHash("sha256")
        .update(String(fetchMock.mock.calls[0][1]?.body))
        .digest("hex"),
    });
    expect((await balances(storeLocationId)).get("AVAILABLE")).toBe(3);
    fetchMock.mockRestore();
  });
});
