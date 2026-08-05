import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import { v1Router } from './api/v1/router';
import { env } from './config/env';
import { checkHealth } from './core/health/health-check.util';
import { isAllowedOrigin } from './core/http/cors-origin';
import { sendError, sendSuccess } from './core/http/response';
import { errorHandlerMiddleware, notFoundMiddleware } from './core/middleware/error-handler.middleware';
import { apiRateLimiter } from './core/middleware/rate-limiter';
import { requestContextMiddleware } from './core/middleware/request-context.middleware';
import { requestLoggerMiddleware } from './core/middleware/request-logger.middleware';
import { requestTimeoutMiddleware } from './core/middleware/request-timeout.middleware';
import { swaggerSpec } from './core/swagger/swagger';
import { tenantMiddleware } from './modules/tenants/middleware/tenant.middleware';

/**
 * Routes that run without a resolved tenant — registration, the entire
 * SaaS onboarding wizard (there's no gym to resolve a subdomain against
 * until the wizard's last step creates one), platform infra, gateway
 * webhooks (the calling gateway has no notion of our tenant subdomains —
 * see webhook.controller.ts's cross-tenant Payment lookup by id), and the
 * ENTIRE Super Admin portal (`admin.fitcloud.com` has no tenant subdomain
 * concept at all — it is a separate authority plane, not a "tenant" of
 * anything; see admin-jwt.service.ts).
 */
const PLATFORM_ROUTE_PREFIXES = [
  `/api/${env.apiVersion}/auth/register`,
  `/api/${env.apiVersion}/onboarding`,
  `/api/${env.apiVersion}/public`,
  `/api/${env.apiVersion}/webhook`,
  `/api/${env.apiVersion}/admin`,
];

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind Nginx/Cloudflare — req.ip reflects the real client

  // Every response from this API is pure JSON — there is no legitimate
  // reason for one to load a script/image/frame/anything, so the default is
  // maximally locked down rather than helmet's own generic
  // `default-src 'self'` (which implies a "self" page worth trusting that
  // doesn't exist here). Enabled in every environment, not just production
  // — a JSON API response is never affected by this, so there's no dev-mode
  // cost to leaving it on, and it keeps local testing honest. `/api/docs`
  // (Swagger UI, mounted below) overrides this with its own, more
  // permissive CSP — `helmet()` calls `res.setHeader`, so a second call
  // later in the chain for that path genuinely replaces this one; passing
  // `contentSecurityPolicy: false` there instead would NOT work, since a
  // disabled directive just skips setting the header rather than clearing
  // whatever an earlier middleware already set.
  app.use(
    helmet({
      contentSecurityPolicy: {
        // Every directive explicit and 'none' — helmet fills in its own
        // (less strict) defaults for anything left unspecified, which would
        // otherwise quietly undermine "maximally locked down" with e.g. its
        // default `img-src 'self' data:` or `style-src 'self' https:
        // 'unsafe-inline'`. This app never legitimately needs any of them.
        directives: {
          defaultSrc: ["'none'"],
          scriptSrc: ["'none'"],
          styleSrc: ["'none'"],
          imgSrc: ["'none'"],
          fontSrc: ["'none'"],
          connectSrc: ["'none'"],
          formAction: ["'none'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        // No Origin header (curl, server-to-server, same-origin) — allow.
        if (!origin || isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`Origin not allowed: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Slug', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use(requestContextMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(requestTimeoutMiddleware());

  // Real connectivity checks (Postgres `SELECT 1`, Redis `PING`), not a
  // "the process is alive" no-op — a load balancer/uptime monitor needs to
  // know when the app can't actually serve traffic, not just that Node is
  // running. 503 only when the database is down (nothing works without it);
  // Redis-down alone is 'degraded' but still 200 (sessions/rate-limiting/
  // caching misbehave, most traffic still serves).
  app.get('/health', async (_req, res) => {
    const result = await checkHealth();
    if (result.status === 'unhealthy') {
      sendError(res, 503, 'Service unavailable', [{ code: 'UNHEALTHY', message: 'Database is unreachable' }], result);
      return;
    }
    sendSuccess(res, result, result.status === 'degraded' ? 'Degraded' : 'OK');
  });

  // Swagger UI ships an inline bootstrap script/style — it genuinely needs
  // `'unsafe-inline'`, which the app-wide CSP above deliberately doesn't
  // grant anything. This replaces (not weakens app-wide) that header for
  // just this one path — see the comment on the app-wide `helmet()` call.
  app.use(
    '/api/docs',
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec),
  );
  app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

  app.use(tenantMiddleware(PLATFORM_ROUTE_PREFIXES));
  app.use(apiRateLimiter());
  app.use(`/api/${env.apiVersion}`, v1Router);

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}
