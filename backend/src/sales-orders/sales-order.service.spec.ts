import { SalesOrderService } from "./sales-order.service";
import { AppError } from "../common/errors/app-error";

const dto = {
  branchId: "branch-1",
  salesRepId: "rep-1",
  routeId: "route-1",
  retailerId: "retailer-1",
  channel: "SALES_REP",
  idempotencyKey: "key-1",
  items: [
    {
      productId: "product-1",
      unitId: "unit-1",
      quantity: 2,
    },
  ],
};

function makeService(overrides: Record<string, any> = {}) {
  const tx: any = {
    branch: { findUnique: jest.fn().mockResolvedValue({ id: "branch-1" }) },
    salesRep: {
      findUnique: jest
        .fn()
        .mockResolvedValue({
          id: "rep-1",
          branchId: "branch-1",
          userId: "actor-1",
          status: "ACTIVE",
        }),
    },
    retailer: {
      findUnique: jest
        .fn()
        .mockResolvedValue({
          id: "retailer-1",
          branchId: "branch-1",
          status: "ACTIVE",
        }),
    },
    route: {
      findUnique: jest
        .fn()
        .mockResolvedValue({
          id: "route-1",
          branchId: "branch-1",
          salesRepId: "rep-1",
          status: "ACTIVE",
        }),
    },
    inventoryLocation: {
      findFirst: jest.fn().mockResolvedValue({ id: "location-1" }),
    },
    routeStop: { findUnique: jest.fn().mockResolvedValue({ id: "stop-1" }) },
    product: {
      findUnique: jest
        .fn()
        .mockResolvedValue({
          id: "product-1",
          name: "Product",
          isActive: true,
          sellingPrice: 25,
          productUnits: [{ unitId: "unit-1", conversionToBase: 12 }],
        }),
    },
    batch: { findUnique: jest.fn() },
    retailerLedgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
    idempotencyRecord: {
      findUnique: jest.fn().mockResolvedValue(null),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "idem-1" }),
      create: jest.fn(),
      update: jest.fn(),
    },
    salesOrder: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: "order-1", orderNo: "ORD-1" }),
      create: jest.fn().mockResolvedValue({ id: "order-1", orderNo: "ORD-1" }),
    },
    salesOrderItem: {
      create: jest.fn().mockResolvedValue({ id: "order-item-1" }),
    },
    stockReservation: {
      create: jest.fn().mockResolvedValue({ id: "reservation-1" }),
    },
    stockReservationItem: { create: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([{ creditLimit: 1000 }]),
  };
  const prisma: any = { $transaction: jest.fn((callback) => callback(tx)) };
  const reservation: any = { reserveStock: jest.fn().mockResolvedValue({}) };
  const audit: any = { record: jest.fn() };
  const invoice: any = {};
  const service = new SalesOrderService(prisma, audit, invoice, reservation);
  jest.spyOn(service, "findById").mockResolvedValue({ id: "order-1" } as any);
  return { service, tx, reservation };
}

describe("SalesOrderService.create", () => {
  it("ignores client price and base quantity and reserves database-derived amounts", async () => {
    const { service, tx, reservation } = makeService();

    await service.create(dto as any, "actor-1", "key-1");

    expect(tx.salesOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotal: 50,
          grandTotal: 50,
          idempotencyKey: "key-1",
        }),
      }),
    );
    expect(tx.salesOrderItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unitPrice: 25,
          baseQuantity: 24,
          lineTotal: 50,
          discountAmount: 0,
          taxAmount: 0,
        }),
      }),
    );
    expect(reservation.reserveStock).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 2, baseQuantity: 24 }),
      tx,
      false,
    );
  });

  it("rejects inactive products before creating an order", async () => {
    const { service, tx } = makeService();
    tx.product.findUnique.mockResolvedValue({
      id: "product-1",
      isActive: false,
      productUnits: [],
    });

    await expect(service.create(dto as any, "actor-1")).rejects.toBeInstanceOf(
      AppError,
    );
    expect(tx.salesOrder.create).not.toHaveBeenCalled();
  });

  it("rejects orders that exceed available retailer credit", async () => {
    const { service, tx } = makeService();
    tx.$queryRaw.mockResolvedValue([{ creditLimit: 10 }]);

    await expect(service.create(dto as any, "actor-1")).rejects.toThrow(
      "exceeds available credit",
    );
    expect(tx.salesOrder.create).not.toHaveBeenCalled();
  });

  it("returns the original order for a repeated idempotency key", async () => {
    const { service, tx, reservation } = makeService();
    await service.create(
      { ...dto, idempotencyKey: "same-key" } as any,
      "actor-1",
      "same-key",
    );
    const requestHash =
      tx.idempotencyRecord.create.mock.calls[0][0].data.requestHash;
    tx.idempotencyRecord.findUnique.mockResolvedValue({
      requestHash,
      status: "COMPLETED",
      resourceId: "original-order",
    });
    tx.salesOrder.findUnique.mockResolvedValue({ id: "original-order" });

    await expect(
      service.create(
        { ...dto, idempotencyKey: "same-key" } as any,
        "actor-1",
        "same-key",
      ),
    ).resolves.toEqual({ id: "order-1" });
    expect(tx.salesOrder.create).toHaveBeenCalledTimes(1);
    expect(reservation.reserveStock).toHaveBeenCalledTimes(1);
  });

  it("propagates insufficient available stock and rolls back order creation", async () => {
    const { service, tx, reservation } = makeService();
    reservation.reserveStock.mockRejectedValue(
      new AppError("INSUFFICIENT_STOCK", "Insufficient available stock.", 422),
    );

    await expect(service.create(dto as any, "actor-1")).rejects.toThrow(
      "Insufficient available stock",
    );
    expect(tx.salesOrder.create).toHaveBeenCalled();
  });

  it("rejects a changed payload for a reused idempotency key", async () => {
    const { service, tx } = makeService();
    tx.idempotencyRecord.findUnique.mockResolvedValue({
      requestHash: "different-request",
      status: "COMPLETED",
      resourceId: "order-1",
    });

    await expect(
      service.create(dto as any, "actor-1", "key-1"),
    ).rejects.toThrow("different request");
  });
});

describe("SalesOrderService.cancel", () => {
  function makeCancelService() {
    const tx: any = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([
          { id: "order-1", status: "CONFIRMED", branchId: "branch-1" },
        ]),
      stockReservation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "reservation-1",
            locationId: "location-1",
            items: [
              {
                productId: "product-1",
                batchId: null,
                unitId: "unit-1",
                quantity: 6,
                baseQuantity: 6,
              },
            ],
          },
        ]),
        update: jest.fn(),
      },
      salesOrder: { update: jest.fn() },
    };
    const prisma: any = {
      $transaction: jest.fn((callback: any) => callback(tx)),
    };
    const audit: any = { record: jest.fn() };
    const reservation: any = {
      releaseStock: jest.fn().mockResolvedValue({ releasedBaseQty: 6 }),
    };
    const service = new SalesOrderService(
      prisma,
      audit,
      {} as any,
      reservation,
    );
    jest
      .spyOn(service, "findById")
      .mockResolvedValue({ id: "order-1", status: "CANCELLED" } as any);
    return { service, tx, reservation };
  }

  it("releases active reservation lines atomically when cancelling an order", async () => {
    const { service, tx, reservation } = makeCancelService();

    await service.cancel("order-1", "actor-1");

    expect(reservation.releaseStock).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceId: "order-1",
        baseQuantity: 6,
      }),
      tx,
      false,
    );
    expect(tx.stockReservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RELEASED" }),
      }),
    );
    expect(tx.salesOrder.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: "CANCELLED" },
    });
  });

  it("does not release stock when cancellation is retried", async () => {
    const { service, tx, reservation } = makeCancelService();
    tx.$queryRaw
      .mockResolvedValueOnce([
        { id: "order-1", status: "CONFIRMED", branchId: "branch-1" },
      ])
      .mockResolvedValueOnce([
        { id: "order-1", status: "CANCELLED", branchId: "branch-1" },
      ]);

    await service.cancel("order-1", "actor-1");
    await service.cancel("order-1", "actor-1");

    expect(reservation.releaseStock).toHaveBeenCalledTimes(1);
  });
});
