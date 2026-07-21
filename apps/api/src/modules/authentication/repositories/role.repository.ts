import { cache } from '../../../infrastructure/cache/redis';
import { prisma } from '../../../infrastructure/database/prisma';
import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { mergeEffectivePermissions } from '../../permissions/utils/effective-permissions.util';
import type { IRoleRepository } from '../interfaces/repositories.interface';

const permissionSetKey = (userId: string, permVer: number) => `perm:${userId}:${permVer}`;

/**
 * Roles/permissions are looked up through the RAW client for the system
 * -role catalog (tenantId IS NULL rows — no tenant context needed to read
 * a shared, tenant-agnostic catalog) but writes to the per-user assignment
 * (user_roles) go through the tenant-scoped client so RLS still governs
 * who can be linked to whom.
 *
 * Since Prompt 11 the permission version is PERSISTED on the user row
 * (users.permission_version) instead of living only in Redis — a cache
 * eviction or restart can no longer silently reset it, so stale permission
 * sets can't outlive a role change.
 */
export class RoleRepository implements IRoleRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async assignSystemRole(tenantId: string, userId: string, roleName: string): Promise<void> {
    const role = await prisma.role.findFirst({ where: { tenantId: null, name: roleName, isSystem: true } });
    if (!role) {
      throw new Error(`System role "${roleName}" is not seeded — run the prisma seed script`);
    }
    await this.db.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      create: { userId, roleId: role.id },
      update: {},
    });
    await this.bumpPermissionVersion(tenantId, userId);
  }

  async getRoleNamesForUser(tenantId: string, userId: string): Promise<string[]> {
    const rows = await this.db.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    // Highest-priority role first, so callers using [0] as "primary role" get the strongest one.
    return rows.sort((a, b) => b.role.priority - a.role.priority).map((r) => r.role.name);
  }

  /**
   * Effective permission set — the single source of truth every consumer
   * (authorize middleware, JWT claims, /auth/me) flows through:
   *   union(role permissions) + user GRANT overrides − user DENY overrides.
   */
  async getPermissionKeysForUser(tenantId: string, userId: string): Promise<string[]> {
    const [roleRows, overrides] = await Promise.all([
      this.db.userRole.findMany({
        where: { userId },
        include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
      }),
      this.db.userPermission.findMany({
        where: { userId },
        include: { permission: true },
      }),
    ]);

    return mergeEffectivePermissions(
      roleRows.flatMap((userRole) => userRole.role.rolePermissions.map((rp) => rp.permission.key)),
      overrides.map((o) => ({ key: o.permission.key, mode: o.mode })),
    );
  }

  async getPermissionVersion(tenantId: string, userId: string): Promise<number> {
    const user = await this.db.user.findFirst({ where: { id: userId }, select: { permissionVersion: true } });
    return user?.permissionVersion ?? 1;
  }

  /**
   * Increments the persisted version AND deletes the permission-set cache
   * for the version still embedded in live access tokens — so a permission
   * change takes effect on the very next request, not after cache TTL or
   * token expiry.
   */
  async bumpPermissionVersion(tenantId: string, userId: string): Promise<void> {
    const previous = await this.getPermissionVersion(tenantId, userId);
    await this.db.user.update({ where: { id: userId }, data: { permissionVersion: { increment: 1 } } });
    await cache.del(permissionSetKey(userId, previous));
  }
}
