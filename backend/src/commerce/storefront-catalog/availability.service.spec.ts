import { StorefrontAvailabilityService } from './availability.service';

describe('StorefrontAvailabilityService', () => {
  const service = new StorefrontAvailabilityService();

  it('uses AVAILABLE snapshots minus safety stock', () => {
    const result = service.calculate({
      snapshots: [
        { baseQuantity: 10, batch: null },
        { baseQuantity: 5, batch: { status: 'ACTIVE', expiryDate: null } },
      ],
      safetyStockBaseQty: 2,
      maxOrderBaseQty: null,
      defaultUnitId: 'piece',
      productUnits: [{ unitId: 'piece', conversionToBase: 1 }],
    });
    expect(result.sellableBaseQuantity).toBe(13);
    expect(result.maxOrderQuantity).toBe(13);
    expect(result.state).toBe('AVAILABLE');
  });

  it('excludes expired and blocked batches', () => {
    const now = new Date('2026-09-30T00:00:00Z');
    const result = service.calculate({
      snapshots: [
        { baseQuantity: 4, batch: { status: 'BLOCKED', expiryDate: null } },
        { baseQuantity: 3, batch: { status: 'ACTIVE', expiryDate: new Date('2026-09-29T00:00:00Z') } },
        { baseQuantity: 2, batch: { status: 'ACTIVE', expiryDate: new Date('2026-10-10T00:00:00Z') } },
      ],
      safetyStockBaseQty: 0,
      maxOrderBaseQty: null,
      defaultUnitId: 'piece',
      productUnits: [{ unitId: 'piece', conversionToBase: 1 }],
      now,
    });
    expect(result.maxOrderQuantity).toBe(2);
    expect(result.state).toBe('LOW_STOCK');
  });

  it('converts sellable base quantity into the requested unit', () => {
    const result = service.calculate({
      snapshots: [{ baseQuantity: 24, batch: null }],
      safetyStockBaseQty: 0,
      maxOrderBaseQty: 12,
      defaultUnitId: 'carton',
      productUnits: [{ unitId: 'carton', conversionToBase: 6 }],
    });
    expect(result.maxOrderQuantity).toBe(2);
  });
});
