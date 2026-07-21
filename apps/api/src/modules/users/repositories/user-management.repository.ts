import type { Prisma, UserStatus } from '@prisma/client';

import { prisma } from '../../../infrastructure/database/prisma';
import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { ListUsersQuery } from '../dto/user.dto';

const LIST_INCLUDE = {
  userRoles: { include: { role: true } },
  userBranches: { include: { branch: true } },
} satisfies Prisma.UserInclude;

const DETAIL_INCLUDE = {
  ...LIST_INCLUDE,
  userPermissions: { include: { permission: true } },
} satisfies Prisma.UserInclude;

export type UserWithAccess = Prisma.UserGetPayload<{ include: typeof LIST_INCLUDE }>;
export type UserWithFullAccess = Prisma.UserGetPayload<{ include: typeof DETAIL_INCLUDE }>;

function buildWhere(tenantId: string, query: ListUsersQuery): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { tenantId };

  if (!query.includeDeleted) where.deletedAt = null;
  if (query.status) where.status = query.status;
  if (query.roleId) where.userRoles = { some: { roleId: query.roleId } };
  if (query.branchId) {
    // "Has access to branch X" = explicit assignment OR blanket all-branches access.
    where.OR = [{ allBranches: true }, { userBranches: { some: { branchId: query.branchId } } }];
  }
  if (query.search) {
    const contains = { contains: query.search, mode: 'insensitive' as const };
    where.AND = [{ OR: [{ name: contains }, { email: contains }, { phone: contains }] }];
  }
  if (query.createdFrom || query.createdTo) {
    where.createdAt = {
      ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
      ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
    };
  }
  if (query.lastLoginFrom || query.lastLoginTo) {
    where.lastLoginAt = {
      ...(query.lastLoginFrom ? { gte: new Date(query.lastLoginFrom) } : {}),
      ...(query.lastLoginTo ? { lte: new Date(query.lastLoginTo) } : {}),
    };
  }
  return where;
}

export class UserManagementRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, query: ListUsersQuery): Promise<{ items: UserWithAccess[]; total: number }> {
    const where = buildWhere(tenantId, query);
    const [items, total] = await Promise.all([
      this.db.user.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: { [query.sortBy]: query.sortDir },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.user.count({ where }),
    ]);
    return { items, total };
  }

  async findDetail(tenantId: string, userId: string): Promise<UserWithFullAccess | null> {
    return this.db.user.findFirst({ where: { tenantId, id: userId }, include: DETAIL_INCLUDE });
  }

  /** Includes soft-deleted rows — duplicate checks must see them (email stays reserved). */
  async findByEmail(tenantId: string, email: string) {
    return this.db.user.findFirst({ where: { tenantId, email: email.toLowerCase() } });
  }

  async findByPhone(tenantId: string, phone: string) {
    return this.db.user.findFirst({ where: { tenantId, phone, deletedAt: null } });
  }

  async create(data: Prisma.UserUncheckedCreateInput): Promise<UserWithAccess> {
    const user = await this.db.user.create({ data });
    return (await this.db.user.findFirst({ where: { id: user.id }, include: LIST_INCLUDE }))!;
  }

  async update(userId: string, data: Prisma.UserUncheckedUpdateInput): Promise<void> {
    await this.db.user.update({ where: { id: userId }, data });
  }

  async setStatus(userId: string, status: UserStatus): Promise<void> {
    await this.db.user.update({ where: { id: userId }, data: { status } });
  }

  async softDelete(userId: string): Promise<void> {
    await this.db.user.update({ where: { id: userId }, data: { deletedAt: new Date(), status: 'DEACTIVATED' } });
  }

  async restore(userId: string): Promise<void> {
    await this.db.user.update({ where: { id: userId }, data: { deletedAt: null, status: 'ACTIVE' } });
  }

  /**
   * Replaces the user's full role set. user_roles is a global link table
   * (no RLS) — the service verifies the user belongs to this tenant first.
   */
  async setRoles(userId: string, roleIds: string[]): Promise<void> {
    await prisma.$transaction([
      prisma.userRole.deleteMany({ where: { userId } }),
      prisma.userRole.createMany({ data: roleIds.map((roleId) => ({ userId, roleId })) }),
    ]);
  }

  async setBranches(
    tenantId: string,
    userId: string,
    allBranches: boolean,
    branches: Array<{ branchId: string; isPrimary?: boolean; expiresAt?: string }>,
  ): Promise<void> {
    await this.db.user.update({ where: { id: userId }, data: { allBranches } });
    await this.db.userBranch.deleteMany({ where: { userId } });
    if (!allBranches && branches.length > 0) {
      await this.db.userBranch.createMany({
        data: branches.map((b) => ({
          tenantId,
          userId,
          branchId: b.branchId,
          isPrimary: b.isPrimary ?? false,
          expiresAt: b.expiresAt ? new Date(b.expiresAt) : null,
        })),
      });
    }
  }

  async setPermissionOverrides(
    tenantId: string,
    userId: string,
    overrides: Array<{ permissionId: string; mode: 'GRANT' | 'DENY' }>,
  ): Promise<void> {
    await this.db.userPermission.deleteMany({ where: { userId } });
    if (overrides.length > 0) {
      await this.db.userPermission.createMany({
        data: overrides.map((o) => ({ tenantId, userId, permissionId: o.permissionId, mode: o.mode })),
      });
    }
  }

  /** Every non-deleted user holding the OWNER system role — the "sole owner" guard reads this. */
  async ownerUserIds(tenantId: string): Promise<string[]> {
    const rows = await this.db.userRole.findMany({
      where: { role: { tenantId: null, name: 'OWNER', isSystem: true }, user: { tenantId, deletedAt: null } },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  /** Unpaginated projection for CSV export (capped). */
  async listForExport(tenantId: string, cap = 10_000): Promise<UserWithAccess[]> {
    return this.db.user.findMany({
      where: { tenantId, deletedAt: null },
      include: LIST_INCLUDE,
      orderBy: { createdAt: 'asc' },
      take: cap,
    });
  }
}
