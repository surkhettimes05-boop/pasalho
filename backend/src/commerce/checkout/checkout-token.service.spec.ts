import { ConfigService } from '@nestjs/config';
import {
  CheckoutTokenService,
  checkoutPriceHash,
} from './checkout-token.service';

describe('CheckoutTokenService', () => {
  const config = {
    get: (key: string, fallback?: unknown) =>
      key === 'CUSTOMER_JWT_SECRET'
        ? 'customer-secret-long-enough-for-tests'
        : fallback,
  } as ConfigService;
  const service = new CheckoutTokenService(config);

  it('issues and verifies a signed checkout token', () => {
    const token = service.issue({
      customerId: 'customer',
      cartToken: 'cart',
      addressId: 'address',
      paymentMethod: 'COD',
      locationId: 'store',
      serviceZoneId: 'zone',
      priceHash: 'hash',
    });
    expect(service.verify(token)).toMatchObject({
      customerId: 'customer',
      cartToken: 'cart',
      priceHash: 'hash',
    });
  });

  it('rejects tampered tokens', () => {
    const token = service.issue({
      customerId: 'customer',
      cartToken: 'cart',
      addressId: 'address',
      paymentMethod: 'COD',
      locationId: 'store',
      serviceZoneId: 'zone',
      priceHash: 'hash',
    });
    expect(() => service.verify(token + 'x')).toThrow('invalid or expired');
  });

  it('hashes checkout pricing independent of item order', () => {
    const common = {
      locationId: 'store',
      serviceZoneId: 'zone',
      subtotal: 30,
      discountTotal: 0,
      deliveryFee: 10,
      handlingFee: 0,
      grandTotal: 40,
    };
    const a = { productId: 'a', unitId: 'u', quantity: 1, baseQuantity: 1, unitPrice: 10, lineTotal: 10 };
    const b = { productId: 'b', unitId: 'u', quantity: 1, baseQuantity: 1, unitPrice: 20, lineTotal: 20 };
    expect(checkoutPriceHash({ ...common, items: [a, b] })).toBe(
      checkoutPriceHash({ ...common, items: [b, a] }),
    );
  });
});
