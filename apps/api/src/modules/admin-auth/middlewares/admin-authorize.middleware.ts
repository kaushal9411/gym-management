import type { NextFunction, Request, Response } from 'express';

import { ForbiddenError, UnauthenticatedError } from '../../../core/errors/app-error';
import { cache } from '../../../infrastructure/cache/redis';
import { adminUserRepository } from '../repositories/admin-user.repository';

const PERMISSION_CACHE_TTL_SECONDS = 1800;
const cacheKey = (adminUserId: string, permVer: number) => `admin-perm:${adminUserId}:${permVer}`;

/** PBAC for the admin portal — requires adminAuthenticateMiddleware to have run first. */
export function requireAdminPermission(permissionKey: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.admin) throw new UnauthenticatedError();

      const key = cacheKey(req.admin.sub, req.admin.permVer);
      let permissions = await cache.get<string[]>(key);
      if (!permissions) {
        permissions = await adminUserRepository.getPermissionKeys(req.admin.sub);
        await cache.set(key, permissions, PERMISSION_CACHE_TTL_SECONDS);
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
