import winston from 'winston';

import { env } from '../../config/env';

import { getRequestContext } from './request-context';

const REDACTED = '[REDACTED]';
const SENSITIVE_KEYS = new Set([
  'password',
  'newpassword',
  'confirmpassword',
  'currentpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'code',
  'otp',
  'authorization',
  'cookie',
  'passwordhash',
  'jwt_private_key_b64',
  'jwt_public_key_b64',
]);

/** Deep-redacts known-sensitive field names before anything is logged. */
function redact(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  const output: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? REDACTED : redact(val, depth + 1);
  }
  return output;
}

const contextInjector = winston.format((info) => {
  const ctx = getRequestContext();
  if (ctx) {
    info.requestId = ctx.requestId;
    if (ctx.tenantId) info.tenantId = ctx.tenantId;
    if (ctx.userId) info.userId = ctx.userId;
  }
  return info;
});

const redactor = winston.format((info) => redact(info) as winston.Logform.TransformableInfo);

// `winston.format.colorize()` combined with `simple()` crashes under some
// logform/winston version pairings when stdout isn't a real TTY (notably
// under Vitest) — a cosmetic dev nicety isn't worth that fragility, so
// non-production just gets uncolored human-readable output instead.
const devFormat = winston.format.printf(({ level, message, timestamp, service: _service, env: _env, ...rest }) => {
  const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
  return `${timestamp} [${level}] ${message}${extra}`;
});

export const logger = winston.createLogger({
  level: env.logLevel,
  format: winston.format.combine(
    contextInjector(),
    redactor(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    env.isProduction ? winston.format.json() : devFormat,
  ),
  defaultMeta: { service: '@gym-saas/api', env: env.nodeEnv },
  transports: [new winston.transports.Console()],
});

/** Named child loggers per concern — same transport, easy to filter later. */
export const authLogger = logger.child({ module: 'authentication' });
export const securityLogger = logger.child({ module: 'security' });
export const httpLogger = logger.child({ module: 'http' });
