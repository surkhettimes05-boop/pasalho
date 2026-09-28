import { appConfigSchema, resolveTrustProxySetting } from './app.config';

describe('appConfigSchema store sync production settings', () => {
  const base = {
    NODE_ENV: 'production',
    TRUST_PROXY_HOPS: '1',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/app',
    JWT_SECRET: 'a-production-jwt-secret-long-enough',
  };

  it('requires the canonical receiver URL in production', () => {
    const result = appConfigSchema.validate({
      ...base,
      STORE_SYNC_WEBHOOK_SECRET: 's'.repeat(40),
    });

    expect(result.error?.message).toContain('STORE_SYNC_WEBHOOK_URL');
  });

  it('requires a strong shared webhook secret in production', () => {
    const result = appConfigSchema.validate({
      ...base,
      STORE_SYNC_WEBHOOK_URL: 'https://ceo.example.com/api/sync/inbound-transfers',
    });

    expect(result.error?.message).toContain('STORE_SYNC_WEBHOOK_SECRET');
  });

  it('requires a 32-character JWT secret in production', () => {
    const result = appConfigSchema.validate({
      ...base,
      JWT_SECRET: 'short-production-key',
      STORE_SYNC_WEBHOOK_URL: 'https://ceo.example.com/api/sync/inbound-transfers',
      STORE_SYNC_WEBHOOK_SECRET: 's'.repeat(40),
      CORS_ORIGIN: 'https://pasalo.example.com',
    });

    expect(result.error?.message).toContain('JWT_SECRET');
  });

  it('rejects a production URL that does not use the canonical receiver path', () => {
    const result = appConfigSchema.validate({
      ...base,
      STORE_SYNC_WEBHOOK_URL: 'https://ceo.example.com/api/sync',
      STORE_SYNC_WEBHOOK_SECRET: 's'.repeat(40),
    });

    expect(result.error?.message).toContain('STORE_SYNC_WEBHOOK_URL');
  });

  it('allows private HTTP service URLs but rejects public HTTP service URLs in production', () => {
    const privateService = appConfigSchema.validate({
      ...base,
      NODE_ENV: 'production',
      TRUST_PROXY_HOPS: '1',
      STORE_SYNC_WEBHOOK_URL: 'http://ceodashboard.internal/api/sync/inbound-transfers',
      STORE_SYNC_WEBHOOK_SECRET: 's'.repeat(40),
      CEO_ONLINE_ORDER_URL: 'http://ceodashboard:3001/api/sync',
      CORS_ORIGIN: 'https://pasalo.example.com',
    });
    expect(privateService.error).toBeUndefined();

    const publicHttp = appConfigSchema.validate({
      ...base,
      NODE_ENV: 'production',
      TRUST_PROXY_HOPS: '1',
      STORE_SYNC_WEBHOOK_URL: 'http://ceodashboard.example.com/api/sync/inbound-transfers',
      STORE_SYNC_WEBHOOK_SECRET: 's'.repeat(40),
      CORS_ORIGIN: 'https://pasalo.example.com',
    });
    expect(publicHttp.error?.message).toContain('STORE_SYNC_WEBHOOK_URL');
  });

  it('accepts the canonical production receiver configuration', () => {
    const result = appConfigSchema.validate({
      ...base,
      STORE_SYNC_WEBHOOK_URL: 'https://ceo.example.com/api/sync/inbound-transfers',
      STORE_SYNC_WEBHOOK_SECRET: 's'.repeat(40),
      CORS_ORIGIN: 'https://pasalo.example.com',
    });

    expect(result.error).toBeUndefined();
  });

  it('requires CORS_ORIGIN in production', () => {
    const result = appConfigSchema.validate({
      ...base,
      STORE_SYNC_WEBHOOK_URL: 'https://ceo.example.com/api/sync/inbound-transfers',
      STORE_SYNC_WEBHOOK_SECRET: 's'.repeat(40),
    });

    expect(result.error?.message).toContain('CORS_ORIGIN');
  });

  it('accepts CORS_ORIGIN in production', () => {
    const result = appConfigSchema.validate({
      ...base,
      STORE_SYNC_WEBHOOK_URL: 'https://ceo.example.com/api/sync/inbound-transfers',
      STORE_SYNC_WEBHOOK_SECRET: 's'.repeat(40),
      CORS_ORIGIN: 'https://pasalo.example.com',
    });

    expect(result.error).toBeUndefined();
  });

  it('rejects wildcard and localhost origins in production', () => {
    for (const CORS_ORIGIN of ['*', 'https://pasalo.example.com,*', 'http://localhost:3001']) {
      const result = appConfigSchema.validate({
        ...base,
        NODE_ENV: 'production',
        TRUST_PROXY_HOPS: '1',
        STORE_SYNC_WEBHOOK_URL: 'http://ceo.internal/api/sync/inbound-transfers',
        STORE_SYNC_WEBHOOK_SECRET: 's'.repeat(40),
        CORS_ORIGIN,
      });
      expect(result.error).toBeDefined();
    }
  });

  it('accepts multiple explicit HTTPS origins in production', () => {
    const result = appConfigSchema.validate({
      ...base,
      NODE_ENV: 'production',
      TRUST_PROXY_HOPS: '1',
      STORE_SYNC_WEBHOOK_URL: 'http://ceo.internal/api/sync/inbound-transfers',
      STORE_SYNC_WEBHOOK_SECRET: 's'.repeat(40),
      CORS_ORIGIN: 'https://pasalo.example.com,https://admin.example.com',
    });
    expect(result.error).toBeUndefined();
  });

  it('requires exactly one trusted proxy hop in production', () => {
    const result = appConfigSchema.validate({
      ...base,
      TRUST_PROXY_HOPS: undefined,
      NODE_ENV: 'production',
      STORE_SYNC_WEBHOOK_URL: 'http://ceo.internal/api/sync/inbound-transfers',
      STORE_SYNC_WEBHOOK_SECRET: 's'.repeat(40),
      CORS_ORIGIN: 'https://pasalo.example.com',
    });
    expect(result.error?.message).toContain('TRUST_PROXY_HOPS');
    expect(appConfigSchema.validate({
      ...base,
      NODE_ENV: 'production',
      TRUST_PROXY_HOPS: '2',
      STORE_SYNC_WEBHOOK_URL: 'http://ceo.internal/api/sync/inbound-transfers',
      STORE_SYNC_WEBHOOK_SECRET: 's'.repeat(40),
      CORS_ORIGIN: 'https://pasalo.example.com',
    }).error).toBeDefined();
  });

  it('defaults trust proxy off and resolves only a one-hop setting', () => {
    expect(appConfigSchema.validate({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/app',
      JWT_SECRET: 'development-jwt-secret-long-enough',
    }).value.TRUST_PROXY_HOPS).toBe('0');
    expect(resolveTrustProxySetting({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(false);
    expect(resolveTrustProxySetting({ NODE_ENV: 'production', TRUST_PROXY_HOPS: '1' } as NodeJS.ProcessEnv)).toBe(1);
    expect(() => resolveTrustProxySetting({ NODE_ENV: 'production', TRUST_PROXY_HOPS: '2' } as NodeJS.ProcessEnv)).toThrow('TRUST_PROXY_HOPS must be 0 or 1.');
  });

  it('does not require webhook settings in development or test', () => {
    const result = appConfigSchema.validate({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/app',
      JWT_SECRET: 'test-jwt-secret-long-enough',
    });

    expect(result.error).toBeUndefined();
    expect(result.value.CORS_ORIGIN).toBe('http://localhost:3001,http://localhost:3002');
  });
});
