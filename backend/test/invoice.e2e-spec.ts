import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import * as request from 'supertest';

describe('Invoice Lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let branchId: string;
  let warehouseId: string;
  let locationId: string;
  let categoryId: string;
  let unitId: string;
  let productId: string;
  let batchId: string;
  let retailerId: string;
  let invoiceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    // Clean slate
    await prisma.auditLog.deleteMany();
    await prisma.retailerLedgerEntry.deleteMany();
    await prisma.financialLedgerEntry.deleteMany();
    await prisma.inventoryMovement.deleteMany();
    await prisma.inventoryEvent.deleteMany();
    await prisma.inventorySnapshot.deleteMany();
    await prisma.invoiceItem.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.stockAdjustmentItem.deleteMany();
    await prisma.stockAdjustment.deleteMany();
    await prisma.batch.deleteMany();
    await prisma.productUnit.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.brand.deleteMany();
    await prisma.unit.deleteMany();
    await prisma.inventoryLocation.deleteMany();
    await prisma.warehouse.deleteMany();
    await prisma.branch.deleteMany();
    await prisma.session.deleteMany();
    await prisma.loginAttempt.deleteMany();
    await prisma.userRole.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.role.deleteMany();
    await prisma.user.deleteMany();

    // Seed admin user
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash('Admin@1234', 10);
    const admin = await prisma.user.create({
      data: {
        fullName: 'Super Admin',
        email: 'superadmin@pasalo.com',
        phone: '9800000000',
        passwordHash,
        status: 'ACTIVE',
      },
    });

    // Seed SUPER_ADMIN role and full permissions
    const allPerms = [
      { code: 'auth:login', module: 'auth', action: 'login' },
      { code: 'products:read', module: 'catalog', action: 'read' },
      { code: 'products:write', module: 'catalog', action: 'write' },
      { code: 'inventory:read', module: 'inventory', action: 'read' },
      { code: 'inventory:write', module: 'inventory', action: 'write' },
      { code: 'invoices:read', module: 'sales', action: 'read' },
      { code: 'invoices:write', module: 'sales', action: 'write' },
      { code: 'retailers:read', module: 'retailers', action: 'read' },
      { code: 'retailers:write', module: 'retailers', action: 'write' },
      { code: 'payments:write', module: 'payments', action: 'write' },
      { code: 'organization:write', module: 'organization', action: 'write' },
      { code: 'dashboard:read', module: 'dashboard', action: 'read' },
    ];
    await prisma.permission.createMany({ data: allPerms });

    const role = await prisma.role.create({
      data: {
        code: 'SUPER_ADMIN',
        name: 'Super Admin',
        isSystemRole: true,
      },
    });
    const perms = await prisma.permission.findMany();
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
    });
    await prisma.userRole.create({ data: { userId: admin.id, roleId: role.id } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Login', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ login: 'superadmin@pasalo.com', password: 'Admin@1234' });

    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeDefined();
    accessToken = res.body.data.accessToken;
  });

  it('2. Create branch, warehouse, location', async () => {
    const branchRes = await request(app.getHttpServer())
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: 'BR-001', name: 'Kathmandu Central', city: 'Kathmandu', district: 'Kathmandu' });

    expect(branchRes.status).toBe(201);
    branchId = branchRes.body.data.id;

    const warehouseRes = await request(app.getHttpServer())
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ branchId, code: 'WH-001', name: 'Main Warehouse' });

    expect(warehouseRes.status).toBe(201);
    warehouseId = warehouseRes.body.data.id;
    locationId = warehouseRes.body.data.inventoryLocation?.id;
    expect(locationId).toBeDefined();
  });

  it('3. Create catalog (category, unit, product, batch)', async () => {
    const catRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: 'CAT-001', name: 'Beverages' });

    expect(catRes.status).toBe(201);
    categoryId = catRes.body.data.id;

    const unitRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/units')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: 'PCS', name: 'Pieces', symbol: 'pcs' });

    expect(unitRes.status).toBe(201);
    unitId = unitRes.body.data.id;

    const prodRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        skuCode: 'BEV-001',
        name: 'Coca Cola 500ml',
        categoryId,
        defaultUnitId: unitId,
        isBatchTracked: true,
        isExpiryTracked: false,
        mrp: 50,
        costPrice: 35,
        units: [{ unitId, conversionToBase: 1, isBaseUnit: true }],
      });

    expect(prodRes.status).toBe(201);
    productId = prodRes.body.data.id;

    const batchRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/batches')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ productId, batchNumber: 'BATCH-001', costPrice: 35, mrp: 50 });

    expect(batchRes.status).toBe(201);
    batchId = batchRes.body.data.id;
  });

  it('4. Post opening stock via stock adjustment', async () => {
    const adjRes = await request(app.getHttpServer())
      .post('/api/v1/inventory/adjustments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        branchId,
        warehouseId,
        locationId,
        reason: 'Opening stock',
        items: [{ productId, batchId, unitId, quantityDelta: 100, baseQuantityDelta: 100 }],
      });

    expect(adjRes.status).toBe(201);

    // Submit
    const submitRes = await request(app.getHttpServer())
      .post(`/api/v1/inventory/adjustments/${adjRes.body.data.id}/submit`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(submitRes.status).toBe(200);

    // Approve
    const approveRes = await request(app.getHttpServer())
      .post(`/api/v1/inventory/adjustments/${adjRes.body.data.id}/approve`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(approveRes.status).toBe(200);

    // Post
    const postRes = await request(app.getHttpServer())
      .post(`/api/v1/inventory/adjustments/${adjRes.body.data.id}/post`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(postRes.status).toBe(200);

    // Verify snapshot
    const snapRes = await request(app.getHttpServer())
      .get(`/api/v1/inventory/snapshots?locationId=${locationId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(snapRes.status).toBe(200);
    expect(snapRes.body.data.length).toBeGreaterThan(0);
    expect(Number(snapRes.body.data[0].baseQuantity)).toBe(100);
  });

  it('5. Create retailer', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/retailers')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        branchId,
        code: 'RT-001',
        shopName: 'Corner Store',
        ownerName: 'Ram Prasad',
        phone: '9812345678',
        creditLimit: 5000,
      });

    expect(res.status).toBe(201);
    retailerId = res.body.data.id;
  });

  it('6. Create and post invoice with stock deduction', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        branchId,
        warehouseId,
        sourceLocationId: locationId,
        retailerId,
        items: [
          {
            productId,
            batchId,
            unitId,
            quantity: 5,
            baseQuantity: 5,
            unitPrice: 50,
          },
        ],
      });

    expect(createRes.status).toBe(201);
    invoiceId = createRes.body.data.id;
    expect(createRes.body.data.status).toBe('DRAFT');

    // Post the invoice — this should deduct stock
    const postRes = await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoiceId}/post`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(postRes.status).toBe(200);
    expect(postRes.body.data.status).toBe('CREDIT_OPEN');

    // Verify stock deducted (100 - 5 = 95)
    const snapRes = await request(app.getHttpServer())
      .get(`/api/v1/inventory/snapshots?locationId=${locationId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(Number(snapRes.body.data[0].baseQuantity)).toBe(95);
  });

  it('7. Verify inventory ledger recorded movements', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/inventory/movements?branchId=${branchId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2); // opening + sale
    const saleMovement = res.body.data.find((m: any) => m.movementType === 'SALE_DEDUCTION');
    expect(saleMovement).toBeDefined();
    expect(Number(saleMovement.quantityDelta)).toBe(-5);
  });

  it('8. Verify audit logs exist for critical actions', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const actions = res.body.data.map((l: any) => l.action);
    expect(actions).toContain('INVOICE_CREATED');
    expect(actions).toContain('INVOICE_POSTED');
  });

  it('9. Record payment and verify retailer ledger', async () => {
    const payRes = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        branchId,
        retailerId,
        invoiceId,
        amount: 250,
        method: 'CASH',
      });
    expect(payRes.status).toBe(201);

    // Verify invoice payment status updated
    const invRes = await request(app.getHttpServer())
      .get(`/api/v1/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(invRes.status).toBe(200);
    expect(invRes.body.data.paymentStatus).toBe('PARTIALLY_PAID');
    expect(Number(invRes.body.data.paidAmount)).toBe(250);

    // Verify retailer ledger has debit + credit entries
    const ledgerRes = await request(app.getHttpServer())
      .get(`/api/v1/retailers/${retailerId}/ledger`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(ledgerRes.status).toBe(200);
    expect(ledgerRes.body.data.items.length).toBeGreaterThanOrEqual(2);
    expect(ledgerRes.body.data.outstanding).toBeGreaterThan(0);
  });

  it('10. Dashboard reflects operational summary', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard/admin-summary')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.today.invoiceCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.today.invoiceSalesTotal).toBeGreaterThan(0);
    expect(res.body.data.outstanding.totalRetailerCredit).toBeGreaterThan(0);
  });

  it('11. Void invoice and verify stock reversal', async () => {
    const voidRes = await request(app.getHttpServer())
      .post(`/api/v1/invoices/${invoiceId}/void`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'Test void' });
    expect(voidRes.status).toBe(200);
    expect(voidRes.body.data.status).toBe('VOIDED');

    // Verify stock reverted back to 100
    const snapRes = await request(app.getHttpServer())
      .get(`/api/v1/inventory/snapshots?locationId=${locationId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(Number(snapRes.body.data[0].baseQuantity)).toBe(100);
  });

  it('12. Verify no data leakage — other branch sees empty', async () => {
    // Create second branch
    const branchRes = await request(app.getHttpServer())
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: 'BR-002', name: 'Other Branch', city: 'Pokhara', district: 'Kaski' });
    const otherBranchId = branchRes.body.data.id;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/retailers?branchId=${otherBranchId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.body.data.items.length).toBe(0);
  });
});
