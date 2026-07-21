import { cache } from '../../../infrastructure/cache/redis';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { RoleRepository } from '../../authentication/repositories/role.repository';

const PERMISSION_CACHE_TTL_SECONDS = 1800;
const permissionSetKey = (userId: string, permVer: number) => `perm:${userId}:${permVer}`;

/**
 * The authorization facade every module (Members, Attendance, Payments, …)
 * consumes. Effective permissions = union(role permissions) + per-user
 * GRANTs − per-user DENYs, computed in RoleRepository and cached per
 * (user, permissionVersion). Any role/permission mutation must call
 * `invalidateUser` so the next request recomputes.
 */
export class PermissionEngine {
  async getEffectivePermissions(tenantId: string, userId: string): Promise<string[]> {
    const repository = new RoleRepository(getTenantScopedClient(tenantId));
    const permVer = await repository.getPermissionVersion(tenantId, userId);

    const cacheKey = permissionSetKey(userId, permVer);
    const cached = await cache.get<string[]>(cacheKey);
    if (cached) return cached;

    const permissions = await repository.getPermissionKeysForUser(tenantId, userId);
    await cache.set(cacheKey, permissions, PERMISSION_CACHE_TTL_SECONDS);
    return permissions;
  }

  async hasPermission(tenantId: string, userId: string, permissionKey: string): Promise<boolean> {
    const permissions = await this.getEffectivePermissions(tenantId, userId);
    return permissions.includes(permissionKey);
  }

  /** Bumps the persisted permission version + clears the stale cached set. */
  async invalidateUser(tenantId: string, userId: string): Promise<void> {
    const repository = new RoleRepository(getTenantScopedClient(tenantId));
    await repository.bumpPermissionVersion(tenantId, userId);
  }
}

export const permissionEngine = new PermissionEngine();
