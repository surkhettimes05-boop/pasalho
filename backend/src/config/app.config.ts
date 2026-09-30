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
  CUSTOMER_JWT_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().min(16).optional(),
  }),
  CUSTOMER_JWT_TTL_SECONDS: Joi.number().integer().min(60).max(86400).default(900),
  CUSTOMER_REFRESH_TOKEN_DAYS: Joi.number().integer().min(1).max(90).default(30),
  OTP_PROVIDER: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().valid('sms').required(),
    otherwise: Joi.string().valid('console', 'sms').default('console'),
  }),
  OTP_SMS_WEBHOOK_URL: Joi.when('OTP_PROVIDER', {
    is: 'sms',
    then: Joi.string().uri({ scheme: ['http', 'https'] }).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  OTP_SMS_WEBHOOK_TOKEN: Joi.when('OTP_PROVIDER', {
    is: 'sms',
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  OTP_TTL_SECONDS: Joi.number().integer().min(60).max(900).default(300),
  OTP_MAX_ATTEMPTS: Joi.number().integer().min(1).max(10).default(5),
  CART_TTL_HOURS: Joi.number().integer().min(1).max(720).default(72),
  STOREFRONT_SYSTEM_USER_ID: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().guid({ version: ['uuidv4'] }).required(),
    otherwise: Joi.string().guid({ version: ['uuidv4'] }).allow('').optional(),
  }),
  CORS_ORIGIN: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required(),
    otherwise: Joi.string().default('http://localhost:3001'),
  }),
});
