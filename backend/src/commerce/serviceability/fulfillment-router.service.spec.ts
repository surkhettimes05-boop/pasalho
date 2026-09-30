import { FulfillmentRouterService } from './fulfillment-router.service';
import { GeoService } from './geo.service';

describe('FulfillmentRouterService', () => {
  const router = new FulfillmentRouterService(new GeoService());

  it('only selects explicitly enabled active STORE locations', () => {
    const branch = { id: 'b', name: 'Branch', status: 'ACTIVE', deletedAt: null };
    const selected = router.select(
      [
        {
          priority: 1,
          isEnabled: true,
          inventoryLocation: {
            id: 'warehouse',
            name: 'Warehouse',
            type: 'WAREHOUSE',
            status: 'ACTIVE',
            latitude: 28.6,
            longitude: 81.63,
            branchId: 'b',
            branch,
          },
        },
        {
          priority: 2,
          isEnabled: true,
          inventoryLocation: {
            id: 'store',
            name: 'Store',
            type: 'STORE',
            status: 'ACTIVE',
            latitude: 28.61,
            longitude: 81.63,
            branchId: 'b',
            branch,
          },
        },
      ],
      28.6,
      81.63,
    );

    expect(selected?.id).toBe('store');
  });

  it('returns every eligible store in deterministic priority order', () => {
    const branch = { id: 'b', name: 'Branch', status: 'ACTIVE', deletedAt: null };
    const ranked = router.rank(
      [
        {
          priority: 20,
          isEnabled: true,
          inventoryLocation: {
            id: 'second',
            name: 'Second',
            type: 'STORE',
            status: 'ACTIVE',
            latitude: 28.6,
            longitude: 81.63,
            branchId: 'b',
            branch,
          },
        },
        {
          priority: 10,
          isEnabled: true,
          inventoryLocation: {
            id: 'first',
            name: 'First',
            type: 'STORE',
            status: 'ACTIVE',
            latitude: 28.7,
            longitude: 81.63,
            branchId: 'b',
            branch,
          },
        },
      ],
      28.6,
      81.63,
    );

    expect(ranked.map((location) => location.id)).toEqual(['first', 'second']);
  });

  it('uses priority before distance', () => {
    const branch = { id: 'b', name: 'Branch', status: 'ACTIVE', deletedAt: null };
    const selected = router.select(
      [
        {
          priority: 50,
          isEnabled: true,
          inventoryLocation: {
            id: 'near',
            name: 'Near',
            type: 'STORE',
            status: 'ACTIVE',
            latitude: 28.6,
            longitude: 81.63,
            branchId: 'b',
            branch,
          },
        },
        {
          priority: 10,
          isEnabled: true,
          inventoryLocation: {
            id: 'priority',
            name: 'Priority',
            type: 'STORE',
            status: 'ACTIVE',
            latitude: 28.7,
            longitude: 81.63,
            branchId: 'b',
            branch,
          },
        },
      ],
      28.6,
      81.63,
    );

    expect(selected?.id).toBe('priority');
  });
});
