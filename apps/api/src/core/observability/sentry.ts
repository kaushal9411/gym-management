import * as Sentry from '@sentry/node';

import { env } from '../../config/env';
import { getRequestContext } from '../logging/request-context';

/**
 * Fully inert when `SENTRY_DSN` is unset — every function below is then a
 * no-op, so this never becomes a required piece of local/dev setup (same
 * `isConfigured`-gated pattern as `env.ai`/`env.razorpay`). Call `initSentry()`
 * once, as early as possible in the process (`server.ts`), before anything
 * that could throw.
 */
export function initSentry(): void {
  if (!env.sentry.isConfigured) return;

  Sentry.init({
    dsn: env.sentry.dsn,
    environment: env.nodeEnv,
    tracesSampleRate: env.sentry.tracesSampleRate,
    // We already redact secrets ourselves (core/logging/logger.ts's
    // SENSITIVE_KEYS) and don't want Sentry independently deciding what
    // counts as PII to attach from request headers/IPs.
    sendDefaultPii: false,
  });
}

/**
 * The one place `errorHandlerMiddleware` reports an unexpected (5xx) error.
 * Tags with the same request/tenant/user identifiers already threaded
 * through Winston via `AsyncLocalStorage`, so a Sentry event and its
 * matching log lines can be cross-referenced by `requestId`.
 */
export function captureError(err: unknown, extra?: Record<string, unknown>): void {
  if (!env.sentry.isConfigured) return;

  const ctx = getRequestContext();
  Sentry.withScope((scope) => {
    if (ctx?.requestId) scope.setTag('requestId', ctx.requestId);
    if (ctx?.tenantId) scope.setTag('tenantId', ctx.tenantId);
    if (ctx?.userId) scope.setTag('userId', ctx.userId);
    if (extra) scope.setExtras(extra);
    Sentry.captureException(err);
  });
}
