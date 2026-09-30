import { SalesOrderStatus } from '@prisma/client';
import { isStorefrontTransitionAllowed } from './order-state-machine.service';

describe('storefront order state machine', () => {
  it('allows the P0 happy path', () => {
    expect(
      isStorefrontTransitionAllowed(
        SalesOrderStatus.PLACED,
        SalesOrderStatus.PICKING,
      ),
    ).toBe(true);
    expect(
      isStorefrontTransitionAllowed(
        SalesOrderStatus.PICKING,
        SalesOrderStatus.PACKED,
      ),
    ).toBe(true);
    expect(
      isStorefrontTransitionAllowed(
        SalesOrderStatus.PACKED,
        SalesOrderStatus.OUT_FOR_DELIVERY,
      ),
    ).toBe(true);
    expect(
      isStorefrontTransitionAllowed(
        SalesOrderStatus.OUT_FOR_DELIVERY,
        SalesOrderStatus.DELIVERED,
      ),
    ).toBe(true);
  });

  it('allows customer cancellation before picking and rejects backwards movement', () => {
    expect(
      isStorefrontTransitionAllowed(
        SalesOrderStatus.PLACED,
        SalesOrderStatus.CANCELLED,
      ),
    ).toBe(true);
    expect(
      isStorefrontTransitionAllowed(
        SalesOrderStatus.PACKED,
        SalesOrderStatus.PLACED,
      ),
    ).toBe(false);
    expect(
      isStorefrontTransitionAllowed(
        SalesOrderStatus.DELIVERED,
        SalesOrderStatus.CANCELLED,
      ),
    ).toBe(false);
  });
});
