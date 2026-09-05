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
  /** Third distinct audience — a member portal token structurally can't authenticate against the staff or admin planes, same enforcement mechanism as JWT_ADMIN_AUDIENCE. */
  JWT_MEMBER_AUDIENCE: z.string().default('fitcloud-member-app'),

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

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  /** Configured in the Razorpay Dashboard alongside the webhook URL (Settings → Webhooks) — signs every webhook delivery, distinct from RAZORPAY_KEY_SECRET which signs Checkout callbacks. */
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  /** 32-byte AES-256 key, base64-encoded — `core/security/encryption.util.ts`. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Currently the only thing encrypted with it is a tenant's own AI provider API key. */
  ENCRYPTION_KEY: z.string().min(1, 'ENCRYPTION_KEY is required'),

  /** Provider abstraction (`modules/ai-assistant/providers/`) — never hardcode a provider/key in code, this is the only place it's read from. */
  AI_PROVIDER: z.enum(['openrouter', 'openai', 'anthropic', 'gemini', 'azure-openai', 'ollama']).default('openrouter'),
  AI_MODEL: z.string().default('inclusionai/ling-3.0-flash:free'),
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().optional(),
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.7),
  AI_MAX_TOKENS: z.coerce.number().int().positive().max(32_000).default(1024),

  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(10),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),
  OTP_LENGTH: z.coerce.number().int().min(4).max(10).default(6),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(30),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().positive().default(24),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),

  /** Error tracking/APM (`core/observability/sentry.ts`) — unset means fully inert, zero overhead; the app never requires this to boot. */
  SENTRY_DSN: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

  /**
   * Object storage (`core/storage/`) — real AWS S3 via `@aws-sdk/client-s3`.
   * Set S3_BUCKET + S3_ACCESS_KEY_ID + S3_SECRET_ACCESS_KEY to upload to S3;
   * leave any of them unset and uploads fall back to local disk storage
   * (`core/storage/local-storage.util.ts`, served from `/uploads`) — never a
   * hard requirement to boot, so a dev machine with no AWS credentials keeps
   * working unchanged.
   */
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  // Real AWS S3 uses virtual-hosted-style URLs by default ("false"); only an
  // S3-compatible store that needs `endpoint/bucket/key` path-style URLs
  // requires "true".
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  /** Base URL for the direct (non-presigned) URL stored for `public/`-prefixed objects. Defaults to the standard AWS S3 virtual-hosted URL for S3_BUCKET/S3_REGION — only set this for a CDN/custom domain in front of the bucket. */
  S3_PUBLIC_URL_BASE: z.string().optional(),
  /** Base URL this API is reachable at — only used to build local-disk-storage file URLs when AWS S3 isn't configured. */
  API_PUBLIC_URL: z.string().optional(),
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
  publicUrl: raw.API_PUBLIC_URL ?? `http://localhost:${raw.PORT}`,

  databaseUrl: raw.DATABASE_URL,
  redisUrl: raw.REDIS_URL,
  encryptionKey: raw.ENCRYPTION_KEY,

  jwt: {
    privateKey: decodeBase64Pem(raw.JWT_PRIVATE_KEY_B64, 'JWT_PRIVATE_KEY_B64'),
    publicKey: decodeBase64Pem(raw.JWT_PUBLIC_KEY_B64, 'JWT_PUBLIC_KEY_B64'),
    accessTtl: raw.JWT_ACCESS_TTL,
    refreshTtlDays: raw.JWT_REFRESH_TTL_DAYS,
    issuer: raw.JWT_ISSUER,
    audience: raw.JWT_AUDIENCE,
    adminAudience: raw.JWT_ADMIN_AUDIENCE,
    memberAudience: raw.JWT_MEMBER_AUDIENCE,
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

  /** Real gateway credentials for Member Payments' online-payment flow (Finance module) — distinct from the platform Billing module's sandboxed Stripe/Razorpay/PayPal adapters (Prompt 8), which charge tenants for their own FitCloud subscription and are untouched by this. */
  razorpay: {
    keyId: raw.RAZORPAY_KEY_ID,
    keySecret: raw.RAZORPAY_KEY_SECRET,
    webhookSecret: raw.RAZORPAY_WEBHOOK_SECRET,
    get isConfigured() {
      return Boolean(raw.RAZORPAY_KEY_ID && raw.RAZORPAY_KEY_SECRET);
    },
  },

  /**
   * The ONE place an AI provider/model/key is read from — `AI_PROVIDER`
   * selects which adapter `providers/factory.ts` instantiates; everything
   * else is generic config passed to whichever adapter that is. `ollama`
   * needs no API key (local daemon); every other provider does, so
   * `isConfigured` special-cases it rather than requiring `AI_API_KEY`
   * unconditionally.
   */
  ai: {
    provider: raw.AI_PROVIDER,
    model: raw.AI_MODEL,
    apiKey: raw.AI_API_KEY,
    baseUrl: raw.AI_BASE_URL,
    temperature: raw.AI_TEMPERATURE,
    maxTokens: raw.AI_MAX_TOKENS,
    get isConfigured() {
      return raw.AI_PROVIDER === 'ollama' || Boolean(raw.AI_API_KEY);
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

  sentry: {
    dsn: raw.SENTRY_DSN,
    tracesSampleRate: raw.SENTRY_TRACES_SAMPLE_RATE,
    get isConfigured() {
      return Boolean(raw.SENTRY_DSN);
    },
  },

  storage: {
    endpoint: raw.S3_ENDPOINT,
    region: raw.S3_REGION,
    bucket: raw.S3_BUCKET,
    accessKeyId: raw.S3_ACCESS_KEY_ID,
    secretAccessKey: raw.S3_SECRET_ACCESS_KEY,
    forcePathStyle: raw.S3_FORCE_PATH_STYLE,
    // A CDN/custom domain, or the standard AWS virtual-hosted URL for the bucket.
    publicUrlBase: raw.S3_PUBLIC_URL_BASE ?? (raw.S3_BUCKET ? `https://${raw.S3_BUCKET}.s3.${raw.S3_REGION}.amazonaws.com` : undefined),
    // AWS credentials present → upload to S3. Missing → storage.service.ts falls back to local disk.
    get isConfigured() {
      return Boolean(raw.S3_BUCKET && raw.S3_ACCESS_KEY_ID && raw.S3_SECRET_ACCESS_KEY);
    },
  },
} as const;

export type Env = typeof env;
