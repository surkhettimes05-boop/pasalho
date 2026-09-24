import { randomUUID } from "crypto";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../src/database/prisma.service";
import { ScopeGuard } from "../src/auth/scope.guard";

describe("Authorization scope enforcement (real PostgreSQL)", () => {
  let prisma: PrismaService;
  let guard: ScopeGuard;
  let branchA: string;
  let branchB: string;
  let warehouseA: string;
  let warehouseB: string;
  let storeB: string;
  let warehouseLocationB: string;
  let actorId: string;
  let otherUserId: string;
  let retailerB: string;
  let salesRepB: string;
  let orderB: string;
  let transferB: string;
  let invoiceB: string;
  let paymentB: string;
  let roleId: string;
  const prefix = `scope-it-${Date.now()}-${randomUUID().slice(0, 8)}`;

  const context = (scope: any, request: any) => ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ ...request, user: { userId: actorId } }) }),
  } as any);

  const allows = (scope: any, request: any) =>
    guard.canActivate(context(scope, request));

  const denies = async (scope: any, request: any) => {
    await expect(allows(scope, request)).rejects.toMatchObject({ statusCode: 403 });
  };

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    guard = new ScopeGuard(
      { getAllAndOverride: (key: string) => key === "scope_type" ? undefined : undefined } as any,
      prisma,
    );

    const [a, b] = await Promise.all([
      prisma.branch.create({ data: { code: `${prefix}-a`, name: "Scope A", city: "A", district: "A" } }),
      prisma.branch.create({ data: { code: `${prefix}-b`, name: "Scope B", city: "B", district: "B" } }),
    ]);
    branchA = a.id;
    branchB = b.id;

    const actor = await prisma.user.create({
      data: {
        fullName: "Scoped actor",
        phone: `${Date.now()}01`.slice(-10),
        email: `${prefix}-actor@example.test`,
        passwordHash: "test-only",
        status: "ACTIVE",
      },
    });
    actorId = actor.id;
    const otherUser = await prisma.user.create({
      data: {
        fullName: "Other actor",
        phone: `${Date.now()}02`.slice(-10),
        email: `${prefix}-other@example.test`,
        passwordHash: "test-only",
        status: "ACTIVE",
      },
    });
    otherUserId = otherUser.id;

    const role = await prisma.role.create({
      data: { code: `${prefix}-role`, name: "Scoped role" },
    });
    roleId = role.id;
    await prisma.userRole.create({
      data: { userId: actorId, roleId, branchId: branchA },
    });

    const [whA, whB] = await Promise.all([
      prisma.warehouse.create({ data: { branchId: branchA, code: `${prefix}-wh-a`, name: "Warehouse A" } }),
      prisma.warehouse.create({ data: { branchId: branchB, code: `${prefix}-wh-b`, name: "Warehouse B" } }),
    ]);
    warehouseA = whA.id;
    warehouseB = whB.id;
    warehouseLocationB = (await prisma.inventoryLocation.create({
      data: { branchId: branchB, warehouseId: warehouseB, code: `${prefix}-loc-b`, name: "Warehouse location B" },
    })).id;
    storeB = (await prisma.inventoryLocation.create({
      data: { branchId: branchB, code: `${prefix}-store-b`, name: "Store B", type: "STORE" },
    })).id;

    retailerB = (await prisma.retailer.create({
      data: {
        branchId: branchB,
        code: `${prefix}-retailer-b`,
        shopName: "Store B retailer",
        ownerName: "Owner B",
        phone: `${Date.now()}03`.slice(-10),
        createdById: actorId,
      },
    })).id;
    salesRepB = (await prisma.salesRep.create({
      data: {
        branchId: branchB,
        userId: otherUserId,
        employeeCode: `${prefix}-rep-b`,
        createdById: actorId,
      },
    })).id;
    orderB = (await prisma.salesOrder.create({
      data: {
        orderNo: `${prefix}-order-b`,
        branchId: branchB,
        createdById: actorId,
      },
    })).id;
    transferB = (await prisma.stockTransfer.create({
      data: {
        transferNo: `${prefix}-transfer-b`,
        fromBranchId: branchB,
        fromWarehouseId: warehouseB,
        fromLocationId: warehouseLocationB,
        toBranchId: branchB,
        toWarehouseId: warehouseB,
        toLocationId: warehouseLocationB,
        createdById: actorId,
      },
    })).id;
    invoiceB = (await prisma.invoice.create({
      data: {
        branchId: branchB,
        invoiceNumber: `${prefix}-invoice-b`,
        warehouseId: warehouseB,
        sourceLocationId: warehouseLocationB,
        createdById: actorId,
      },
    })).id;
    paymentB = (await prisma.payment.create({
      data: {
        branchId: branchB,
        paymentNumber: `${prefix}-payment-b`,
        amount: 1,
        method: "CASH",
        receivedById: actorId,
      },
    })).id;
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { id: paymentB } });
    await prisma.invoice.deleteMany({ where: { id: invoiceB } });
    await prisma.stockTransfer.deleteMany({ where: { id: transferB } });
    await prisma.salesOrder.deleteMany({ where: { id: orderB } });
    await prisma.salesRep.deleteMany({ where: { id: salesRepB } });
    await prisma.retailer.deleteMany({ where: { id: retailerB } });
    await prisma.inventoryLocation.deleteMany({ where: { id: { in: [storeB, warehouseLocationB] } } });
    await prisma.warehouse.deleteMany({ where: { id: { in: [warehouseA, warehouseB] } } });
    await prisma.userRole.deleteMany({ where: { roleId } });
    await prisma.role.delete({ where: { id: roleId } });
    await prisma.user.deleteMany({ where: { id: { in: [actorId, otherUserId] } } });
    await prisma.branch.deleteMany({ where: { id: { in: [branchA, branchB] } } });
    await prisma.$disconnect();
  });

  it("allows assigned branch resources and denies cross-branch ID substitution", async () => {
    guard = new ScopeGuard(
      { getAllAndOverride: () => "branch" } as any,
      prisma,
    );
    await expect(allows("branch", { params: { id: branchA } })).resolves.toBe(true);
    await denies("branch", { params: { id: branchB } });
    await denies("branch", { body: { branchId: branchB } });
  });

  it("denies cross-branch access to resource IDs", async () => {
    const cases = [
      ["warehouse", warehouseB, "warehouse"],
      ["store", storeB, "store"],
      ["sales representative", salesRepB, "sales-rep"],
      ["retailer", retailerB, "retailer"],
      ["sales order", orderB, "order"],
      ["stock transfer", transferB, "transfer"],
      ["invoice", invoiceB, "invoice"],
      ["payment", paymentB, "payment"],
    ] as const;
    for (const [_label, id, scope] of cases) {
      guard = new ScopeGuard({ getAllAndOverride: () => scope } as any, prisma);
      await denies(scope, { params: { id } });
    }
  });

  it("denies cross-branch creation payloads for warehouse, store, sales-rep, invoice, payment, and transfer", async () => {
    const cases = [
      ["branch", { body: { branchId: branchB } }],
      ["store", { body: { branchId: branchB } }],
      ["sales-rep", { body: { branchId: branchB } }],
      ["invoice", { body: { branchId: branchB, warehouseId: warehouseB } }],
      ["payment", { body: { branchId: branchB } }],
      ["payment", { body: { branchId: branchA, invoiceId: invoiceB } }],
      ["transfer", { body: {
        fromBranchId: branchB,
        fromWarehouseId: warehouseB,
        toBranchId: branchB,
        toWarehouseId: warehouseB,
      } }],
    ];
    for (const [scope, request] of cases) {
      guard = new ScopeGuard({ getAllAndOverride: () => scope } as any, prisma);
      await denies(scope, request);
    }
  });

  it("uses a real PostgreSQL role assignment rather than trusting the request user scope", async () => {
    await prisma.userRole.updateMany({
      where: { userId: actorId },
      data: { branchId: null, warehouseId: warehouseA },
    });
    guard = new ScopeGuard({ getAllAndOverride: () => "warehouse" } as any, prisma);
    await expect(allows("warehouse", { params: { id: warehouseA } })).resolves.toBe(true);
    await denies("warehouse", { params: { id: warehouseB } });
  });
});
