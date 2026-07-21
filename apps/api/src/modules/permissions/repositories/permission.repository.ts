import { prisma } from '../../../infrastructure/database/prisma';
import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

/**
 * The permission catalog is global (shared by all tenants, no RLS); the
 * matrix additionally reads this tenant's custom roles through the scoped
 * client. Designed for a large registry — the list query is a single
 * indexed scan, the matrix two queries regardless of catalog size.
 */
export class PermissionRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async listAll() {
    return prisma.permission.findMany({ orderBy: { key: 'asc' } });
  }

  async listRolesWithPermissionKeys(tenantId: string) {
    const [system, custom] = await Promise.all([
      prisma.role.findMany({
        where: { tenantId: null, isSystem: true },
        include: { rolePermissions: { include: { permission: { select: { key: true } } } } },
        orderBy: { priority: 'desc' },
      }),
      this.db.role.findMany({
        where: { tenantId },
        include: { rolePermissions: { include: { permission: { select: { key: true } } } } },
        orderBy: [{ priority: 'desc' }, { name: 'asc' }],
      }),
    ]);
    return [...system, ...custom];
  }
}
