import type { Request } from 'express';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

import { env } from '../../config/env';
import { redis } from '../../infrastructure/cache/redis';
import { RateLimitedError } from '../errors/app-error';

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  /** Distinct Redis key prefix per limiter so limits don't bleed into each other. */
  prefix: string;
  /** Defaults to IP + resolved tenant; override for per-email limiters (login, OTP). */
  keyGenerator?: (req: Request) => string;
  /** Requests matching this predicate bypass the limiter entirely (e.g. gateway webhooks). */
  skip?: (req: Request) => boolean;
}

/**
 * Tiered, Redis-backed rate limiting (survives restarts, shared across
 * instances — unlike the in-memory default store). Auth endpoints get
 * stricter limiters than the rest of the API. Disabled under `NODE_ENV=test`
 * so the integration suite (real requests via supertest) never trips a
 * limiter across repeated CI runs sharing the same Redis instance.
 */
export function createRateLimiter({ windowMs, max, prefix, keyGenerator, skip }: RateLimiterOptions) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      prefix: `rl:${prefix}:`,
      sendCommand: (...args: string[]) => redis.call(args[0] as string, ...args.slice(1)) as Promise<never>,
    }),
    keyGenerator: keyGenerator ?? ((req) => `${req.tenant?.id ?? 'platform'}:${req.ip}`),
    skip: (req) => env.isTest || (skip?.(req) ?? false),
    handler: () => {
      throw new RateLimitedError();
    },
  });
}

/**
 * App-wide backstop — every other limiter here targets one specific
 * brute-force-sensitive endpoint; this one covers everything else, which
 * today has no throttling at all. Generous enough not to bother a real
 * tenant's normal dashboard/report traffic (or Playwright E2E runs), tight
 * enough to stop a scraping/credential-stuffing script hammering the API.
 * Gateway webhooks are exempted — Stripe/Razorpay legitimately burst-retry
 * and are already authenticated via signature verification, not this.
 */
export function apiRateLimiter() {
  return createRateLimiter({
    windowMs: 60_000,
    max: 300,
    prefix: 'api',
    skip: (req) => req.path.startsWith(`/api/${env.apiVersion}/webhook`),
  });
}

/** By email+tenant — the actual brute-force surface, independent of shared IPs (NAT, offices). */
export function loginRateLimiter() {
  return createRateLimiter({
    windowMs: 15 * 60_000,
    max: 10,
    prefix: 'login',
    keyGenerator: (req) => `${req.tenant?.id ?? 'platform'}:${String(req.body?.email ?? req.ip).toLowerCase()}`,
  });
}

export function registrationRateLimiter() {
  return createRateLimiter({ windowMs: 60 * 60_000, max: 5, prefix: 'register' });
}

export function otpRateLimiter() {
  return createRateLimiter({
    windowMs: 60_000,
    max: 3,
    prefix: 'otp',
    keyGenerator: (req) => `${req.tenant?.id ?? 'platform'}:${String(req.body?.email ?? req.ip).toLowerCase()}`,
  });
}

export function passwordResetRateLimiter() {
  return createRateLimiter({
    windowMs: 15 * 60_000,
    max: 5,
    prefix: 'pwreset',
    keyGenerator: (req) => `${req.tenant?.id ?? 'platform'}:${String(req.body?.email ?? req.ip).toLowerCase()}`,
  });
}
