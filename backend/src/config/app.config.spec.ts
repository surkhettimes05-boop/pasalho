import { appConfigSchema } from './app.config';

describe('appConfigSchema store sync production settings', () => {
  const base = {
    NODE_ENV: 'production',
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

  it('does not require webhook settings in development or test', () => {
    const result = appConfigSchema.validate({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/app',
      JWT_SECRET: 'test-jwt-secret-long-enough',
    });

    expect(result.error).toBeUndefined();
    expect(result.value.CORS_ORIGIN).toBe('http://localhost:3001');
  });
});
