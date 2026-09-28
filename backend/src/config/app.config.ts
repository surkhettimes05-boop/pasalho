import * as Joi from 'joi';

function validateCorsOrigins(value: string, helpers: Joi.CustomHelpers, production: boolean) {
  const origins = value.split(',').map((origin) => origin.trim());
  if (!origins.length || origins.some((origin) => !origin || origin.includes('*'))) {
    return helpers.error('any.invalid');
  }

  for (const origin of origins) {
    try {
      const parsed = new URL(origin);
      const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
      const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(hostname);
      if (
        parsed.origin !== origin ||
        parsed.username ||
        parsed.password ||
        (production && (parsed.protocol !== 'https:' || isLocalhost)) ||
        (!production && !['http:', 'https:'].includes(parsed.protocol))
      ) {
        return helpers.error('any.invalid');
      }
    } catch {
      return helpers.error('any.invalid');
    }
  }

  return value;
}

function isPrivateServiceHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.svc') ||
    !host.includes('.')
  ) return true;

  const octets = host.split('.').map(Number);
  if (octets.length === 4 && octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [first, second] = octets;
    return first === 10 || first === 127 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 169 && second === 254) ||
      (first === 100 && second >= 64 && second <= 127);
  }

  return host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:');
}

function isSafeProductionServiceUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) return false;
    return parsed.protocol === 'https:' ||
      (parsed.protocol === 'http:' && isPrivateServiceHostname(parsed.hostname));
  } catch {
    return false;
  }
}

export function resolveTrustProxySetting(env: NodeJS.ProcessEnv = process.env): false | 1 {
  if (env.TRUST_PROXY_HOPS === '1') return 1;
  if (env.TRUST_PROXY_HOPS === undefined || env.TRUST_PROXY_HOPS === '0') {
    if (env.NODE_ENV === 'production') {
      throw new Error('Production requires TRUST_PROXY_HOPS=1 for the single trusted reverse proxy.');
    }
    return false;
  }
  throw new Error('TRUST_PROXY_HOPS must be 0 or 1.');
}

export const appConfigSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'staging', 'production').default('development'),
  PORT: Joi.number().default(3000),
  TRUST_PROXY_HOPS: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().valid('1').required(),
    otherwise: Joi.string().valid('0', '1').default('0'),
  }),
  DATABASE_URL: Joi.string().required(),
  REDIS_URL: Joi.string().default('redis://localhost:6379'),
  JWT_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().min(16).required(),
  }),
  STORE_SYNC_WEBHOOK_URL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .custom((value, helpers) => {
        try {
          if (!isSafeProductionServiceUrl(value)) return helpers.error('any.invalid');
          if (new URL(value).pathname.replace(/\/+$/, '') !== '/api/sync/inbound-transfers') {
            return helpers.error('any.invalid');
          }
          return value;
        } catch {
          return helpers.error('any.invalid');
        }
      })
      .required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  STORE_SYNC_WEBHOOK_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  PASALO_INTEGRATION_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(32).allow('').optional(),
    otherwise: Joi.string().allow('').optional(),
  }),
  CEO_ONLINE_ORDER_URL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .allow('')
      .optional()
      .custom((value, helpers) => value === '' || isSafeProductionServiceUrl(value)
        ? value
        : helpers.error('any.invalid')),
    otherwise: Joi.string().allow('').optional(),
  }),
  CEO_ONLINE_ORDER_TIMEOUT_MS: Joi.number().integer().min(1000).default(10000),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  CORS_ORIGIN: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required().custom((value, helpers) => validateCorsOrigins(value, helpers, true)),
    otherwise: Joi.string()
      .default('http://localhost:3001,http://localhost:3002')
      .custom((value, helpers) => validateCorsOrigins(value, helpers, false)),
  }),
});
