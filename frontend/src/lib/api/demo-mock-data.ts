// Mock DB state initialized in LocalStorage for persistence
const DB_VERSION = 'v1';
const DB_KEY = `pasalo_mock_db_${DB_VERSION}`;

interface MockDb {
  users: any[];
  branches: any[];
  warehouses: any[];
  categories: any[];
  units: any[];
  products: any[];
  retailers: any[];
  routes: any[];
  invoices: any[];
  salesOrders: any[];
  deliveries: any[];
  notifications: any[];
  inventorySnapshots: any[];
  inventoryMovements: any[];
  stockAdjustments: any[];
  stockTransfers: any[];
  stockCounts: any[];
  damageReports: any[];
  expiryEvents: any[];
}

function getInitialDb(): MockDb {
  const users = [
    {
      id: 'usr-admin',
      fullName: 'Super Admin User',
      email: 'superadmin@pasalo.com',
      phone: '9800000001',
      status: 'ACTIVE',
      defaultBranchId: 'branch-1',
      defaultBranch: { id: 'branch-1', code: 'KTM', name: 'Kathmandu HQ', city: 'Kathmandu' },
      permissions: ['*'],
      userRoles: [
        {
          roleCode: 'SUPER_ADMIN',
          roleName: 'Super Admin',
          branchId: 'branch-1',
          branchName: 'Kathmandu HQ',
        },
      ],
    },
    {
      id: 'usr-manager',
      fullName: 'Kathmandu Manager',
      email: 'branchmanager@pasalo.com',
      phone: '9800000002',
      status: 'ACTIVE',
      defaultBranchId: 'branch-1',
      defaultBranch: { id: 'branch-1', code: 'KTM', name: 'Kathmandu HQ', city: 'Kathmandu' },
      permissions: ['inventory.view', 'inventory.manage', 'sales.view', 'sales.manage'],
      userRoles: [
        {
          roleCode: 'BRANCH_MANAGER',
          roleName: 'Branch Manager',
          branchId: 'branch-1',
          branchName: 'Kathmandu HQ',
        },
      ],
    },
    {
      id: 'usr-salesrep',
      fullName: 'Hari Bahadur (Sales)',
      email: 'salesrep@pasalo.com',
      phone: '9800000003',
      status: 'ACTIVE',
      defaultBranchId: 'branch-1',
      defaultBranch: { id: 'branch-1', code: 'KTM', name: 'Kathmandu HQ', city: 'Kathmandu' },
      permissions: ['sales.view', 'sales.manage', 'routes.view'],
      userRoles: [
        {
          roleCode: 'SALES_REP',
          roleName: 'Sales Representative',
          branchId: 'branch-1',
          branchName: 'Kathmandu HQ',
        },
      ],
    },
  ];

  const branches = [
    { id: 'branch-1', code: 'KTM', name: 'Kathmandu HQ', city: 'Kathmandu', district: 'Kathmandu', region: 'Bagmati', status: 'ACTIVE' },
    { id: 'branch-2', code: 'LAL', name: 'Lalitpur Hub', city: 'Patan', district: 'Lalitpur', region: 'Bagmati', status: 'ACTIVE' },
  ];

  const warehouses = [
    {
      id: 'wh-1',
      branchId: 'branch-1',
      code: 'KTM-WH-01',
      name: 'Central KTM Warehouse',
      status: 'ACTIVE',
      branch: { id: 'branch-1', name: 'Kathmandu HQ' },
      inventoryLocation: { id: 'loc-1', code: 'LOC-KTM-01', name: 'Main Location' },
    },
    {
      id: 'wh-2',
      branchId: 'branch-2',
      code: 'LAL-WH-01',
      name: 'Lalitpur Depot',
      status: 'ACTIVE',
      branch: { id: 'branch-2', name: 'Lalitpur Hub' },
      inventoryLocation: { id: 'loc-2', code: 'LOC-LAL-01', name: 'Depot Location' },
    },
  ];

  const categories = [
    { id: 'cat-bev', code: 'BEV', name: 'Beverages' },
    { id: 'cat-snk', code: 'SNK', name: 'Snacks & Biscuits' },
    { id: 'cat-gro', code: 'GRO', name: 'Packaged Grocery' },
  ];

  const units = [
    { id: 'unit-pcs', code: 'PCS', name: 'Pieces', symbol: 'pcs' },
    { id: 'unit-box', code: 'BOX', name: 'Box (12 pcs)', symbol: 'box' },
    { id: 'unit-case', code: 'CASE', name: 'Case (24 pcs)', symbol: 'case' },
  ];

  const products = [
    {
      id: 'prod-coke',
      skuCode: 'BEV-COKE-250',
      name: 'Coca Cola 250ml Glass',
      categoryId: 'cat-bev',
      category: { id: 'cat-bev', code: 'BEV', name: 'Beverages' },
      defaultUnitId: 'unit-pcs',
      defaultUnit: { id: 'unit-pcs', name: 'Pieces', symbol: 'pcs' },
      isBatchTracked: true,
      isExpiryTracked: true,
      costPrice: 40,
      mrp: 45,
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
      batches: [
        { id: 'batch-coke-01', batchCode: 'B-COKE-001', expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() },
        { id: 'batch-coke-02', batchCode: 'B-COKE-002', expiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() }, // Expired batch
      ],
    },
    {
      id: 'prod-lays',
      skuCode: 'SNK-LAYS-MASALA',
      name: 'Lays Potato Chips Masala 50g',
      categoryId: 'cat-snk',
      category: { id: 'cat-snk', code: 'SNK', name: 'Snacks & Biscuits' },
      defaultUnitId: 'unit-pcs',
      defaultUnit: { id: 'unit-pcs', name: 'Pieces', symbol: 'pcs' },
      isBatchTracked: false,
      isExpiryTracked: false,
      costPrice: 16,
      mrp: 20,
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'prod-maggi',
      skuCode: 'GRO-MAGGI-N2',
      name: 'Maggi 2-Minute Noodles 75g',
      categoryId: 'cat-gro',
      category: { id: 'cat-gro', code: 'GRO', name: 'Packaged Grocery' },
      defaultUnitId: 'unit-pcs',
      defaultUnit: { id: 'unit-pcs', name: 'Pieces', symbol: 'pcs' },
      isBatchTracked: true,
      isExpiryTracked: true,
      costPrice: 24,
      mrp: 30,
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
      batches: [
        { id: 'batch-maggi-01', batchCode: 'B-MAGGI-992', expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString() }, // Near expiry
      ],
    },
  ];

  const retailers = [
    {
      id: 'ret-1',
      branchId: 'branch-1',
      code: 'RET-0001',
      shopName: 'Shrestha Kirana Store',
      ownerName: 'Ram Shrestha',
      phone: '9876543210',
      address: 'New Road, Kathmandu',
      creditLimit: 50000,
      outstanding: 15400,
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ret-2',
      branchId: 'branch-1',
      code: 'RET-0002',
      shopName: 'Karki Departmental Store',
      ownerName: 'Shyam Karki',
      phone: '9865432109',
      address: 'Baneshwor, Kathmandu',
      creditLimit: 100000,
      outstanding: 42000,
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ret-3',
      branchId: 'branch-2',
      code: 'RET-0003',
      shopName: 'Patan Mart',
      ownerName: 'Sita Maharjan',
      phone: '9843210987',
      address: 'Mangal Bazaar, Lalitpur',
      creditLimit: 75000,
      outstanding: 0,
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    },
  ];

  const routes = [
    {
      id: 'route-1',
      branchId: 'branch-1',
      branch: { id: 'branch-1', name: 'Kathmandu HQ' },
      salesRepId: 'salesrep-1',
      salesRep: { id: 'salesrep-1', user: { id: 'usr-salesrep', fullName: 'Hari Bahadur (Sales)' } },
      code: 'RT-NEWROAD',
      name: 'New Road Circuit',
      description: 'Daily morning delivery route for New Road and surrounds',
      status: 'ACTIVE',
      stops: [
        { id: 'stop-1', routeId: 'route-1', retailerId: 'ret-1', retailer: { id: 'ret-1', shopName: 'Shrestha Kirana Store', ownerName: 'Ram Shrestha', phone: '9876543210' }, stopOrder: 1, notes: 'Deliver at back door' },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _count: { stops: 1, orders: 1 },
    },
  ];

  const invoices = [
    {
      id: 'inv-1',
      invoiceNumber: 'INV-2026-0001',
      branchId: 'branch-1',
      retailerId: 'ret-1',
      retailer: { id: 'ret-1', shopName: 'Shrestha Kirana Store', ownerName: 'Ram Shrestha', phone: '9876543210', status: 'ACTIVE' },
      warehouseId: 'wh-1',
      sourceLocationId: 'loc-1',
      subtotal: 10000,
      discountTotal: 500,
      taxTotal: 1235,
      grandTotal: 10735,
      dueAmount: 5735,
      paidAmount: 5000,
      status: 'PARTIALLY_PAID',
      paymentStatus: 'PARTIALLY_PAID',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      postedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'inv-2',
      invoiceNumber: 'INV-2026-0002',
      branchId: 'branch-1',
      retailerId: 'ret-2',
      retailer: { id: 'ret-2', shopName: 'Karki Departmental Store', ownerName: 'Shyam Karki', phone: '9865432109', status: 'ACTIVE' },
      warehouseId: 'wh-1',
      sourceLocationId: 'loc-1',
      subtotal: 15000,
      discountTotal: 1000,
      taxTotal: 1820,
      grandTotal: 15820,
      dueAmount: 15820,
      paidAmount: 0,
      status: 'CREDIT_OPEN',
      paymentStatus: 'UNPAID',
      createdAt: new Date().toISOString(),
      postedAt: new Date().toISOString(),
    },
  ];

  const salesOrders = [
    {
      id: 'so-1',
      orderNo: 'SO-2026-0001',
      branchId: 'branch-1',
      branch: { id: 'branch-1', name: 'Kathmandu HQ' },
      salesRepId: 'salesrep-1',
      salesRep: { id: 'salesrep-1', user: { id: 'usr-salesrep', fullName: 'Hari Bahadur (Sales)' } },
      routeId: 'route-1',
      route: { id: 'route-1', name: 'New Road Circuit', code: 'RT-NEWROAD' },
      retailerId: 'ret-1',
      retailer: { id: 'ret-1', shopName: 'Shrestha Kirana Store', ownerName: 'Ram Shrestha', phone: '9876543210' },
      status: 'CONFIRMED',
      notes: 'Please dispatch by noon',
      subtotal: 5000,
      grandTotal: 5650,
      createdBy: { id: 'usr-salesrep', fullName: 'Hari Bahadur (Sales)' },
      createdAt: new Date().toISOString(),
      items: [
        {
          id: 'so-item-1',
          salesOrderId: 'so-1',
          productId: 'prod-coke',
          product: { id: 'prod-coke', name: 'Coca Cola 250ml Glass', skuCode: 'BEV-COKE-250' },
          unitId: 'unit-pcs',
          unit: { id: 'unit-pcs', name: 'Pieces', symbol: 'pcs' },
          quantity: 100,
          baseQuantity: 100,
          unitPrice: 50,
          lineTotal: 5000,
        },
      ],
    },
  ];

  const deliveries = [
    {
      id: 'del-1',
      deliveryNo: 'DEL-2026-0001',
      branchId: 'branch-1',
      branch: { id: 'branch-1', name: 'Kathmandu HQ' },
      routeId: 'route-1',
      route: { id: 'route-1', name: 'New Road Circuit', code: 'RT-NEWROAD' },
      vehicleRef: 'BA-2-PA-8890',
      driverName: 'Krishna Karki',
      status: 'IN_TRANSIT',
      scheduledAt: new Date().toISOString(),
      dispatchedAt: new Date().toISOString(),
      createdBy: { id: 'usr-admin', fullName: 'Super Admin User' },
      createdAt: new Date().toISOString(),
      items: [
        {
          id: 'del-item-1',
          deliveryId: 'del-1',
          retailerId: 'ret-1',
          retailer: { id: 'ret-1', shopName: 'Shrestha Kirana Store', ownerName: 'Ram Shrestha', phone: '9876543210', address: 'New Road, Kathmandu' },
          invoiceId: 'inv-1',
          invoice: { id: 'inv-1', invoiceNumber: 'INV-2026-0001', grandTotal: 10735, status: 'PARTIALLY_PAID' },
          isDelivered: false,
        },
      ],
    },
  ];

  const notifications = [
    {
      id: 'notif-1',
      branchId: 'branch-1',
      type: 'LOW_STOCK',
      status: 'UNREAD',
      title: 'Low Stock Warning',
      message: 'Coca Cola 250ml Glass quantity is below 10 units in Kathmandu HQ.',
      entityType: 'Product',
      entityId: 'prod-coke',
      createdAt: new Date().toISOString(),
    },
  ];

  const inventorySnapshots = [
    {
      id: 'snap-1',
      locationId: 'loc-1',
      warehouseId: 'wh-1',
      productId: 'prod-coke',
      product: { id: 'prod-coke', name: 'Coca Cola 250ml Glass', skuCode: 'BEV-COKE-250' },
      batchId: 'batch-coke-01',
      batch: { id: 'batch-coke-01', batchCode: 'B-COKE-001', expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() },
      stockState: 'AVAILABLE',
      unitId: 'unit-pcs',
      unit: { id: 'unit-pcs', name: 'Pieces', symbol: 'pcs' },
      quantity: 50,
      baseQuantity: 50,
      reservedQuantity: 0,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'snap-2',
      locationId: 'loc-1',
      warehouseId: 'wh-1',
      productId: 'prod-lays',
      product: { id: 'prod-lays', name: 'Lays Potato Chips Masala 50g', skuCode: 'SNK-LAYS-MASALA' },
      stockState: 'AVAILABLE',
      unitId: 'unit-pcs',
      unit: { id: 'unit-pcs', name: 'Pieces', symbol: 'pcs' },
      quantity: 120,
      baseQuantity: 120,
      reservedQuantity: 0,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'snap-3',
      locationId: 'loc-1',
      warehouseId: 'wh-1',
      productId: 'prod-maggi',
      product: { id: 'prod-maggi', name: 'Maggi 2-Minute Noodles 75g', skuCode: 'GRO-MAGGI-N2' },
      batchId: 'batch-maggi-01',
      batch: { id: 'batch-maggi-01', batchCode: 'B-MAGGI-992', expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString() },
      stockState: 'AVAILABLE',
      unitId: 'unit-pcs',
      unit: { id: 'unit-pcs', name: 'Pieces', symbol: 'pcs' },
      quantity: 8, // Low Stock Alert Triggered
      baseQuantity: 8,
      reservedQuantity: 0,
      updatedAt: new Date().toISOString(),
    },
  ];

  const inventoryMovements = [
    {
      id: 'mov-1',
      productId: 'prod-coke',
      product: { id: 'prod-coke', name: 'Coca Cola 250ml Glass', skuCode: 'BEV-COKE-250' },
      warehouseId: 'wh-1',
      locationId: 'loc-1',
      movementType: 'INWARD_RECEIPT',
      quantityDelta: 50,
      unitId: 'unit-pcs',
      unit: { id: 'unit-pcs', name: 'Pieces', symbol: 'pcs' },
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const stockAdjustments = [];
  const stockTransfers = [];
  const stockCounts = [];
  const damageReports = [];
  const expiryEvents = [
    {
      id: 'exp-1',
      branchId: 'branch-1',
      branch: { id: 'branch-1', name: 'Kathmandu HQ' },
      batchId: 'batch-coke-02',
      batch: { id: 'batch-coke-02', batchNumber: 'B-COKE-002', expiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), status: 'EXPIRED' },
      productId: 'prod-coke',
      product: { id: 'prod-coke', name: 'Coca Cola 250ml Glass', skuCode: 'BEV-COKE-250' },
      locationId: 'loc-1',
      location: { id: 'loc-1', name: 'Main Location' },
      expiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      daysToExpiry: -5,
      detectedAt: new Date().toISOString(),
      isActedUpon: false,
    },
  ];

  return {
    users,
    branches,
    warehouses,
    categories,
    units,
    products,
    retailers,
    routes,
    invoices,
    salesOrders,
    deliveries,
    notifications,
    inventorySnapshots,
    inventoryMovements,
    stockAdjustments,
    stockTransfers,
    stockCounts,
    damageReports,
    expiryEvents,
  };
}

export function loadDb(): MockDb {
  if (typeof window === 'undefined') return getInitialDb();
  const dbStr = localStorage.getItem(DB_KEY);
  if (!dbStr) {
    const initial = getInitialDb();
    localStorage.setItem(DB_KEY, JSON.stringify(initial));
    return initial;
  }
  try {
    return JSON.parse(dbStr);
  } catch (e) {
    const initial = getInitialDb();
    localStorage.setItem(DB_KEY, JSON.stringify(initial));
    return initial;
  }
}

export function saveDb(db: MockDb) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }
}

// Router handler to mock response matching the API routes structure
export function handleMockRequest(config: any): Promise<any> {
  const url = config.url || '';
  const method = (config.method || 'get').toLowerCase();
  const data = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});

  const db = loadDb();

  return new Promise((resolve, reject) => {
    // Helper envelope wraps
    const ok = (payload: any) => {
      resolve({
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        data: { success: true, data: payload },
      });
    };

    const fail = (status: number, message: string) => {
      reject({
        response: {
          status,
          data: { error: { message } },
        },
      });
    };

    // Parse path and query
    const [pathPart, queryPart] = url.split('?');
    const path = pathPart.replace(/^\/api\/v1/, '').replace(/^\/v1/, '');

    // ─── AUTH ENDPOINTS ──────────────────────────────────────────────────────────
    if (path === '/auth/login' && method === 'post') {
      const user = db.users.find((u) => u.email === data.login || u.phone === data.login);
      if (user && data.password.includes('1234')) {
        return ok({
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          userId: user.id,
          permissions: user.permissions,
        });
      }
      return fail(401, 'Invalid login credentials');
    }

    if (path === '/auth/refresh' && method === 'post') {
      return ok({
        accessToken: 'mock-access-token-new',
        refreshToken: 'mock-refresh-token-new',
        userId: 'usr-admin',
        permissions: ['*'],
      });
    }

    if (path === '/auth/me' && method === 'get') {
      // Find the logged user from authorization token or default to admin
      const authHeader = config.headers?.Authorization || '';
      let user = db.users[0]; // fallback admin
      if (authHeader.includes('mock-access-token')) {
        user = db.users[0];
      }
      return ok(user);
    }

    if (path === '/auth/logout' && method === 'post') {
      return ok({ success: true });
    }

    // ─── RETAILER PORTAL AUTH ───────────────────────────────────────────────────
    if (path === '/retailer-portal/auth/login' && method === 'post') {
      const retailer = db.retailers.find((r) => r.phone === data.phone);
      if (retailer && data.pin === '1234') {
        return ok({
          accessToken: 'mock-retailer-token',
          retailer: {
            id: retailer.id,
            shopName: retailer.shopName,
            ownerName: retailer.ownerName,
            phone: retailer.phone,
            branchId: retailer.branchId,
            creditLimit: retailer.creditLimit,
            outstanding: retailer.outstanding,
          },
        });
      }
      return fail(401, 'Invalid PIN or phone number');
    }

    if (path === '/retailer-portal/auth/me' && method === 'get') {
      const retailer = db.retailers[0];
      return ok({
        id: retailer.id,
        shopName: retailer.shopName,
        ownerName: retailer.ownerName,
        phone: retailer.phone,
        branchId: retailer.branchId,
        creditLimit: retailer.creditLimit,
        outstanding: retailer.outstanding,
      });
    }

    // ─── DASHBOARD ─────────────────────────────────────────────────────────────
    if (path.startsWith('/dashboard/admin-summary') && method === 'get') {
      const totalSales = db.invoices.reduce((sum, inv) => sum + Number(inv.grandTotal), 0);
      const totalPayments = db.invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
      const outstanding = db.retailers.reduce((sum, ret) => sum + Number(ret.outstanding), 0);

      return ok({
        today: {
          invoiceCount: db.invoices.length,
          invoiceSalesTotal: totalSales,
          paymentCount: db.invoices.filter((i) => Number(i.paidAmount) > 0).length,
          paymentsTotal: totalPayments,
        },
        outstanding: {
          totalRetailerCredit: outstanding,
        },
        lowStockCount: db.inventorySnapshots.filter((s) => Number(s.quantity) < 10).length,
        recentInvoices: db.invoices.slice(0, 5),
        recentMovements: db.inventoryMovements.slice(0, 5).map((m) => ({
          id: m.id,
          movementType: m.movementType,
          quantity: Number(m.quantityDelta),
          occurredAt: m.createdAt,
          product: m.product,
          location: { name: 'Main Shelf' },
        })),
      });
    }

    // ─── CATALOG ───────────────────────────────────────────────────────────────
    if (path === '/catalog/products' && method === 'get') {
      return ok({
        items: db.products,
        total: db.products.length,
        page: 1,
        limit: 50,
      });
    }

    if (path.startsWith('/catalog/products/') && method === 'get') {
      const id = path.split('/').pop();
      const product = db.products.find((p) => p.id === id);
      return product ? ok(product) : fail(404, 'Product not found');
    }

    if (path === '/catalog/categories' && method === 'get') {
      return ok(db.categories);
    }

    if (path === '/catalog/units' && method === 'get') {
      return ok(db.units);
    }

    // ─── RETAILERS ─────────────────────────────────────────────────────────────
    if (path === '/retailers' && method === 'get') {
      return ok({
        items: db.retailers,
        total: db.retailers.length,
        page: 1,
        limit: 50,
      });
    }

    // ─── INVOICES ──────────────────────────────────────────────────────────────
    if (path === '/invoices' && method === 'get') {
      return ok({
        items: db.invoices,
        total: db.invoices.length,
        page: 1,
        limit: 50,
      });
    }

    if (path.startsWith('/invoices/') && method === 'get') {
      const id = path.split('/').pop();
      const invoice = db.invoices.find((i) => i.id === id);
      return invoice ? ok(invoice) : fail(404, 'Invoice not found');
    }

    if (path === '/invoices' && method === 'post') {
      const retailer = db.retailers.find((r) => r.id === data.retailerId);
      const newInv = {
        id: `inv-${Date.now()}`,
        invoiceNumber: `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        branchId: data.branchId || 'branch-1',
        retailerId: data.retailerId,
        retailer: retailer || { shopName: 'Walk-in Retailer' },
        warehouseId: data.warehouseId,
        sourceLocationId: data.sourceLocationId,
        subtotal: 1000,
        discountTotal: 0,
        taxTotal: 130,
        grandTotal: 1130,
        dueAmount: 1130,
        paidAmount: 0,
        status: 'DRAFT',
        paymentStatus: 'UNPAID',
        createdAt: new Date().toISOString(),
      };
      db.invoices.unshift(newInv);
      saveDb(db);
      return ok(newInv);
    }

    if (path.endsWith('/post') && path.startsWith('/invoices/')) {
      const parts = path.split('/');
      const id = parts[parts.length - 2];
      const invoice = db.invoices.find((i) => i.id === id);
      if (invoice) {
        invoice.status = 'CREDIT_OPEN';
        invoice.postedAt = new Date().toISOString();
        saveDb(db);
        return ok(invoice);
      }
      return fail(404, 'Invoice not found');
    }

    // ─── STOCKS AND INVENTORY ──────────────────────────────────────────────────
    if (path === '/inventory/snapshots' && method === 'get') {
      return ok({
        items: db.inventorySnapshots,
        total: db.inventorySnapshots.length,
        page: 1,
        limit: 50,
      });
    }

    if (path === '/inventory/movements' && method === 'get') {
      return ok({
        items: db.inventoryMovements,
        total: db.inventoryMovements.length,
        page: 1,
        limit: 50,
      });
    }

    if (path === '/inventory/adjustments' && method === 'get') {
      return ok({
        items: db.stockAdjustments,
        total: db.stockAdjustments.length,
        page: 1,
        limit: 50,
      });
    }

    if (path === '/inventory/adjustments' && method === 'post') {
      const warehouse = db.warehouses.find((w) => w.id === data.warehouseId);
      const product = db.products.find((p) => p.id === data.productId);
      const unit = db.units.find((u) => u.id === data.unitId);
      const newAdj = {
        id: `adj-${Date.now()}`,
        referenceNumber: `ADJ-${Math.floor(1000 + Math.random() * 9000)}`,
        warehouseId: data.warehouseId,
        warehouse: warehouse || { name: 'Main WH' },
        productId: data.productId,
        product: product || { name: 'Unknown Product' },
        unitId: data.unitId,
        unit: unit || { symbol: 'pcs' },
        quantityDelta: data.quantityDelta,
        reasonCode: data.reasonCode,
        reason: data.notes,
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
      };
      db.stockAdjustments.unshift(newAdj);
      saveDb(db);
      return ok(newAdj);
    }

    // ─── TRANSFERS ─────────────────────────────────────────────────────────────
    if (path === '/inventory/transfers' && method === 'get') {
      return ok({
        items: db.stockTransfers,
        total: db.stockTransfers.length,
        page: 1,
        limit: 50,
      });
    }

    // ─── DELIVERIES ────────────────────────────────────────────────────────────
    if (path === '/deliveries' && method === 'get') {
      return ok({
        items: db.deliveries,
        total: db.deliveries.length,
        page: 1,
        limit: 50,
      });
    }

    if (path.startsWith('/deliveries/') && method === 'get') {
      const id = path.split('/').pop();
      const delivery = db.deliveries.find((d) => d.id === id);
      return delivery ? ok(delivery) : fail(404, 'Delivery not found');
    }

    // ─── SALES ORDERS ──────────────────────────────────────────────────────────
    if (path === '/sales-orders' && method === 'get') {
      return ok({
        items: db.salesOrders,
        total: db.salesOrders.length,
        page: 1,
        limit: 50,
      });
    }

    if (path.startsWith('/sales-orders/') && method === 'get') {
      const id = path.split('/').pop();
      const order = db.salesOrders.find((so) => so.id === id);
      return order ? ok(order) : fail(404, 'Sales order not found');
    }

    // ─── ORGS & BRANCHES ───────────────────────────────────────────────────────
    if (path === '/branches' && method === 'get') {
      return ok({
        items: db.branches,
        total: db.branches.length,
        page: 1,
        limit: 2,
      });
    }

    if (path === '/warehouses' && method === 'get') {
      return ok({
        items: db.warehouses,
        total: db.warehouses.length,
        page: 1,
        limit: 2,
      });
    }

    // ─── EXPIRY SUMMARY ───────────────────────────────────────────────────────
    if (path.startsWith('/inventory/expiry/summary') && method === 'get') {
      return ok({
        expired: 1,
        within7: 1,
        within30: 0,
        within60: 2,
      });
    }

    if (path.startsWith('/inventory/expiry/events') && method === 'get') {
      return ok({
        items: db.expiryEvents,
        total: db.expiryEvents.length,
        page: 1,
        limit: 50,
      });
    }

    // ─── NOTIFICATIONS ─────────────────────────────────────────────────────────
    if (path === '/notifications' && method === 'get') {
      return ok({
        items: db.notifications,
        total: db.notifications.length,
        page: 1,
        limit: 50,
        unreadCount: db.notifications.filter((n) => n.status === 'UNREAD').length,
      });
    }

    if (path === '/notifications/mark-all-read' && method === 'post') {
      db.notifications.forEach((n) => (n.status = 'READ'));
      saveDb(db);
      return ok({ success: true });
    }

    // Fallback default mock handler: return empty structure rather than crashing
    console.warn(`[Demo Mock] Unhandled API request to ${method.toUpperCase()} ${path}. Returning default mock empty data.`);
    return ok({ items: [], total: 0, page: 1, limit: 50 });
  });
}
