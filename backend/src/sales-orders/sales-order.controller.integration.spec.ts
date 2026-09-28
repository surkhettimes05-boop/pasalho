import { UnauthorizedException } from '@nestjs/common';
import { SalesOrderController } from './sales-order.controller';

describe('SalesOrderController commerce integration authentication', () => {
  const originalEnv = { nodeEnv: process.env.NODE_ENV, secret: process.env.PASALO_INTEGRATION_SECRET };

  afterEach(() => {
    process.env.NODE_ENV = originalEnv.nodeEnv;
    process.env.PASALO_INTEGRATION_SECRET = originalEnv.secret;
  });

  it('rejects an unauthorized commerce checkout request', () => {
    process.env.NODE_ENV = 'production';
    process.env.PASALO_INTEGRATION_SECRET = 's'.repeat(32);
    const controller = new SalesOrderController({} as any);

    expect(() => controller.publicCheckout({} as any, undefined, 'Bearer wrong-secret')).toThrow(UnauthorizedException);
  });
});
