import { cache } from '../../../infrastructure/cache/redis';
import { prisma } from '../../../infrastructure/database/prisma';
import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { IRoleRepository } from '../interfaces/repositories.interface';

const permVerKey = (tenantId: string, userId: string) => `permver:${tenantId}:${userId}`;

/**
 * Roles/permissions are looked up through the RAW client for the system
 * -role catalog (tenantId IS NULL rows — no tenant context needed to read
 * a shared, tenant-agnostic catalog) but writes to the per-user assignment
 * (user_roles) go through the tenant-scoped client so RLS still governs
 * who can be linked to whom.
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
    return rows.map((r) => r.role.name);
  }

  async getPermissionKeysForUser(tenantId: string, userId: string): Promise<string[]> {
    const rows = await this.db.userRole.findMany({
      where: { userId },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });
    const keys = new Set<string>();
    for (const userRole of rows) {
      for (const rp of userRole.role.rolePermissions) {
        keys.add(rp.permission.key);
      }
    }
    return [...keys];
  }

  async getPermissionVersion(tenantId: string, userId: string): Promise<number> {
    const cached = await cache.get<number>(permVerKey(tenantId, userId));
    if (cached !== null) return cached;
    await cache.set(permVerKey(tenantId, userId), 1, 3600);
    return 1;
  }

  private async bumpPermissionVersion(tenantId: string, userId: string): Promise<void> {
    const current = await this.getPermissionVersion(tenantId, userId);
    await cache.set(permVerKey(tenantId, userId), current + 1, 3600);
  }
}
