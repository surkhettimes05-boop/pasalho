import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const load = (file) => import(pathToFileURL(path.resolve(process.env.CEO_ROOT, 'backend/dist', file)));
const { prisma } = await load('db/prisma.js');
const { ProductsService } = await load('modules/products/products.service.js');
const { InventoryService } = await load('modules/inventory/inventory.service.js');
const { SalesService } = await load('modules/sales/sales.service.js');
const file = path.resolve(process.env.ACCEPTANCE_EVIDENCE, 'ceo.json');
const state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : {};
const command = process.argv[2];
try {
  if (command === 'init') {
    const role = await prisma.role.create({ data: { name: 'CEO' } });
    state.surkhet = (await prisma.branch.create({ data: { code: 'SURKHET', name: 'Surkhet Store' } })).id;
    state.store2 = (await prisma.branch.create({ data: { code: 'STORE-2', name: 'Store-2' } })).id;
    state.user = (await prisma.user.create({ data: { username: 'ci-admin', email: 'ci@example.invalid', password_hash: 'disposable-unusable-password', full_name: 'Acceptance Actor', role_id: role.id, branch_id: state.surkhet } })).id;
    const category = await prisma.category.create({ data: { name: 'Acceptance' } });
    const unit = await prisma.unit.create({ data: { name: 'Piece', abbreviation: 'pc' } });
    state.product = (await prisma.product.create({ data: { sku: 'V1-BATCH-001', name: 'Acceptance batch product', category_id: category.id, unit_id: unit.id, cost_price: 80, selling_price: 125 } })).id;
    for (const [code, name, type] of [['1010','Cash','ASSET'],['1040','Inventory','ASSET'],['4010','Retail revenue','REVENUE'],['5010','Cost of goods','EXPENSE']]) await prisma.account.create({ data: { code, name, type } });
    await ProductsService.syncPasaloCatalog();
    assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: state.product } })).pasalo_product_id, process.env.CANONICAL_PRODUCT_ID);
  } else if (command === 'receipt') {
    const transfer = await prisma.stockTransfer.findUniqueOrThrow({ where: { external_transfer_id: process.env.ACCEPTANCE_TRANSFER_ID } });
    const input = { items: [{ productId: state.product, quantity: 20 }] };
    const result = await InventoryService.receiveStockTransfer(transfer.id, input, state.user, state.surkhet, 'v1-store-receipt');
    assert.equal(result.acknowledgement.status, 'ACKNOWLEDGED');
    await InventoryService.receiveStockTransfer(transfer.id, input, state.user, state.surkhet, 'v1-store-receipt');
    assert.equal(await prisma.transferReceipt.count(), 1);
  } else if (command === 'pos') {
    const input = { branchId: state.surkhet, channel: 'RETAIL', discountAmount: 0, taxAmount: 0, loyaltyRedemptionPoints: 0, items: [{ productId: state.product, quantity: 3, unitPrice: 125 }], payments: [{ paymentMethod: 'CASH', amount: 375 }] };
    const sale = await SalesService.createSaleTransaction(input, state.user, { role: 'CEO', branchId: state.surkhet }, 'v1-pos-sale');
    const replay = await SalesService.createSaleTransaction(input, state.user, { role: 'CEO', branchId: state.surkhet }, 'v1-pos-sale');
    assert.equal(replay.id, sale.id);
    assert.equal(await prisma.sale.count(), 1);
  } else if (command !== 'snapshot') throw new Error(`Unknown command ${command}`);
  const qty = async (location_id) => Number((await prisma.stockBalance.findUnique({ where: { product_id_location_id: { product_id: state.product, location_id } } }))?.quantity ?? 0);
  state.stock = { Surkhet: await qty(state.surkhet), Store2: await qty(state.store2) };
  fs.writeFileSync(file, JSON.stringify(state));
} finally { await prisma.$disconnect(); }
