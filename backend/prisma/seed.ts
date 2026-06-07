import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Permissions ──────────────────────────────────────────────────────────────
  const permissionDefs = [
    // Users
    { code: 'users.view', module: 'users', action: 'view', description: 'View users' },
    { code: 'users.create', module: 'users', action: 'create', description: 'Create users' },
    { code: 'users.update', module: 'users', action: 'update', description: 'Update users' },
    { code: 'roles.manage', module: 'roles', action: 'manage', description: 'Manage roles and permissions' },
    // Branches
    { code: 'branches.view', module: 'branches', action: 'view', description: 'View branches' },
    { code: 'branches.create', module: 'branches', action: 'create', description: 'Create branches' },
    { code: 'branches.update', module: 'branches', action: 'update', description: 'Update branches' },
    // Warehouses
    { code: 'warehouses.view', module: 'warehouses', action: 'view', description: 'View warehouses' },
    { code: 'warehouses.create', module: 'warehouses', action: 'create', description: 'Create warehouses' },
    { code: 'warehouses.update', module: 'warehouses', action: 'update', description: 'Update warehouses' },
    // Products
    { code: 'products.view', module: 'products', action: 'view', description: 'View products' },
    { code: 'products.create', module: 'products', action: 'create', description: 'Create products' },
    { code: 'products.update', module: 'products', action: 'update', description: 'Update products' },
    // Batches
    { code: 'batches.view', module: 'batches', action: 'view', description: 'View batches' },
    { code: 'batches.create', module: 'batches', action: 'create', description: 'Create batches' },
    // Inventory
    { code: 'inventory.view', module: 'inventory', action: 'view', description: 'View inventory' },
    { code: 'inventory.adjust.create', module: 'inventory', action: 'adjust.create', description: 'Create stock adjustments' },
    { code: 'inventory.adjust.approve', module: 'inventory', action: 'adjust.approve', description: 'Approve stock adjustments' },
    { code: 'inventory.adjust.post', module: 'inventory', action: 'adjust.post', description: 'Post stock adjustments' },
    // Retailers
    { code: 'retailers.view', module: 'retailers', action: 'view', description: 'View retailers' },
    { code: 'retailers.create', module: 'retailers', action: 'create', description: 'Create retailers' },
    { code: 'retailers.update', module: 'retailers', action: 'update', description: 'Update retailers' },
    // Sales Reps
    { code: 'sales_reps.view', module: 'sales_reps', action: 'view', description: 'View sales reps' },
    { code: 'sales_reps.create', module: 'sales_reps', action: 'create', description: 'Create sales reps' },
    // Invoices
    { code: 'invoices.view', module: 'invoices', action: 'view', description: 'View invoices' },
    { code: 'invoices.create', module: 'invoices', action: 'create', description: 'Create invoices' },
    { code: 'invoices.post', module: 'invoices', action: 'post', description: 'Post invoices' },
    { code: 'invoices.void', module: 'invoices', action: 'void', description: 'Void invoices' },
    // Payments
    { code: 'payments.view', module: 'payments', action: 'view', description: 'View payments' },
    { code: 'payments.create', module: 'payments', action: 'create', description: 'Record payments' },
    // Ledger
    { code: 'retailer_ledger.view', module: 'retailer_ledger', action: 'view', description: 'View retailer ledger' },
    // Audit
    { code: 'audit_logs.view', module: 'audit_logs', action: 'view', description: 'View audit logs' },
    // Dashboard
    { code: 'dashboard.view', module: 'dashboard', action: 'view', description: 'View dashboard' },
  ];

  for (const perm of permissionDefs) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    });
  }
  console.log(`✅ ${permissionDefs.length} permissions seeded`);

  const allPerms = await prisma.permission.findMany();
  const permMap = Object.fromEntries(allPerms.map((p) => [p.code, p.id]));

  // ── Roles ────────────────────────────────────────────────────────────────────
  const roleDefs = [
    {
      code: 'SUPER_ADMIN',
      name: 'Super Admin',
      description: 'Full system access',
      isSystemRole: true,
      permissions: Object.keys(permMap),
    },
    {
      code: 'ADMIN',
      name: 'Admin',
      description: 'Full operational access',
      isSystemRole: true,
      permissions: Object.keys(permMap).filter((p) => p !== 'roles.manage'),
    },
    {
      code: 'BRANCH_MANAGER',
      name: 'Branch Manager',
      description: 'Branch-scoped operational access',
      isSystemRole: true,
      permissions: [
        'warehouses.view', 'products.view', 'batches.view',
        'inventory.view', 'inventory.adjust.create', 'inventory.adjust.approve',
        'retailers.view', 'retailers.create', 'retailers.update',
        'sales_reps.view', 'sales_reps.create',
        'invoices.view', 'invoices.create', 'invoices.post', 'invoices.void',
        'payments.view', 'payments.create',
        'retailer_ledger.view', 'dashboard.view',
        'branches.view',
      ],
    },
    {
      code: 'WAREHOUSE_MANAGER',
      name: 'Warehouse Manager',
      description: 'Warehouse operations',
      isSystemRole: true,
      permissions: [
        'warehouses.view', 'products.view', 'batches.view', 'batches.create',
        'inventory.view', 'inventory.adjust.create', 'inventory.adjust.post',
        'branches.view',
      ],
    },
    {
      code: 'ACCOUNTANT',
      name: 'Accountant',
      description: 'Finance and billing access',
      isSystemRole: true,
      permissions: [
        'invoices.view', 'payments.view', 'payments.create',
        'retailer_ledger.view', 'dashboard.view', 'branches.view',
      ],
    },
    {
      code: 'SALES_REP',
      name: 'Sales Rep',
      description: 'Field sales access',
      isSystemRole: true,
      permissions: [
        'retailers.view', 'invoices.create', 'payments.create',
        'products.view', 'batches.view',
      ],
    },
    {
      code: 'STORE_STAFF',
      name: 'Store Staff',
      description: 'Basic store operations',
      isSystemRole: true,
      permissions: [
        'products.view', 'batches.view', 'inventory.view',
        'invoices.create', 'payments.create',
      ],
    },
  ];

  for (const roleDef of roleDefs) {
    const { permissions, ...roleData } = roleDef;
    const role = await prisma.role.upsert({
      where: { code: roleDef.code },
      update: {},
      create: roleData,
    });

    // Clear and re-assign permissions
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    for (const permCode of permissions) {
      const permId = permMap[permCode];
      if (permId) {
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: permId } });
      }
    }
  }
  console.log(`✅ ${roleDefs.length} roles seeded`);

  // ── Branch ───────────────────────────────────────────────────────────────────
  const branch = await prisma.branch.upsert({
    where: { code: 'SURKHET' },
    update: {},
    create: {
      code: 'SURKHET',
      name: 'Surkhet Branch',
      city: 'Birendranagar',
      district: 'Surkhet',
      region: 'Karnali Province',
      phone: '+977-083-521234',
      email: 'surkhet@pasalo.com',
      contactPerson: 'Branch Manager',
    },
  });
  console.log(`✅ Branch: ${branch.name}`);

  // ── Warehouse ────────────────────────────────────────────────────────────────
  const warehouse = await prisma.warehouse.upsert({
    where: { branchId_code: { branchId: branch.id, code: 'SURKHET-MAIN' } },
    update: {},
    create: {
      branchId: branch.id,
      code: 'SURKHET-MAIN',
      name: 'Surkhet Main Warehouse',
    },
  });

  // Ensure inventory location exists for this warehouse
  await prisma.inventoryLocation.upsert({
    where: { warehouseId: warehouse.id },
    update: {},
    create: {
      branchId: branch.id,
      warehouseId: warehouse.id,
      code: 'SURKHET-MAIN',
      name: 'Surkhet Main Warehouse',
      type: 'WAREHOUSE',
    },
  });
  console.log(`✅ Warehouse: ${warehouse.name}`);

  // ── Categories ───────────────────────────────────────────────────────────────
  const categories = [
    { code: 'NOODLES', name: 'Noodles' },
    { code: 'BISCUITS', name: 'Biscuits' },
    { code: 'COOKING-OIL', name: 'Cooking Oil' },
    { code: 'BEVERAGES', name: 'Beverages' },
    { code: 'SPICES', name: 'Spices' },
    { code: 'PERSONAL-CARE', name: 'Personal Care' },
    { code: 'HOUSEHOLD', name: 'Household' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({ where: { code: cat.code }, update: {}, create: cat });
  }
  console.log(`✅ ${categories.length} categories seeded`);

  // ── Units ────────────────────────────────────────────────────────────────────
  const units = [
    { code: 'PCS', name: 'Pieces', symbol: 'pcs' },
    { code: 'PACKET', name: 'Packet', symbol: 'pkt' },
    { code: 'CARTON', name: 'Carton', symbol: 'ctn' },
    { code: 'KG', name: 'Kilogram', symbol: 'kg' },
    { code: 'LITER', name: 'Liter', symbol: 'L' },
    { code: 'BOTTLE', name: 'Bottle', symbol: 'btl' },
    { code: 'CASE', name: 'Case', symbol: 'cs' },
  ];

  for (const unit of units) {
    await prisma.unit.upsert({ where: { code: unit.code }, update: {}, create: unit });
  }
  console.log(`✅ ${units.length} units seeded`);

  const categoryMap = Object.fromEntries((await prisma.category.findMany()).map((c) => [c.code, c.id]));
  const unitMap = Object.fromEntries((await prisma.unit.findMany()).map((u) => [u.code, u.id]));

  // ── Sample Products ──────────────────────────────────────────────────────────
  const products = [
    {
      skuCode: 'WAI-WAI-75G',
      name: 'Wai Wai Noodles 75g',
      categoryId: categoryMap['NOODLES'],
      defaultUnitId: unitMap['PACKET'],
      barcode: '8901063001234',
      isBatchTracked: true,
      isExpiryTracked: true,
      costPrice: 22,
      mrp: 28,
    },
    {
      skuCode: 'SUNFLOWER-OIL-1L',
      name: 'Sunflower Oil 1L',
      categoryId: categoryMap['COOKING-OIL'],
      defaultUnitId: unitMap['BOTTLE'],
      barcode: '8901063005678',
      isBatchTracked: true,
      isExpiryTracked: true,
      costPrice: 180,
      mrp: 210,
    },
    {
      skuCode: 'COCA-COLA-250ML',
      name: 'Coca-Cola 250ml',
      categoryId: categoryMap['BEVERAGES'],
      defaultUnitId: unitMap['BOTTLE'],
      barcode: '5449000131836',
      isBatchTracked: true,
      isExpiryTracked: true,
      costPrice: 35,
      mrp: 40,
    },
    {
      skuCode: 'PARLE-G-100G',
      name: 'Parle-G Biscuit 100g',
      categoryId: categoryMap['BISCUITS'],
      defaultUnitId: unitMap['PACKET'],
      barcode: '8901263001234',
      isBatchTracked: true,
      isExpiryTracked: true,
      costPrice: 10,
      mrp: 12,
    },
    {
      skuCode: 'TURMERIC-100G',
      name: 'Turmeric Powder 100g',
      categoryId: categoryMap['SPICES'],
      defaultUnitId: unitMap['PACKET'],
      barcode: '8901234001234',
      isBatchTracked: true,
      isExpiryTracked: true,
      costPrice: 30,
      mrp: 38,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({ where: { skuCode: product.skuCode }, update: {}, create: product });
  }
  console.log(`✅ ${products.length} products seeded`);

  // ── Sample Retailers ─────────────────────────────────────────────────────────
  // Retailers require a createdBy user — create super admin first
  const adminPasswordHash = await bcrypt.hash('Admin@1234', 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@pasalo.com' },
    update: {},
    create: {
      fullName: 'Super Admin',
      email: 'superadmin@pasalo.com',
      phone: '+9779800000001',
      passwordHash: adminPasswordHash,
      status: 'ACTIVE',
      defaultBranchId: branch.id,
    },
  });

  // Assign SUPER_ADMIN role
  const superAdminRole = await prisma.role.findUnique({ where: { code: 'SUPER_ADMIN' } });
  if (superAdminRole) {
    const existingSuper = await prisma.userRole.findFirst({
      where: { userId: superAdmin.id, roleId: superAdminRole.id, branchId: null, warehouseId: null },
    });
    if (!existingSuper) {
      await prisma.userRole.create({ data: { userId: superAdmin.id, roleId: superAdminRole.id } });
    }
  }

  // Additional users
  const userDefs = [
    { email: 'branchmanager@pasalo.com', fullName: 'Branch Manager', phone: '+9779800000002', role: 'BRANCH_MANAGER' },
    { email: 'warehouse@pasalo.com', fullName: 'Warehouse Manager', phone: '+9779800000003', role: 'WAREHOUSE_MANAGER' },
    { email: 'accountant@pasalo.com', fullName: 'Accountant', phone: '+9779800000004', role: 'ACCOUNTANT' },
    { email: 'salesrep@pasalo.com', fullName: 'Sales Representative', phone: '+9779800000005', role: 'SALES_REP' },
  ];

  for (const ud of userDefs) {
    const hash = await bcrypt.hash('Pasalo@1234', 12);
    const user = await prisma.user.upsert({
      where: { email: ud.email },
      update: {},
      create: { fullName: ud.fullName, email: ud.email, phone: ud.phone, passwordHash: hash, status: 'ACTIVE', defaultBranchId: branch.id },
    });

    const role = await prisma.role.findUnique({ where: { code: ud.role } });
    if (role) {
      const existingUR = await prisma.userRole.findFirst({
        where: { userId: user.id, roleId: role.id, branchId: branch.id, warehouseId: null },
      });
      if (!existingUR) {
        await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, branchId: branch.id } });
      }
    }
  }
  console.log(`✅ 5 users seeded`);

  const retailers = [
    { branchId: branch.id, code: 'RET-001', shopName: 'Birendranagar Kirana Store', ownerName: 'Ram Bahadur', phone: '+9779801234567', address: 'Birendranagar-5, Surkhet', creditLimit: 50000, createdById: superAdmin.id },
    { branchId: branch.id, code: 'RET-002', shopName: 'Surkhet Mini Mart', ownerName: 'Sita Kumari', phone: '+9779801234568', address: 'Birendranagar-7, Surkhet', creditLimit: 30000, createdById: superAdmin.id },
    { branchId: branch.id, code: 'RET-003', shopName: 'Local Retail Shop 01', ownerName: 'Hari Prasad', phone: '+9779801234569', address: 'Birendranagar-3, Surkhet', creditLimit: 20000, createdById: superAdmin.id },
  ];

  for (const retailer of retailers) {
    await prisma.retailer.upsert({
      where: { branchId_code: { branchId: retailer.branchId, code: retailer.code } },
      update: {},
      create: retailer,
    });
  }
  console.log(`✅ ${retailers.length} retailers seeded`);

  console.log('\n🎉 Seed complete!');
  console.log('\n📋 Login credentials:');
  console.log('  Super Admin:      superadmin@pasalo.com / Admin@1234');
  console.log('  Branch Manager:   branchmanager@pasalo.com / Pasalo@1234');
  console.log('  Warehouse Mgr:    warehouse@pasalo.com / Pasalo@1234');
  console.log('  Accountant:       accountant@pasalo.com / Pasalo@1234');
  console.log('  Sales Rep:        salesrep@pasalo.com / Pasalo@1234');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
