import 'dotenv/config';
import { z } from 'zod';

/**
 * Every environment variable the auth module needs, validated once at
 * boot. Fail fast with a clear message rather than crashing deep inside a
 * request handler later.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_VERSION: z.string().default('v1'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  JWT_PRIVATE_KEY_B64: z.string().min(1, 'JWT_PRIVATE_KEY_B64 is required'),
  JWT_PUBLIC_KEY_B64: z.string().min(1, 'JWT_PUBLIC_KEY_B64 is required'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  JWT_ISSUER: z.string().default('fitcloud'),
  JWT_AUDIENCE: z.string().default('fitcloud-tenant-app'),
  /** Deliberately distinct from JWT_AUDIENCE — a tenant token fails signature/claims
   *  verification against the admin audience and vice versa, so gym owners are
   *  structurally locked out of the admin portal, not just permission-gated. */
  JWT_ADMIN_AUDIENCE: z.string().default('fitcloud-admin-app'),

  PLATFORM_DOMAIN: z.string().default('fitcloud.local'),
  CORS_ORIGINS: z.string().default(''),

  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  // NOT z.coerce.boolean() — Boolean("false") is `true` in JS (any
  // non-empty string is truthy), which would silently invert this flag.
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  MAIL_FROM_NAME: z.string().default('FitCloud'),
  MAIL_FROM_ADDRESS: z.string().email().default('no-reply@fitcloud.local'),

  PUSHER_APP_ID: z.string().optional(),
  PUSHER_KEY: z.string().optional(),
  PUSHER_SECRET: z.string().optional(),
  PUSHER_CLUSTER: z.string().optional(),

  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),
  OTP_LENGTH: z.coerce.number().int().min(4).max(10).default(6),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(30),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().positive().default(24),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console -- logger isn't available yet at this point
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const raw = parsed.data;

function decodeBase64Pem(value: string, label: string): string {
  const decoded = Buffer.from(value, 'base64').toString('utf8');
  if (!decoded.includes('BEGIN RSA')) {
    throw new Error(`${label} does not decode to a valid PEM key`);
  }
  return decoded;
}

export const env = {
  nodeEnv: raw.NODE_ENV,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  port: raw.PORT,
  apiVersion: raw.API_VERSION,

  databaseUrl: raw.DATABASE_URL,
  redisUrl: raw.REDIS_URL,

  jwt: {
    privateKey: decodeBase64Pem(raw.JWT_PRIVATE_KEY_B64, 'JWT_PRIVATE_KEY_B64'),
    publicKey: decodeBase64Pem(raw.JWT_PUBLIC_KEY_B64, 'JWT_PUBLIC_KEY_B64'),
    accessTtl: raw.JWT_ACCESS_TTL,
    refreshTtlDays: raw.JWT_REFRESH_TTL_DAYS,
    issuer: raw.JWT_ISSUER,
    audience: raw.JWT_AUDIENCE,
    adminAudience: raw.JWT_ADMIN_AUDIENCE,
  },

  platformDomain: raw.PLATFORM_DOMAIN,
  corsOrigins: raw.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),

  mail: {
    host: raw.SMTP_HOST,
    port: raw.SMTP_PORT,
    user: raw.SMTP_USER,
    pass: raw.SMTP_PASS,
    secure: raw.SMTP_SECURE,
    fromName: raw.MAIL_FROM_NAME,
    fromAddress: raw.MAIL_FROM_ADDRESS,
  },

  pusher: {
    appId: raw.PUSHER_APP_ID,
    key: raw.PUSHER_KEY,
    secret: raw.PUSHER_SECRET,
    cluster: raw.PUSHER_CLUSTER,
    get isConfigured() {
      return Boolean(raw.PUSHER_APP_ID && raw.PUSHER_KEY && raw.PUSHER_SECRET && raw.PUSHER_CLUSTER);
    },
  },

  security: {
    bcryptSaltRounds: raw.BCRYPT_SALT_ROUNDS,
    loginMaxAttempts: raw.LOGIN_MAX_ATTEMPTS,
    loginLockoutMinutes: raw.LOGIN_LOCKOUT_MINUTES,
    otpLength: raw.OTP_LENGTH,
    otpTtlSeconds: raw.OTP_TTL_SECONDS,
    otpResendCooldownSeconds: raw.OTP_RESEND_COOLDOWN_SECONDS,
    passwordResetTtlMinutes: raw.PASSWORD_RESET_TTL_MINUTES,
    emailVerificationTtlHours: raw.EMAIL_VERIFICATION_TTL_HOURS,
  },

  logLevel: raw.LOG_LEVEL,
} as const;

export type Env = typeof env;
