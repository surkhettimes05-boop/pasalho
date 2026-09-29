import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import * as request from 'supertest';
import { randomUUID } from 'crypto';

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
  let adminId: string;
  let roleId: string;
  let otherBranchId: string;
  const fixtureSuffix = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  const fixturePrefix = `INV-E2E-${fixtureSuffix}`;
  const adminEmail = `${fixturePrefix.toLowerCase()}@example.test`;
  const adminPhone = `9${Date.now().toString().slice(-9)}`;
  const retailerPhone = `98${(Date.now() + 1).toString().slice(-8)}`;
  const paymentIdempotencyKey = `${fixturePrefix}-payment`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();

    prisma = app.get(PrismaService);

    // Use isolated fixtures so this suite never clears business or other test data.
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash('Admin@1234', 10);
    const admin = await prisma.user.create({
      data: {
        fullName: 'Super Admin',
        email: adminEmail,
        phone: adminPhone,
        passwordHash,
        status: 'ACTIVE',
      },
    });
    adminId = admin.id;

    // Seed SUPER_ADMIN role and full permissions
    const allPerms = [
      { code: 'branches.create', module: 'branches', action: 'create' },
      { code: 'warehouses.create', module: 'warehouses', action: 'create' },
      { code: 'products.view', module: 'products', action: 'view' },
      { code: 'products.create', module: 'products', action: 'create' },
      { code: 'batches.create', module: 'batches', action: 'create' },
      { code: 'inventory.view', module: 'inventory', action: 'view' },
      { code: 'inventory.adjust.create', module: 'inventory', action: 'adjust.create' },
      { code: 'inventory.adjust.approve', module: 'inventory', action: 'adjust.approve' },
      { code: 'inventory.adjust.post', module: 'inventory', action: 'adjust.post' },
      { code: 'invoices.view', module: 'sales', action: 'view' },
      { code: 'invoices.create', module: 'sales', action: 'create' },
      { code: 'invoices.post', module: 'sales', action: 'post' },
      { code: 'invoices.void', module: 'sales', action: 'void' },
      { code: 'retailers.view', module: 'retailers', action: 'view' },
      { code: 'retailer_ledger.view', module: 'finance', action: 'retailer_ledger.view' },
      { code: 'retailers.create', module: 'retailers', action: 'create' },
      { code: 'payments.create', module: 'payments', action: 'create' },
      { code: 'audit_logs.view', module: 'audit_logs', action: 'view' },
      { code: 'dashboard.view', module: 'dashboard', action: 'view' },
    ];
    await prisma.permission.createMany({ data: allPerms, skipDuplicates: true });

    const role = await prisma.role.create({
      data: {
        code: `${fixturePrefix}-SUPER-ADMIN`,
        name: 'Invoice E2E Admin',
      },
    });
    roleId = role.id;
    const perms = await prisma.permission.findMany({
      where: { code: { in: allPerms.map((permission) => permission.code) } },
    });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
    });
    await prisma.userRole.create({ data: { userId: admin.id, roleId: role.id } });
  });

  afterAll(async () => {
    try {
      const branchIds = [branchId, otherBranchId].filter(
        (id): id is string => Boolean(id),
      );

      if (branchIds.length) {
        await prisma.payment.deleteMany({
          where: { branchId: { in: branchIds }, receivedById: adminId },
        });
        await prisma.retailerLedgerEntry.deleteMany({
          where: { branchId: { in: branchIds } },
        });
        await prisma.financialLedgerEntry.deleteMany({
          where: { branchId: { in: branchIds } },
        });
        await prisma.invoice.deleteMany({ where: { branchId: { in: branchIds } } });
        await prisma.stockAdjustment.deleteMany({ where: { branchId: { in: branchIds } } });
      }

      if (locationId) {
        await prisma.inventoryMovement.deleteMany({ where: { locationId } });
        await prisma.inventorySnapshot.deleteMany({ where: { locationId } });
      }

      if (branchIds.length) {
        const events = await prisma.inventoryEvent.findMany({
          where: { branchId: { in: branchIds } },
          select: { id: true },
        });
        const eventIds = events.map((event) => event.id);
        if (eventIds.length) {
          await prisma.inventoryEvent.updateMany({
            where: { id: { in: eventIds } },
            data: { reversalOfEventId: null },
          });
          await prisma.inventoryEvent.deleteMany({ where: { id: { in: eventIds } } });
        }
        await prisma.auditLog.deleteMany({
          where: { actorUserId: adminId, branchId: { in: branchIds } },
        });
      }

      if (invoiceId) {
        await prisma.payment.deleteMany({ where: { invoiceId } });
      }
      if (retailerId) {
        await prisma.retailerNotification.deleteMany({ where: { retailerId } });
        await prisma.retailerSession.deleteMany({ where: { retailerId } });
        await prisma.retailerDevice.deleteMany({ where: { retailerId } });
        await prisma.retailerLedgerEntry.deleteMany({ where: { retailerId } });
        await prisma.retailer.deleteMany({ where: { id: retailerId } });
      }

      if (batchId) await prisma.batch.deleteMany({ where: { id: batchId } });
      if (productId) {
        await prisma.productUnit.deleteMany({ where: { productId } });
        await prisma.product.deleteMany({ where: { id: productId } });
      }
      if (categoryId) await prisma.category.deleteMany({ where: { id: categoryId } });
      if (unitId) await prisma.unit.deleteMany({ where: { id: unitId } });
      if (locationId) await prisma.inventoryLocation.deleteMany({ where: { id: locationId } });
      if (warehouseId) await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
      if (branchIds.length) await prisma.branch.deleteMany({ where: { id: { in: branchIds } } });

      if (adminId) {
        await prisma.auditLog.deleteMany({ where: { actorUserId: adminId } });
        await prisma.userRole.deleteMany({ where: { userId: adminId } });
        await prisma.session.deleteMany({ where: { userId: adminId } });
        await prisma.loginAttempt.deleteMany({ where: { email: adminEmail } });
      }
      if (roleId) {
        await prisma.rolePermission.deleteMany({ where: { roleId } });
        await prisma.role.deleteMany({ where: { id: roleId } });
      }
      if (adminId) await prisma.user.deleteMany({ where: { id: adminId } });
    } finally {
      await app.close();
    }
  });

  it('1. Login', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ login: adminEmail, password: 'Admin@1234' });

    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeDefined();
    accessToken = res.body.data.accessToken;
  });

  it('2. Create branch, warehouse, location', async () => {
    const branchRes = await request(app.getHttpServer())
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: `${fixturePrefix}-BR-001`, name: 'Kathmandu Central', city: 'Kathmandu', district: 'Kathmandu' });

    expect(branchRes.status).toBe(201);
    branchId = branchRes.body.data.id;

    const warehouseRes = await request(app.getHttpServer())
      .post('/api/v1/warehouses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ branchId, code: `${fixturePrefix}-WH-001`, name: 'Main Warehouse' });

    expect(warehouseRes.status).toBe(201);
    warehouseId = warehouseRes.body.data.id;
    locationId = warehouseRes.body.data.inventoryLocation?.id;
    expect(locationId).toBeDefined();
  });

  it('3. Create catalog (category, unit, product, batch)', async () => {
    const catRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: `${fixturePrefix}-CAT-001`, name: 'Beverages' });

    expect(catRes.status).toBe(201);
    categoryId = catRes.body.data.id;

    const unitRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/units')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: `${fixturePrefix}-PCS`, name: 'Pieces', symbol: 'pcs' });

    expect(unitRes.status).toBe(201);
    unitId = unitRes.body.data.id;

    const prodRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/products')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        skuCode: `${fixturePrefix}-BEV-001`,
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
      .send({ productId, batchNumber: `${fixturePrefix}-BATCH-001`, costPrice: 35, mrp: 50 });

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
    expect([200, 201]).toContain(submitRes.status);

    // Approve
    const approveRes = await request(app.getHttpServer())
      .post(`/api/v1/inventory/adjustments/${adjRes.body.data.id}/approve`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect([200, 201]).toContain(approveRes.status);

    // Post
    const postRes = await request(app.getHttpServer())
      .post(`/api/v1/inventory/adjustments/${adjRes.body.data.id}/post`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect([200, 201]).toContain(postRes.status);

    // Verify snapshot
    const snapRes = await request(app.getHttpServer())
      .get(`/api/v1/inventory/snapshots?locationId=${locationId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(snapRes.status).toBe(200);
    expect(snapRes.body.data.items.length).toBeGreaterThan(0);
    expect(Number(snapRes.body.data.items[0].baseQuantity)).toBe(100);
  });

  it('5. Create retailer', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/retailers')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        branchId,
        code: `${fixturePrefix}-RT-001`,
        shopName: 'Corner Store',
        ownerName: 'Ram Prasad',
        phone: retailerPhone,
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
    expect([200, 201]).toContain(postRes.status);
    expect(postRes.body.data.status).toBe('CREDIT_OPEN');

    // Verify stock deducted (100 - 5 = 95)
    const snapRes = await request(app.getHttpServer())
      .get(`/api/v1/inventory/snapshots?locationId=${locationId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(Number(snapRes.body.data.items[0].baseQuantity)).toBe(95);
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
    const actions = res.body.data.items.map((l: any) => l.action);
    expect(actions).toContain('INVOICE_CREATED');
    expect(actions).toContain('INVOICE_POSTED');
  });

  it('9. Record payment and verify retailer ledger', async () => {
    const payRes = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', paymentIdempotencyKey)
      .send({
        branchId,
        retailerId,
        invoiceId,
        amount: 100,
        method: 'CASH',
      });
    expect(payRes.status).toBe(201);

    // Verify invoice payment status updated
    const invRes = await request(app.getHttpServer())
      .get(`/api/v1/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(invRes.status).toBe(200);
    expect(invRes.body.data.paymentStatus).toBe('PARTIALLY_PAID');
    expect(Number(invRes.body.data.paidAmount)).toBe(100);

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
    expect([200, 201]).toContain(voidRes.status);
    expect(voidRes.body.data.status).toBe('VOIDED');

    // Verify stock reverted back to 100
    const snapRes = await request(app.getHttpServer())
      .get(`/api/v1/inventory/snapshots?locationId=${locationId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(Number(snapRes.body.data.items[0].baseQuantity)).toBe(100);
  });

  it('12. Verify no data leakage — other branch sees empty', async () => {
    // Create second branch
    const branchRes = await request(app.getHttpServer())
      .post('/api/v1/branches')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: `${fixturePrefix}-BR-002`, name: 'Other Branch', city: 'Pokhara', district: 'Kaski' });
    otherBranchId = branchRes.body.data.id;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/retailers?branchId=${otherBranchId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.body.data.items.length).toBe(0);
  });
});
