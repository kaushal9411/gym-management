import type { NextFunction, Request, Response } from 'express';

import { ForbiddenError, UnauthenticatedError } from '../../../core/errors/app-error';
import { cache } from '../../../infrastructure/cache/redis';
import { adminUserRepository } from '../repositories/admin-user.repository';

const PERMISSION_CACHE_TTL_SECONDS = 1800;
const cacheKey = (adminUserId: string, permVer: number) => `admin-perm:${adminUserId}:${permVer}`;

/** Cache-aside permission keys for the calling admin (same cache as `requireAdminPermission`). */
export async function getAdminPermissions(admin: {
  sub: string;
  permVer: number;
}): Promise<string[]> {
  const key = cacheKey(admin.sub, admin.permVer);
  let permissions = await cache.get<string[]>(key);
  if (!permissions) {
    permissions = await adminUserRepository.getPermissionKeys(admin.sub);
    await cache.set(key, permissions, PERMISSION_CACHE_TTL_SECONDS);
  }
  return permissions;
}

/** PBAC for the admin portal — requires adminAuthenticateMiddleware to have run first. */
export function requireAdminPermission(permissionKey: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.admin) throw new UnauthenticatedError();

      const permissions = await getAdminPermissions(req.admin);
      if (!permissions.includes(permissionKey)) {
        throw new ForbiddenError(`Missing required permission: ${permissionKey}`);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
