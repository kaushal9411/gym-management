import type { AdminUser, AdminUserStatus } from '@prisma/client';

import { prisma } from '../../../infrastructure/database/prisma';

/**
 * Unlike every tenant repository in this codebase, this one uses the RAW
 * Prisma client directly — admin tables have no tenant_id/RLS to scope by
 * (see the schema's "Super Admin portal" section comment). There is
 * exactly one admin organization, not one per tenant.
 */
export class AdminUserRepository {
  async findByEmail(email: string): Promise<AdminUser | null> {
    return prisma.adminUser.findFirst({ where: { email, deletedAt: null } });
  }

  async findById(id: string): Promise<AdminUser | null> {
    return prisma.adminUser.findFirst({ where: { id, deletedAt: null } });
  }

  async findByIdWithRole(id: string) {
    return prisma.adminUser.findFirst({
      where: { id, deletedAt: null },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });
  }

  async findByEmailWithRole(email: string) {
    return prisma.adminUser.findFirst({
      where: { email, deletedAt: null },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });
  }

  async getPermissionKeys(adminUserId: string): Promise<string[]> {
    const admin = await prisma.adminUser.findUnique({
      where: { id: adminUserId },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });
    return admin?.role.rolePermissions.map((rp) => rp.permission.key) ?? [];
  }

  async recordFailedLogin(adminUserId: string, attempts: number, lockedUntil: Date | null): Promise<void> {
    await prisma.adminUser.update({ where: { id: adminUserId }, data: { failedLoginAttempts: attempts, lockedUntil } });
  }

  async resetFailedLogins(adminUserId: string): Promise<void> {
    await prisma.adminUser.update({ where: { id: adminUserId }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  }

  async touchLastLogin(adminUserId: string): Promise<void> {
    await prisma.adminUser.update({ where: { id: adminUserId }, data: { lastLoginAt: new Date() } });
  }

  async updateStatus(adminUserId: string, status: AdminUserStatus): Promise<AdminUser> {
    return prisma.adminUser.update({ where: { id: adminUserId }, data: { status } });
  }

  async updatePasswordHash(adminUserId: string, passwordHash: string): Promise<void> {
    await prisma.adminUser.update({ where: { id: adminUserId }, data: { passwordHash } });
  }

  async list(params: { search?: string; roleId?: string; skip: number; take: number }) {
    const where = {
      deletedAt: null,
      ...(params.roleId ? { roleId: params.roleId } : {}),
      ...(params.search
        ? { OR: [{ name: { contains: params.search, mode: 'insensitive' as const } }, { email: { contains: params.search, mode: 'insensitive' as const } }] }
        : {}),
    };
    const [total, items] = await Promise.all([
      prisma.adminUser.count({ where }),
      prisma.adminUser.findMany({ where, include: { role: true }, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.take }),
    ]);
    return { total, items };
  }

  async create(input: { name: string; email: string; passwordHash: string; roleId: string }): Promise<AdminUser> {
    return prisma.adminUser.create({ data: input });
  }

  async updateRole(adminUserId: string, roleId: string): Promise<AdminUser> {
    return prisma.adminUser.update({ where: { id: adminUserId }, data: { roleId } });
  }

  async softDelete(adminUserId: string): Promise<void> {
    await prisma.adminUser.update({ where: { id: adminUserId }, data: { deletedAt: new Date(), status: 'DEACTIVATED' } });
  }
}

export const adminUserRepository = new AdminUserRepository();
