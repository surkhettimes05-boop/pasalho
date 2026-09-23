import { SalesOrderService } from './sales-order.service';
import { AppError } from '../common/errors/app-error';

const dto = {
  branchId: 'branch-1',
  salesRepId: 'rep-1',
  routeId: 'route-1',
  retailerId: 'retailer-1',
  items: [{
    productId: 'product-1',
    unitId: 'unit-1',
    quantity: 2,
    baseQuantity: 999,
    unitPrice: 1,
  }],
};

function makeService(overrides: Record<string, any> = {}) {
  const tx: any = {
    branch: { findUnique: jest.fn().mockResolvedValue({ id: 'branch-1' }) },
    salesRep: { findUnique: jest.fn().mockResolvedValue({ id: 'rep-1', branchId: 'branch-1', userId: 'actor-1', status: 'ACTIVE' }) },
    retailer: { findUnique: jest.fn().mockResolvedValue({ id: 'retailer-1', branchId: 'branch-1', status: 'ACTIVE' }) },
    route: { findUnique: jest.fn().mockResolvedValue({ id: 'route-1', branchId: 'branch-1', salesRepId: 'rep-1', status: 'ACTIVE' }) },
    inventoryLocation: { findFirst: jest.fn().mockResolvedValue({ id: 'location-1' }) },
    routeStop: { findUnique: jest.fn().mockResolvedValue({ id: 'stop-1' }) },
    product: { findUnique: jest.fn().mockResolvedValue({ id: 'product-1', name: 'Product', isActive: true, sellingPrice: 25, productUnits: [{ unitId: 'unit-1', conversionToBase: 12 }] }) },
    batch: { findUnique: jest.fn() },
    retailerLedgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
    salesOrder: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'order-1', orderNo: 'ORD-1' }),
    },
    salesOrderItem: { create: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([{ creditLimit: 1000 }]),
  };
  const prisma: any = { $transaction: jest.fn((callback) => callback(tx)) };
  const reservation: any = { reserveStock: jest.fn().mockResolvedValue({}) };
  const audit: any = { record: jest.fn() };
  const invoice: any = {};
  const service = new SalesOrderService(prisma, audit, invoice, reservation);
  jest.spyOn(service, 'findById').mockResolvedValue({ id: 'order-1' } as any);
  return { service, tx, reservation };
}

describe('SalesOrderService.create', () => {
  it('ignores client price and base quantity and reserves database-derived amounts', async () => {
    const { service, tx, reservation } = makeService();

    await service.create(dto as any, 'actor-1', 'key-1');

    expect(tx.salesOrder.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ subtotal: 50, grandTotal: 50, idempotencyKey: 'key-1' }),
    }));
    expect(tx.salesOrderItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ unitPrice: 25, baseQuantity: 24, lineTotal: 50, discountAmount: 0, taxAmount: 0 }),
    }));
    expect(reservation.reserveStock).toHaveBeenCalledWith(expect.objectContaining({ quantity: 2, baseQuantity: 24 }), tx, false);
  });

  it('rejects inactive products before creating an order', async () => {
    const { service, tx } = makeService();
    tx.product.findUnique.mockResolvedValue({ id: 'product-1', isActive: false, productUnits: [] });

    await expect(service.create(dto as any, 'actor-1')).rejects.toBeInstanceOf(AppError);
    expect(tx.salesOrder.create).not.toHaveBeenCalled();
  });

  it('rejects orders that exceed available retailer credit', async () => {
    const { service, tx } = makeService();
    tx.$queryRaw.mockResolvedValue([{ creditLimit: 10 }]);

    await expect(service.create(dto as any, 'actor-1')).rejects.toThrow('exceeds available credit');
    expect(tx.salesOrder.create).not.toHaveBeenCalled();
  });

  it('returns the original order for a repeated idempotency key', async () => {
    const { service, tx, reservation } = makeService();
    const original = { id: 'original-order' };
    tx.salesOrder.findUnique.mockResolvedValue(original);

    await expect(service.create(dto as any, 'actor-1', 'same-key')).resolves.toEqual({ id: 'order-1' });
    expect(tx.salesOrder.create).not.toHaveBeenCalled();
    expect(reservation.reserveStock).not.toHaveBeenCalled();
  });

  it('propagates insufficient available stock and rolls back order creation', async () => {
    const { service, tx, reservation } = makeService();
    reservation.reserveStock.mockRejectedValue(new AppError('INSUFFICIENT_STOCK', 'Insufficient available stock.', 422));

    await expect(service.create(dto as any, 'actor-1')).rejects.toThrow('Insufficient available stock');
    expect(tx.salesOrder.create).toHaveBeenCalled();
  });
});
