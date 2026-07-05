import { env } from '../../config/env';

/**
 * Tenant subdomains are unbounded (any gym can claim any slug), so a static
 * origin allowlist can't cover them all. In non-production, additionally
 * accept any `{slug}.localhost` or `{slug}.{PLATFORM_DOMAIN}` origin —
 * exactly the hosts the tenant-web dev/test setup actually uses — while
 * still honoring the explicit CORS_ORIGINS allowlist for everything else
 * (platform/admin apps, staging, production).
 */
const DEV_SUBDOMAIN_PATTERN = new RegExp(
  `^https?://[a-z0-9-]+\\.(localhost|${env.platformDomain.replace(/\./g, '\\.')})(:\\d+)?$`,
);

export function isAllowedOrigin(origin: string): boolean {
  if (env.corsOrigins.includes(origin)) return true;
  if (!env.isProduction && DEV_SUBDOMAIN_PATTERN.test(origin)) return true;
  return false;
}
