import type { NextFunction, Request, Response } from 'express';

import { env } from '../../../config/env';
import { TenantError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { updateRequestContext } from '../../../core/logging/request-context';
import { tenantService } from '../service/tenant.service';
import { RESERVED_SLUGS } from '../types/tenant.types';

/** Routes that intentionally run with no tenant context (platform plane). */
const PLATFORM_ONLY_PATHS = new Set(['/health', '/api/docs', '/api/docs.json']);

function isPlatformOnlyPath(path: string): boolean {
  return PLATFORM_ONLY_PATHS.has(path) || path.startsWith('/api/docs');
}

/**
 * Extracts the tenant slug from the request. In production this is always
 * the subdomain of Host (`goldgym.fitcloud.com` → `goldgym`); for API
 * clients that can't rely on DNS wildcards (mobile, tests, curl), an
 * explicit `X-Tenant-Slug` header is accepted as a fallback — the JWT's
 * own tenantId claim is still the actual authority once authenticated
 * (see authenticate.middleware.ts), so this header is only a routing hint.
 */
function extractSlug(req: Request): string | null {
  const host = (req.headers.host ?? '').split(':')[0]?.toLowerCase() ?? '';
  const headerSlug = (req.headers['x-tenant-slug'] as string | undefined)?.toLowerCase().trim();

  if (host.endsWith(`.${env.platformDomain}`)) {
    const label = host.slice(0, -(env.platformDomain.length + 1));
    if (label && !label.includes('.') && !RESERVED_SLUGS.has(label)) return label;
  }
  if (host.endsWith('.localhost')) {
    const label = host.slice(0, -'.localhost'.length);
    if (label && !RESERVED_SLUGS.has(label)) return label;
  }
  if (headerSlug && !RESERVED_SLUGS.has(headerSlug)) return headerSlug;

  return null;
}

/**
 * Registration and the platform's own health/docs endpoints run WITHOUT a
 * tenant (there's no gym to resolve yet). Every other route requires one.
 * `req.tenant` is attached either way — `null` on platform routes.
 */
export function tenantMiddleware(platformRoutePrefixes: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isPlatformRoute =
        isPlatformOnlyPath(req.path) || platformRoutePrefixes.some((prefix) => req.path.startsWith(prefix));

      // Platform routes (registration, health, docs) never resolve a tenant —
      // even if a stray X-Tenant-Slug header is present — since by definition
      // they run before any tenant exists or without one entirely.
      if (isPlatformRoute) {
        req.tenant = null;
        next();
        return;
      }

      const slug = extractSlug(req);
      if (!slug) {
        throw new TenantError(ErrorCode.TENANT_NOT_FOUND, 'Unable to determine which gym this request is for', 400);
      }

      const resolved = await tenantService.resolveBySlug(slug);
      if (!resolved) {
        throw new TenantError(ErrorCode.TENANT_NOT_FOUND, `No gym found for "${slug}"`, 404);
      }

      tenantService.assertTenantAccessible(resolved.record);

      req.tenant = resolved.tenant;
      updateRequestContext({ tenantId: resolved.tenant.id, tenantSlug: resolved.tenant.slug });
      next();
    } catch (error) {
      next(error);
    }
  };
}
