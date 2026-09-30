import { ReportingService } from './reporting.service';

describe('ReportingService', () => {
  it('reports B2B, online, franchise, and warehouse visibility without store ownership', async () => {
    const prisma = {
      salesOrder: {
        findMany: jest.fn().mockResolvedValue([
          { source: 'DNP', retailerId: 'retailer-1', status: 'DELIVERED', grandTotal: 500 },
          { source: 'STOREFRONT', retailerId: null, status: 'DELIVERED', grandTotal: 200 },
          { source: 'FRANCHISE', retailerId: null, status: 'DISPATCHED', grandTotal: 1000 },
          { source: 'STOREFRONT', retailerId: null, status: 'CANCELLED', grandTotal: 200 },
        ]),
      },
      inventorySnapshot: {
        findMany: jest.fn().mockResolvedValue([
          { productId: 'p1', baseQuantity: 63 },
          { productId: 'p2', baseQuantity: 4 },
          { productId: 'p2', baseQuantity: 2 },
        ]),
      },
    };
    const service = new ReportingService(prisma as any);

    await expect(service.getDailySummary(new Date('2026-09-30T00:00:00Z'), new Date('2026-10-01T00:00:00Z'))).resolves.toEqual({
      sales: { b2b: 500, online: 200, franchise: 1000, orderCount: 3, cancelledOrders: 1 },
      inventory: { warehouse: { totalUnits: 69, productCount: 2 }, lowStockProducts: 1 },
    });
  });
});
