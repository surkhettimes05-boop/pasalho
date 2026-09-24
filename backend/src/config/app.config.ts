import * as Joi from 'joi';

export const appConfigSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'staging', 'production').default('development'),
  PORT: Joi.number().default(3000),
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
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  CORS_ORIGIN: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required(),
    otherwise: Joi.string().default('http://localhost:3001'),
  }),
});
