import { randomUUID } from "crypto";
import { PrismaService } from "../src/database/prisma.service";
import { AuditLogService } from "../src/audit/audit-log.service";
import { RetailerLedgerService } from "../src/finance/retailer-ledger/retailer-ledger.service";
import { PaymentService } from "../src/sales/payment.service";
import { AppError } from "../src/common/errors/app-error";

describe("Payment idempotency and atomicity (real PostgreSQL)", () => {
  let prisma: PrismaService;
  let service: PaymentService;
  let ledger: RetailerLedgerService;
  let branchId: string;
  let otherBranchId: string;
  let userId: string;
  let warehouseId: string;
  let locationId: string;
  let retailerId: string;
  let invoiceId: string;
  const prefix = `payment-it-${Date.now()}-${randomUUID().slice(0, 8)}`;

  const payment = (key: string, amount: number, overrides: Record<string, string> = {}) => ({
    branchId: overrides.branchId ?? branchId,
    retailerId: overrides.retailerId ?? retailerId,
    invoiceId: overrides.invoiceId ?? invoiceId,
    amount,
    method: "CASH" as const,
    referenceNumber: `${prefix}-${key}`,
  });

  const createInvoice = async (amount = 100) => {
    const invoice = await prisma.invoice.create({
      data: {
        branchId,
        invoiceNumber: `${prefix}-invoice-${randomUUID()}`,
        retailerId,
        warehouseId,
        sourceLocationId: locationId,
        grandTotal: amount,
        dueAmount: amount,
        createdById: userId,
        status: "CREDIT_OPEN",
      },
    });
    return invoice.id;
  };

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const audit = new AuditLogService(prisma);
    ledger = new RetailerLedgerService(prisma);
    service = new PaymentService(prisma, audit, ledger);

    const [branch, otherBranch] = await Promise.all([
      prisma.branch.create({ data: { code: `${prefix}-branch`, name: "Payment branch", city: "A", district: "A" } }),
      prisma.branch.create({ data: { code: `${prefix}-other`, name: "Other branch", city: "B", district: "B" } }),
    ]);
    branchId = branch.id;
    otherBranchId = otherBranch.id;
    const user = await prisma.user.create({
      data: {
        fullName: "Payment integration user",
        phone: `${Date.now()}11`.slice(-10),
        email: `${prefix}@example.test`,
        passwordHash: "test-only",
        status: "ACTIVE",
      },
    });
    userId = user.id;
    const warehouse = await prisma.warehouse.create({
      data: { branchId, code: `${prefix}-warehouse`, name: "Payment warehouse" },
    });
    warehouseId = warehouse.id;
    const location = await prisma.inventoryLocation.create({
      data: { branchId, warehouseId, code: `${prefix}-location`, name: "Payment location" },
    });
    locationId = location.id;
    const retailer = await prisma.retailer.create({
      data: {
        branchId,
        code: `${prefix}-retailer`,
        shopName: "Payment retailer",
        ownerName: "Payment owner",
        phone: `${Date.now()}12`.slice(-10),
        creditLimit: 10000,
        createdById: userId,
      },
    });
    retailerId = retailer.id;
    invoiceId = await createInvoice();
  });

  afterEach(async () => {
    await prisma.retailerLedgerEntry.deleteMany({ where: { branchId: { in: [branchId, otherBranchId] } } });
    await prisma.payment.deleteMany({ where: { branchId: { in: [branchId, otherBranchId] } } });
    await prisma.invoice.deleteMany({ where: { branchId: { in: [branchId, otherBranchId] } } });
    await prisma.idempotencyRecord.deleteMany({ where: { scope: "payment.create", key: { startsWith: prefix } } });
    invoiceId = await createInvoice();
  });

  afterAll(async () => {
    await prisma.retailerLedgerEntry.deleteMany({ where: { branchId: { in: [branchId, otherBranchId] } } });
    await prisma.payment.deleteMany({ where: { branchId: { in: [branchId, otherBranchId] } } });
    await prisma.invoice.deleteMany({ where: { branchId: { in: [branchId, otherBranchId] } } });
    await prisma.idempotencyRecord.deleteMany({ where: { scope: "payment.create", key: { startsWith: prefix } } });
    await prisma.retailer.delete({ where: { id: retailerId } });
    await prisma.inventoryLocation.delete({ where: { id: locationId } });
    await prisma.warehouse.delete({ where: { id: warehouseId } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.branch.deleteMany({ where: { id: { in: [branchId, otherBranchId] } } });
    await prisma.$disconnect();
  });

  it("creates a partial payment and updates invoice and ledger once", async () => {
    const result = await service.create(payment("partial", 40), userId, `${prefix}-partial`);
    const [stored, invoice, entries] = await Promise.all([
      prisma.payment.findUnique({ where: { id: result.id } }),
      prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } }),
      prisma.retailerLedgerEntry.findMany({ where: { referenceId: result.id } }),
    ]);
    expect(stored).not.toBeNull();
    expect(Number(invoice.paidAmount)).toBe(40);
    expect(Number(invoice.dueAmount)).toBe(60);
    expect(invoice.paymentStatus).toBe("PARTIALLY_PAID");
    expect(entries).toHaveLength(1);
  });

  it("creates a full payment and marks the invoice paid", async () => {
    const result = await service.create(payment("full", 100), userId, `${prefix}-full`);
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(result.id).toBeDefined();
    expect(Number(invoice.paidAmount)).toBe(100);
    expect(Number(invoice.dueAmount)).toBe(0);
    expect(invoice.paymentStatus).toBe("PAID");
    expect(invoice.status).toBe("PAID");
  });

  it("replays the same request without duplicating financial state", async () => {
    const key = `${prefix}-replay`;
    const input = payment("replay", 25);
    const first = await service.create(input, userId, key);
    const second = await service.create(input, userId, key);
    expect(second.id).toBe(first.id);
    expect(await prisma.payment.count({ where: { invoiceId } })).toBe(1);
    expect(await prisma.retailerLedgerEntry.count({ where: { referenceId: first.id } })).toBe(1);
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(Number(invoice.paidAmount)).toBe(25);
    expect(await prisma.idempotencyRecord.count({ where: { scope: "payment.create", key } })).toBe(1);
  });

  it("rejects a conflicting idempotency key without changing financial state", async () => {
    const key = `${prefix}-conflict`;
    await service.create(payment("conflict", 25), userId, key);
    await expect(service.create(payment("conflict", 30), userId, key)).rejects.toMatchObject({ statusCode: 409 });
    expect(await prisma.payment.count({ where: { invoiceId } })).toBe(1);
    expect(await prisma.retailerLedgerEntry.count({ where: { branchId } })).toBe(1);
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(Number(invoice.paidAmount)).toBe(25);
  });

  it("rolls back payment, ledger, and invoice changes when ledger creation fails", async () => {
    const key = `${prefix}-rollback`;
    const original = ledger.createPaymentCredit.bind(ledger);
    const spy = jest.spyOn(ledger, "createPaymentCredit").mockImplementation(async (...args: any[]) => {
      await original(...args);
      throw new Error("forced payment ledger failure");
    });
    await expect(service.create(payment("rollback", 40), userId, key)).rejects.toThrow("forced payment ledger failure");
    spy.mockRestore();
    expect(await prisma.payment.count({ where: { invoiceId } })).toBe(0);
    expect(await prisma.retailerLedgerEntry.count({ where: { branchId } })).toBe(0);
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(Number(invoice.paidAmount)).toBe(0);
    expect(invoice.paymentStatus).toBe("UNPAID");
    expect(invoice.status).toBe("CREDIT_OPEN");
    expect(await prisma.idempotencyRecord.findUnique({ where: { scope_key: { scope: "payment.create", key } } })).toBeNull();
  });

  it("rejects a payment for an invoice owned by another branch", async () => {
    await expect(service.create(
      payment("cross-branch", 10, { branchId: otherBranchId }),
      userId,
      `${prefix}-cross-branch`,
    )).rejects.toMatchObject({ statusCode: 403 });
    expect(await prisma.payment.count({ where: { invoiceId } })).toBe(0);
  });

  it("serializes concurrent retries under the same idempotency key", async () => {
    const key = `${prefix}-concurrent`;
    const input = payment("concurrent", 35);
    const results = await Promise.allSettled([
      service.create(input, userId, key),
      service.create(input, userId, key),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled") as PromiseFulfilledResult<any>[];
    expect(fulfilled).toHaveLength(2);
    expect(fulfilled[0].value.id).toBe(fulfilled[1].value.id);
    expect(await prisma.payment.count({ where: { invoiceId } })).toBe(1);
    expect(await prisma.retailerLedgerEntry.count({ where: { branchId } })).toBe(1);
    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(Number(invoice.paidAmount)).toBe(35);
  });
});
