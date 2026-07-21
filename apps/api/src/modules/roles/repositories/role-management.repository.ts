import type { Prisma, Role } from '@prisma/client';

import { prisma } from '../../../infrastructure/database/prisma';
import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

const ROLE_INCLUDE = {
  rolePermissions: { include: { permission: true } },
} satisfies Prisma.RoleInclude;

export type RoleWithPermissions = Prisma.RoleGetPayload<{ include: typeof ROLE_INCLUDE }>;

/**
 * System roles (tenantId NULL) are read through the RAW client — the roles
 * table's RLS policy matches `tenant_id = app.tenant_id`, which by design
 * excludes NULL catalog rows from tenant-scoped reads. Tenant custom roles
 * go through the scoped client so RLS enforces isolation. All guards about
 * WHICH roles may be mutated live in the service.
 */
export class RoleManagementRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async listSystemRoles(): Promise<RoleWithPermissions[]> {
    return prisma.role.findMany({
      where: { tenantId: null, isSystem: true },
      include: ROLE_INCLUDE,
      orderBy: { priority: 'desc' },
    });
  }

  async listCustomRoles(tenantId: string): Promise<RoleWithPermissions[]> {
    return this.db.role.findMany({
      where: { tenantId },
      include: ROLE_INCLUDE,
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    });
  }

  /** Finds by id regardless of system/custom — caller must check tenant ownership. */
  async findById(roleId: string): Promise<RoleWithPermissions | null> {
    return prisma.role.findUnique({ where: { id: roleId }, include: ROLE_INCLUDE });
  }

  async findByName(tenantId: string, name: string): Promise<Role | null> {
    return prisma.role.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, OR: [{ tenantId }, { tenantId: null }] },
    });
  }

  async create(
    tenantId: string,
    data: { name: string; description?: string; priority?: number; isDefault?: boolean },
    permissionIds: string[],
  ): Promise<RoleWithPermissions> {
    const role = await this.db.role.create({
      data: { tenantId, isSystem: false, ...data },
    });
    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
      });
    }
    return (await this.findById(role.id))!;
  }

  async update(
    roleId: string,
    data: { name?: string; description?: string; priority?: number; isDefault?: boolean; isActive?: boolean },
  ): Promise<void> {
    await this.db.role.update({ where: { id: roleId }, data });
  }

  /** Replaces the full permission set of a role. role_permissions is a global link table (no RLS) — service guards ownership. */
  async setPermissions(roleId: string, permissionIds: string[]): Promise<void> {
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId } }),
      prisma.rolePermission.createMany({ data: permissionIds.map((permissionId) => ({ roleId, permissionId })) }),
    ]);
  }

  async delete(roleId: string): Promise<void> {
    await this.db.role.delete({ where: { id: roleId } });
  }

  /** Only this tenant's default flag can be unset — scoped client enforces that. */
  async clearDefaultFlag(tenantId: string): Promise<void> {
    await this.db.role.updateMany({ where: { tenantId, isDefault: true }, data: { isDefault: false } });
  }

  /** Users of THIS tenant holding the role (join through users for tenant safety — user_roles itself has no RLS). */
  async userIdsHoldingRole(tenantId: string, roleId: string): Promise<string[]> {
    const rows = await this.db.userRole.findMany({
      where: { roleId, user: { tenantId, deletedAt: null } },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  async countUsersPerRole(tenantId: string, roleIds: string[]): Promise<Map<string, number>> {
    const rows = await this.db.userRole.groupBy({
      by: ['roleId'],
      where: { roleId: { in: roleIds }, user: { tenantId, deletedAt: null } },
      _count: { userId: true },
    });
    return new Map(rows.map((r) => [r.roleId, r._count.userId]));
  }

  async findPermissionIdsByKeys(keys: string[]): Promise<Map<string, string>> {
    const rows = await prisma.permission.findMany({ where: { key: { in: keys } } });
    return new Map(rows.map((p) => [p.key, p.id]));
  }
}
