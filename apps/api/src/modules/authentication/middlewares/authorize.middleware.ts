import type { NextFunction, Request, Response } from 'express';

import { ForbiddenError, UnauthenticatedError } from '../../../core/errors/app-error';
import { cache } from '../../../infrastructure/cache/redis';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { RoleRepository } from '../repositories/role.repository';

const PERMISSION_CACHE_TTL_SECONDS = 1800;
const permissionSetKey = (userId: string, permVer: number) => `perm:${userId}:${permVer}`;

/**
 * PBAC — Permission-Based Access Control. Requires authenticateMiddleware
 * to have run first (needs `req.auth`). The permission set is cached per
 * (user, permVer) — role changes bump permVer (see role.repository.ts),
 * which naturally invalidates the cache key without an explicit delete.
 *
 * No route in THIS module currently needs a specific permission (auth
 * endpoints are self-service or public) — this middleware exists as the
 * reusable authorization primitive every future module (members, billing,
 * ...) will import. See authorize.middleware.spec.ts for direct coverage.
 */
export function requirePermission(permissionKey: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth || !req.tenant) throw new UnauthenticatedError();

      const cacheKey = permissionSetKey(req.auth.sub, req.auth.permVer);
      let permissions = await cache.get<string[]>(cacheKey);

      if (!permissions) {
        const roleRepository = new RoleRepository(getTenantScopedClient(req.tenant.id));
        permissions = await roleRepository.getPermissionKeysForUser(req.tenant.id, req.auth.sub);
        await cache.set(cacheKey, permissions, PERMISSION_CACHE_TTL_SECONDS);
      }

      if (!permissions.includes(permissionKey)) {
        throw new ForbiddenError(`Missing required permission: ${permissionKey}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Coarse role check — prefer requirePermission for anything more specific than "any staff member". */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(new UnauthenticatedError());
    if (!req.auth.roles.some((role) => allowedRoles.includes(role))) {
      return next(new ForbiddenError(`Requires one of the following roles: ${allowedRoles.join(', ')}`));
    }
    next();
  };
}
