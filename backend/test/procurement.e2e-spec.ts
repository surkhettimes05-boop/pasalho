import { randomUUID } from 'crypto';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../src/database/prisma.service';
import { AuditLogService } from '../src/audit/audit-log.service';
import { InventoryLedgerService } from '../src/inventory/services/inventory-ledger.service';
import { ProcurementService } from '../src/procurement/procurement.service';
import { ScopeGuard } from '../src/auth/scope.guard';
import { AppError } from '../src/common/errors/app-error';

describe('Procurement and warehouse goods receiving (real PostgreSQL)', () => {
  let prisma: PrismaService;
  let ledger: InventoryLedgerService;
  let audit: AuditLogService;
  let procurement: ProcurementService;
  let branchId: string;
  let warehouseId: string;
  let locationId: string;
  let supplierId: string;
  let userId: string;
  let productId: string;
  let productUnitId: string;
  let unitId: string;
  const prefix = `procurement-it-${Date.now()}-${randomUUID().slice(0, 8)}`;

  const createPo = async (qty = 100) => {
    const po = await procurement.createPurchaseOrder({
      supplierId,
      warehouseId,
      items: [{ productId, productUnitId, orderedQuantity: qty, unitCost: 80 }],
    }, userId);
    return procurement.confirmPurchaseOrder(po.id, userId);
  };
  const line = (po: any, qty: number) => ({
    purchaseOrderItemId: po.items[0].id,
    receivedQuantity: qty,
    acceptedQuantity: qty,
  });
  const stock = async () => {
    const result = await prisma.inventorySnapshot.findFirst({ where: { locationId, productId, batchId: null, stockState: 'AVAILABLE', unitId } });
    return Number(result?.baseQuantity ?? 0);
  };
  const receive = (po: any, qty: number, key: string, service = procurement) =>
    service.receiveGoods(po.id, { items: [line(po, qty)] }, key, userId);

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    ledger = new InventoryLedgerService(prisma);
    audit = new AuditLogService(prisma);
    procurement = new ProcurementService(prisma, ledger, audit);
    const branch = await prisma.branch.create({ data: { code: `${prefix}-branch`, name: 'Procurement Test Branch', city: 'Test', district: 'Test' } });
    branchId = branch.id;
    const user = await prisma.user.create({ data: { fullName: 'Procurement Integration User', phone: `${Date.now()}31`.slice(-10), email: `${prefix}@example.test`, passwordHash: 'test-only', status: 'ACTIVE' } });
    userId = user.id;
    const unit = await prisma.unit.create({ data: { code: `${prefix}-unit`, name: 'Piece', symbol: 'pc' } });
    unitId = unit.id;
    const category = await prisma.category.create({ data: { code: `${prefix}-category`, name: 'Procurement Test' } });
    const product = await prisma.product.create({ data: { skuCode: `${prefix}-coke`, name: 'COKE-500', categoryId: category.id, defaultUnitId: unitId, isBatchTracked: false, productUnits: { create: { unitId, conversionToBase: 1, isBaseUnit: true } } } });
    productId = product.id;
    productUnitId = (await prisma.productUnit.findFirstOrThrow({ where: { productId } })).id;
    const warehouse = await prisma.warehouse.create({ data: { branchId, code: `${prefix}-warehouse`, name: 'Central Warehouse' } });
    warehouseId = warehouse.id;
    locationId = (await prisma.inventoryLocation.create({ data: { branchId, warehouseId, code: `${prefix}-location`, name: 'Central Warehouse' } })).id;
    const supplier = await procurement.createSupplier({ supplierCode: `${prefix}-supplier`, name: 'ABC Distributors' }, userId);
    supplierId = supplier.id;
  });

  beforeEach(async () => {
    await prisma.goodsReceipt.deleteMany({ where: { purchaseOrder: { warehouseId } } });
    await prisma.purchaseOrder.deleteMany({ where: { warehouseId } });
    await prisma.idempotencyRecord.deleteMany({ where: { key: { startsWith: prefix } } });
    await prisma.inventoryMovement.deleteMany({ where: { locationId } });
    await prisma.inventoryEvent.deleteMany({ where: { branchId } });
    await prisma.inventorySnapshot.deleteMany({ where: { locationId } });
    await ledger.postEvent({ eventType: 'OPENING_STOCK', branchId, referenceType: 'STOCK_ADJUSTMENT', referenceId: `${prefix}-opening-${randomUUID()}`, createdById: userId, movements: [{ locationId, productId, unitId, stockState: 'AVAILABLE', quantityDelta: 20, baseQuantityDelta: 20, movementType: 'STOCK_IN' }] });
  });

  afterAll(async () => {
    await prisma.goodsReceipt.deleteMany({ where: { purchaseOrder: { warehouseId } } });
    await prisma.purchaseOrder.deleteMany({ where: { warehouseId } });
    await prisma.idempotencyRecord.deleteMany({ where: { key: { startsWith: prefix } } });
    await prisma.inventoryMovement.deleteMany({ where: { locationId } });
    await prisma.inventoryEvent.deleteMany({ where: { branchId } });
    await prisma.inventorySnapshot.deleteMany({ where: { locationId } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: userId } });
    await prisma.supplier.delete({ where: { id: supplierId } });
    await prisma.inventoryLocation.delete({ where: { id: locationId } });
    await prisma.warehouse.delete({ where: { id: warehouseId } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.category.delete({ where: { code: `${prefix}-category` } });
    await prisma.unit.delete({ where: { id: unitId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.branch.delete({ where: { id: branchId } });
    await prisma.$disconnect();
  });

  it('posts a full receipt exactly once to warehouse stock and the ledger', async () => {
    const po = await createPo();
    const receipt = await receive(po, 100, `${prefix}-full`);
    expect(await stock()).toBe(120);
    expect((await procurement.getPurchaseOrder(po.id)).status).toBe('RECEIVED');
    const movements = await prisma.inventoryMovement.findMany({ where: { referenceType: 'GOODS_RECEIPT', referenceId: receipt.id } });
    expect(movements).toHaveLength(1);
    expect(Number(movements[0].baseQuantityDelta)).toBe(100);
    expect(movements[0].movementType).toBe('PROCUREMENT_RECEIPT');
  });

  it('supports partial receipts and derives remaining quantity and status', async () => {
    const po = await createPo();
    await receive(po, 60, `${prefix}-partial-1`);
    const partial = await procurement.getPurchaseOrder(po.id);
    expect(await stock()).toBe(80);
    expect(partial.status).toBe('PARTIALLY_RECEIVED');
    expect(Number(partial.items[0].orderedQuantity) - Number(partial.items[0].receivedQuantity)).toBe(40);
    await receive(po, 40, `${prefix}-partial-2`);
    const final = await procurement.getPurchaseOrder(po.id);
    expect(await stock()).toBe(120);
    expect(final.status).toBe('RECEIVED');
    expect(Number(final.items[0].orderedQuantity) - Number(final.items[0].receivedQuantity)).toBe(0);
  });

  it('returns the original receipt for an identical idempotent retry', async () => {
    const po = await createPo();
    const first = await receive(po, 100, `${prefix}-retry`);
    const retry = await receive(po, 100, `${prefix}-retry`);
    expect(retry.id).toBe(first.id);
    expect(await stock()).toBe(120);
    expect(await prisma.inventoryMovement.count({ where: { referenceType: 'GOODS_RECEIPT', referenceId: first.id } })).toBe(1);
  });

  it('rejects reuse of an idempotency key with a different payload', async () => {
    const po = await createPo();
    await receive(po, 50, `${prefix}-conflict`);
    await expect(receive(po, 40, `${prefix}-conflict`)).rejects.toMatchObject({ statusCode: 409 });
    expect(await stock()).toBe(70);
  });

  it('rejects over-receipt without changing stock or PO quantities', async () => {
    const po = await createPo();
    await receive(po, 60, `${prefix}-over-1`);
    await expect(receive(po, 50, `${prefix}-over-2`)).rejects.toMatchObject({ statusCode: 422 });
    const current = await procurement.getPurchaseOrder(po.id);
    expect(await stock()).toBe(80);
    expect(current.status).toBe('PARTIALLY_RECEIVED');
    expect(Number(current.items[0].receivedQuantity)).toBe(60);
    expect(await prisma.goodsReceipt.count({ where: { purchaseOrderId: po.id } })).toBe(1);
  });

  it('rolls back receipt, PO quantities, ledger, and idempotency when ledger posting fails', async () => {
    const po = await createPo();
    const brokenLedger = { postEvent: async () => { throw new Error('forced ledger failure'); } } as unknown as InventoryLedgerService;
    const service = new ProcurementService(prisma, brokenLedger, audit);
    await expect(receive(po, 100, `${prefix}-ledger-fail`, service)).rejects.toThrow('forced ledger failure');
    expect(await stock()).toBe(20);
    expect((await procurement.getPurchaseOrder(po.id)).status).toBe('CONFIRMED');
    expect(await prisma.goodsReceipt.count({ where: { purchaseOrderId: po.id } })).toBe(0);
    expect(await prisma.idempotencyRecord.count({ where: { scope: 'goods-receipt.create', key: `${prefix}-ledger-fail` } })).toBe(0);
  });

  it('blocks a warehouse-scoped user from receiving against another warehouse PO', async () => {
    const po = await createPo();
    const branchB = await prisma.branch.create({ data: { code: `${prefix}-branch-b`, name: 'Other Branch', city: 'Test', district: 'Test' } });
    const warehouseB = await prisma.warehouse.create({ data: { branchId: branchB.id, code: `${prefix}-warehouse-b`, name: 'Other Warehouse' } });
    const locationB = await prisma.inventoryLocation.create({ data: { branchId: branchB.id, warehouseId: warehouseB.id, code: `${prefix}-location-b`, name: 'Other Warehouse' } });
    const poB = await prisma.purchaseOrder.create({ data: { purchaseOrderNumber: `${prefix}-po-b`, supplierId, warehouseId: warehouseB.id, branchId: branchB.id, createdById: userId, items: { create: { productId, productUnitId, orderedQuantity: 10, unitCost: 80, lineTotal: 800 } } } });
    const role = await prisma.role.create({ data: { code: `${prefix}-role`, name: 'Scoped warehouse user' } });
    await prisma.userRole.create({ data: { userId, roleId: role.id, warehouseId } });
    const guard = new ScopeGuard({ getAllAndOverride: () => 'purchase-order' } as unknown as Reflector, prisma);
    const context: any = { getHandler: () => ({}), getClass: () => ({}), switchToHttp: () => ({ getRequest: () => ({ user: { userId }, params: { id: poB.id }, body: {}, query: {} }) }) };
    await expect(guard.canActivate(context)).rejects.toMatchObject({ statusCode: 403 });
    expect(await prisma.goodsReceipt.count({ where: { purchaseOrderId: poB.id } })).toBe(0);
    expect(await stock()).toBe(20);
    await prisma.userRole.deleteMany({ where: { userId, roleId: role.id } });
    await prisma.role.delete({ where: { id: role.id } });
    await prisma.purchaseOrder.delete({ where: { id: poB.id } });
    await prisma.inventoryLocation.delete({ where: { id: locationB.id } });
    await prisma.warehouse.delete({ where: { id: warehouseB.id } });
    await prisma.branch.delete({ where: { id: branchB.id } });
    expect(await procurement.getPurchaseOrder(po.id)).toBeTruthy();
  });

  it('rejects receipt against a cancelled purchase order', async () => {
    const po = await createPo();
    await procurement.cancelPurchaseOrder(po.id, userId);
    await expect(receive(po, 100, `${prefix}-cancelled`)).rejects.toMatchObject({ statusCode: 422 });
    expect(await stock()).toBe(20);
    expect(await prisma.goodsReceipt.count({ where: { purchaseOrderId: po.id } })).toBe(0);
  });
});
