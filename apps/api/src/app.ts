import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import { v1Router } from './api/v1/router';
import { env } from './config/env';
import { isAllowedOrigin } from './core/http/cors-origin';
import { sendSuccess } from './core/http/response';
import { errorHandlerMiddleware, notFoundMiddleware } from './core/middleware/error-handler.middleware';
import { requestContextMiddleware } from './core/middleware/request-context.middleware';
import { requestLoggerMiddleware } from './core/middleware/request-logger.middleware';
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

  app.use(
    helmet({
      contentSecurityPolicy: env.isProduction ? undefined : false,
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
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
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

  app.get('/health', (_req, res) => sendSuccess(res, { status: 'ok', uptimeSeconds: process.uptime() }));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

  app.use(tenantMiddleware(PLATFORM_ROUTE_PREFIXES));
  app.use(`/api/${env.apiVersion}`, v1Router);

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}
