import { FulfillmentShortageAction } from '@prisma/client';
import { pickLineResolved } from './fulfillment.service';

describe('storefront picking resolution', () => {
  it('resolves a fully picked line', () => {
    expect(
      pickLineResolved({
        orderedBaseQty: 5,
        pickedBaseQty: 5,
        shortageBaseQty: 0,
      }),
    ).toBe(true);
  });

  it('does not resolve customer-contact shortages', () => {
    expect(
      pickLineResolved({
        orderedBaseQty: 5,
        pickedBaseQty: 3,
        shortageBaseQty: 2,
        shortageAction: FulfillmentShortageAction.CONTACT_CUSTOMER,
      }),
    ).toBe(false);
  });

  it('resolves a fully removed line', () => {
    expect(
      pickLineResolved({
        orderedBaseQty: 5,
        pickedBaseQty: 0,
        shortageBaseQty: 5,
        shortageAction: FulfillmentShortageAction.REMOVE_ITEM,
      }),
    ).toBe(true);
  });
});
