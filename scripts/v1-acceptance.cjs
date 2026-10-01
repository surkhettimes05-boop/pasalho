// One continuous, fresh-database acceptance sequence. No inventory mocks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../backend');
const load = (file) => require(path.join(root, 'dist', file));
require(path.join(root, 'node_modules/reflect-metadata'));
const { PrismaService } = load('database/prisma.service');
const { AuditLogService } = load('audit/audit-log.service');
const { InventoryLedgerService } = load('inventory/services/inventory-ledger.service');
const { StockTransferService } = load('inventory/services/stock-transfer.service');
const { StockReservationService } = load('inventory/services/stock-reservation.service');
const { InvoiceService } = load('sales/invoice.service');
const { PaymentService } = load('sales/payment.service');
const { RetailerLedgerService } = load('finance/retailer-ledger/retailer-ledger.service');
const { SalesOrderService } = load('sales-orders/sales-order.service');
const { FranchiseService } = load('franchise/franchise.service');
const { ProcurementService } = load('procurement/procurement.service');
const evidence = process.env.ACCEPTANCE_EVIDENCE;
fs.mkdirSync(evidence, { recursive: true });
const report = { shas: { pasalho: process.env.PASALHO_SHA, ceo: process.env.CEO_SHA, commerce: process.env.COMMERCE_SHA, flutter: process.env.FLUTTER_SHA }, steps: {}, assertions: [], finalInventory: null };
const p = new PrismaService();
const audit = new AuditLogService(p);
const ledger = new InventoryLedgerService(p);
const retailerLedger = new RetailerLedgerService(p);
const reservations = new StockReservationService(p, ledger, audit);
const invoices = new InvoiceService(p, audit, ledger, retailerLedger, reservations);
const sales = new SalesOrderService(p, audit, invoices, reservations);
const franchise = new FranchiseService(p, sales, ledger);
const procurement = new ProcurementService(p, ledger, audit);
const transfers = new StockTransferService(p, audit, ledger);
const payments = new PaymentService(p, audit, retailerLedger);
let actor, branch, warehouse, warehouseLoc, surkhetLoc, store2Loc, product, unit, batch, transfer, franchiseOrder, b2b, invoice;
const physical = async (locationId) => (await p.inventorySnapshot.findMany({ where: { locationId, productId: product.id, stockState: { in: ['AVAILABLE','RESERVED'] } } })).reduce((n, row) => n + Number(row.baseQuantity), 0);
const stock = async () => ({ Warehouse: await physical(warehouseLoc.id), SurkhetLedger: await physical(surkhetLoc.id), Store2Ledger: await physical(store2Loc.id) });
const child = (system, command, extra = {}) => new Promise((resolve, reject) => {
  const env = { ...process.env, ...extra, NODE_ENV: 'test', DATABASE_URL: system === 'ceo' ? process.env.CEO_DATABASE_URL : process.env.COMMERCE_DATABASE_URL, TEST_DATABASE_URL: process.env.COMMERCE_DATABASE_URL, CANONICAL_PRODUCT_ID: product.id };
  const proc = spawn(process.execPath, [path.join(__dirname, `v1-${system}-adapter.mjs`), command], { env, stdio: 'inherit' });
  proc.on('error', reject); proc.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${system} ${command} exited ${code}`)));
});
const read = (system) => JSON.parse(fs.readFileSync(path.join(evidence, `${system}.json`)));
const step = async (letter, fn) => {
  try { await fn(); report.steps[letter] = { result: 'PASS', stock: await stock() }; console.log(`A→J ${letter}: PASS`); }
  catch (error) { report.steps[letter] = { result: 'FAIL', error: error.stack }; console.error(`A→J ${letter}: FAIL: ${error.message}`); throw error; }
  finally { fs.writeFileSync(path.join(evidence, 'acceptance.json'), JSON.stringify(report, null, 2)); }
};
async function main() {
  assert(/test/.test(new URL(process.env.DATABASE_URL).pathname), 'Acceptance requires a test database');
  await p.$connect();
  assert.equal(await p.product.count(), 0, 'PASALHO database must be fresh');
  actor = await p.user.create({ data: { id: '99999999-9999-4999-a999-999999999999', fullName: 'CI Actor', phone: '9800000001', email: 'ci@example.invalid', passwordHash: 'disposable-unusable-password', status: 'ACTIVE' } });
  branch = await p.branch.create({ data: { code: 'SURKHET', name: 'Pasalho Surkhet Branch', city: 'Surkhet', district: 'Surkhet' } });
  unit = await p.unit.create({ data: { code: 'PC', name: 'Piece', symbol: 'pc' } });
  const category = await p.category.create({ data: { code: 'ACCEPTANCE', name: 'Acceptance' } });
  product = await p.product.create({ data: { skuCode: 'V1-BATCH-001', name: 'Acceptance batch product', categoryId: category.id, defaultUnitId: unit.id, sellingPrice: 125, isBatchTracked: true, productUnits: { create: { unitId: unit.id, conversionToBase: 1, isBaseUnit: true } } } });
  warehouse = await p.warehouse.create({ data: { branchId: branch.id, code: 'CENTRAL', name: 'Central Warehouse' } });
  warehouseLoc = await p.inventoryLocation.create({ data: { branchId: branch.id, warehouseId: warehouse.id, code: 'CENTRAL', name: 'Central Warehouse', type: 'WAREHOUSE' } });
  surkhetLoc = await p.inventoryLocation.create({ data: { branchId: branch.id, code: 'SURKHET', name: 'Surkhet Store', type: 'STORE' } });
  store2Loc = await p.inventoryLocation.create({ data: { branchId: branch.id, code: 'STORE-2', name: 'Store-2', type: 'STORE' } });
  await step('A', async () => {
    await child('ceo', 'init'); await child('commerce', 'sync');
    assert.equal(read('commerce').product.pasalo_product_id, product.id);
  });
  await step('B', async () => {
    const supplier = await procurement.createSupplier({ supplierCode: 'CI-SUPPLIER', name: 'Acceptance Supplier' }, actor.id);
    const productUnit = await p.productUnit.findFirstOrThrow({ where: { productId: product.id } });
    const draft = await procurement.createPurchaseOrder({ supplierId: supplier.id, warehouseId: warehouse.id, items: [{ productId: product.id, productUnitId: productUnit.id, orderedQuantity: 100, unitCost: 80 }] }, actor.id);
    const po = await procurement.confirmPurchaseOrder(draft.id, actor.id);
    const input = { items: [{ purchaseOrderItemId: po.items[0].id, receivedQuantity: 100, acceptedQuantity: 100, batchNumber: 'V1-NAMED-BATCH', expiryDate: '2028-01-01' }] };
    const receipt = await procurement.receiveGoods(po.id, input, 'v1-grn', actor.id);
    assert.equal((await procurement.receiveGoods(po.id, input, 'v1-grn', actor.id)).id, receipt.id);
    batch = await p.batch.findFirstOrThrow({ where: { productId: product.id } });
    assert.equal(await physical(warehouseLoc.id), 100); assert.equal(await p.goodsReceipt.count(), 1);
  });
  await step('C', async () => {
    transfer = await transfers.create({ fromBranchId: branch.id, fromWarehouseId: warehouse.id, fromLocationId: warehouseLoc.id, toBranchId: branch.id, toWarehouseId: warehouse.id, toLocationId: surkhetLoc.id, items: [{ productId: product.id, batchId: batch.id, unitId: unit.id, quantity: 20, baseQuantity: 20 }] }, actor.id, 'v1-transfer');
    await transfers.confirm(transfer.id, actor.id);
    await transfers.dispatch(transfer.id, actor.id, 'v1-dispatch');
    assert.equal(await physical(warehouseLoc.id), 80); assert.equal(await physical(surkhetLoc.id), 0);
    await child('ceo', 'receipt', { ACCEPTANCE_TRANSFER_ID: transfer.id });
    // The accepted receipt boundary transfers custody to CEO's store ledger.
    assert.deepEqual(await stock(), { Warehouse: 80, SurkhetLedger: 0, Store2Ledger: 0 });
    assert.deepEqual(read('ceo').stock, { Surkhet: 20, Store2: 0 });
  });
  await step('D', async () => {
    const before = await p.inventoryEvent.count();
    await transfers.dispatch(transfer.id, actor.id, 'v1-dispatch');
    await child('ceo', 'receipt', { ACCEPTANCE_TRANSFER_ID: transfer.id });
    assert.equal(await p.inventoryEvent.count(), before);
    assert.deepEqual(await stock(), { Warehouse: 80, SurkhetLedger: 0, Store2Ledger: 0 });
    assert.deepEqual(read('ceo').stock, { Surkhet: 20, Store2: 0 });
  });
  await step('E', async () => {
    const partner = await franchise.createPartner({ name: 'Acceptance Franchise', phone: '9800000002' });
    const store = await franchise.createStore({ partnerId: partner.id, branchId: branch.id, name: 'Acceptance Franchise Store', address: 'Surkhet' });
    franchiseOrder = await franchise.createSupplyOrder({ storeId: store.id, items: [{ productId: product.id, quantity: 10 }] }, actor.id);
    for (const action of ['approve','pick','pack','dispatch','receive']) await franchise.transition(franchiseOrder.id, action, actor.id);
    const events = await p.inventoryEvent.count();
    await franchise.transition(franchiseOrder.id, 'receive', actor.id);
    assert.equal(await p.inventoryEvent.count(), events);
    const destination = await p.franchiseStore.findUniqueOrThrow({ where: { id: store.id } });
    assert.equal(await physical(destination.inventoryLocationId), 10);
    assert.equal(await physical(warehouseLoc.id), 70);
  });
  await step('F', async () => {
    const retailer = await p.retailer.create({ data: { branchId: branch.id, code: 'CI-RETAILER', shopName: 'Acceptance Retailer', ownerName: 'Acceptance', phone: '9800000003', creditLimit: 10000, createdById: actor.id } });
    const input = { branchId: branch.id, salesRepId: actor.id, retailerId: retailer.id, channel: 'DNP', items: [{ productId: product.id, unitId: unit.id, quantity: 5 }] };
    b2b = await sales.createOnline(input, actor.id, 'v1-b2b', { branchId: branch.id, locationId: warehouseLoc.id });
    assert.equal((await sales.createOnline(input, actor.id, 'v1-b2b', { branchId: branch.id, locationId: warehouseLoc.id })).id, b2b.id);
    await sales.updateStatus(b2b.id, 'PICKING', actor.id); await sales.updateStatus(b2b.id, 'PACKED', actor.id);
    assert.equal(await physical(warehouseLoc.id), 70);
    const invoicedOrder = await sales.convertToInvoice(b2b.id, { warehouseId: warehouse.id, sourceLocationId: warehouseLoc.id }, actor.id);
    invoice = await invoices.findById(invoicedOrder.invoiceId);
    const posted = await invoices.post(invoice.id, actor.id);
    await invoices.post(invoice.id, actor.id);
    assert.equal(await physical(warehouseLoc.id), 65);
    await sales.updateStatus(b2b.id, 'DISPATCHED', actor.id); await sales.updateStatus(b2b.id, 'DELIVERED', actor.id);
    assert.equal(await physical(warehouseLoc.id), 65);
    const paymentInput = { branchId: branch.id, retailerId: retailer.id, invoiceId: invoice.id, amount: Number(posted.grandTotal), method: 'CASH' };
    const payment = await payments.create(paymentInput, actor.id, 'v1-payment');
    assert.equal((await payments.create(paymentInput, actor.id, 'v1-payment')).id, payment.id);
    assert.equal(await physical(warehouseLoc.id), 65); assert.equal(await p.invoice.count(), 1); assert.equal(await p.payment.count(), 1);
    const entries = await p.retailerLedgerEntry.findMany({ where: { retailerId: retailer.id } });
    assert.equal(entries.length, 2); assert.equal(entries.reduce((sum, row) => sum + Number(row.debitAmount) - Number(row.creditAmount), 0), 0);
  });
  await step('G', async () => {
    await child('commerce', 'order');
    const id = read('commerce').deliver.fulfillment_order_id;
    const order = await p.salesOrder.findUniqueOrThrow({ where: { id } });
    assert.equal(order.source, 'STOREFRONT'); assert.equal(order.branchId, branch.id);
    assert.equal(await physical(warehouseLoc.id), 65);
    const rows = await p.inventorySnapshot.findMany({ where: { locationId: warehouseLoc.id, productId: product.id, stockState: 'RESERVED' } });
    assert.equal(rows.reduce((sum, row) => sum + Number(row.baseQuantity), 0), 2);
    const available = await p.inventorySnapshot.findMany({ where: { locationId: warehouseLoc.id, productId: product.id, stockState: 'AVAILABLE' } });
    assert.equal(available.reduce((sum, row) => sum + Number(row.baseQuantity), 0), 63);
    for (const status of ['PICKING','PACKED','DISPATCHED','DELIVERED']) await sales.updateStatus(id, status, actor.id);
    await sales.updateStatus(id, 'DELIVERED', actor.id);
    assert.deepEqual(await stock(), { Warehouse: 63, SurkhetLedger: 0, Store2Ledger: 0 });
    assert.deepEqual(read('ceo').stock, { Surkhet: 20, Store2: 0 });
    await child('commerce', 'deliver');
  });
  await step('H', async () => {
    await child('commerce', 'cancel-order'); await child('commerce', 'cancel');
    assert.equal(await physical(warehouseLoc.id), 63);
    assert.equal(await p.stockReservation.count({ where: { status: 'ACTIVE' } }), 0);
  });
  await step('I', async () => {
    await child('ceo', 'pos');
    assert.deepEqual(read('ceo').stock, { Surkhet: 17, Store2: 0 });
  });
  await step('J', async () => {
    await child('commerce', 'reconcile'); await child('ceo', 'snapshot');
    const location = await p.franchiseStore.findFirstOrThrow();
    report.finalInventory = { Warehouse: await physical(warehouseLoc.id), Surkhet: read('ceo').stock.Surkhet, Store2: read('ceo').stock.Store2, Franchise: await physical(location.inventoryLocationId), ActiveReservations: await p.stockReservation.count({ where: { status: 'ACTIVE' } }) };
    assert.deepEqual(report.finalInventory, { Warehouse: 63, Surkhet: 17, Store2: 0, Franchise: 10, ActiveReservations: 0 });
    assert.equal(await p.salesOrder.count(), 4); assert.equal(await p.stockReservation.count(), 4);
    const snapshots = await p.inventorySnapshot.findMany({ where: { productId: product.id } });
    for (const row of snapshots) {
      assert.equal(row.batchId, batch.id);
      const movements = await p.inventoryMovement.findMany({ where: { locationId: row.locationId, productId: product.id, batchId: batch.id, stockState: row.stockState } });
      assert.equal(movements.reduce((sum, movement) => sum + Number(movement.baseQuantityDelta), 0), Number(row.baseQuantity));
    }
    const duplicateEvents = await p.$queryRawUnsafe('SELECT "idempotencyKey",COUNT(*) FROM "InventoryEvent" WHERE "idempotencyKey" IS NOT NULL GROUP BY "idempotencyKey" HAVING COUNT(*) > 1');
    assert.equal(duplicateEvents.length, 0);
    assert.equal(await p.goodsReceipt.count(), 1);
    assert.equal(await p.stockTransfer.count(), 1);
    assert.equal(await p.inventoryEvent.count({ where: { idempotencyKey: `transfer-receive-origin-${transfer.id}` } }), 1);
    assert.equal(await p.franchiseSupplyOrder.count(), 1);
    assert.equal(await p.inventoryEvent.count({ where: { idempotencyKey: `franchise-receipt-${franchiseOrder.id}` } }), 1);
    assert.equal(await p.franchiseSupplyOrderEvent.count({ where: { orderId: franchiseOrder.id, toStatus: 'RECEIVED' } }), 1);
    assert.equal(await p.invoice.count(), 1); assert.equal(await p.payment.count(), 1);
    assert.equal(await p.retailerLedgerEntry.count(), 2);
    // One product and one named batch: reconcile custody across the real receipt
    // boundary, plus the three independently verified sales outflows.
    assert.equal(report.finalInventory.Warehouse + report.finalInventory.Franchise + report.finalInventory.Surkhet + 5 + 2 + 3, 100);
    report.assertions.push('Named-batch snapshots equal PASALHO movements at every location/state; received custody plus CEO sales reconcile the 100-unit batch', 'One goods receipt, transfer receipt, franchise order, invoice, payment and POS sale; two balanced retailer entries; replay checks did not add records');
  });
}
main().catch((error) => { report.blocker = error.stack; process.exitCode = 1; }).finally(async () => {
  for (const letter of 'ABCDEFGHIJ') if (!report.steps[letter]) report.steps[letter] = { result: 'NOT RUN' };
  report.status = Object.values(report.steps).every((row) => row.result === 'PASS') ? 'PASS' : 'FAIL';
  fs.writeFileSync(path.join(evidence, 'acceptance.json'), JSON.stringify(report, null, 2));
  await p.$disconnect();
});
