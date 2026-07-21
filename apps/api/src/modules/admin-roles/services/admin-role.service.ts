import { randomBytes } from 'node:crypto';

import bcrypt from '@node-rs/bcrypt';

import { env } from '../../../config/env';
import { AppError, ConflictError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { prisma } from '../../../infrastructure/database/prisma';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';
import { adminUserRepository } from '../../admin-auth/repositories/admin-user.repository';

export class AdminRoleService {
  async listPermissions() {
    return prisma.adminPermission.findMany({ orderBy: { key: 'asc' } });
  }

  async listRoles() {
    return prisma.adminRole.findMany({
      include: { rolePermissions: { include: { permission: true } }, _count: { select: { adminUsers: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createRole(input: { name: string; description?: string; permissionKeys: string[] }, adminUserId: string, adminRole: string) {
    const role = await prisma.adminRole.create({ data: { name: input.name, description: input.description, isSystem: false } });
    await this.setRolePermissions(role.id, input.permissionKeys);
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.role_created', entityType: 'AdminRole', entityId: role.id });
    return prisma.adminRole.findUnique({ where: { id: role.id }, include: { rolePermissions: { include: { permission: true } } } });
  }

  async updateRolePermissions(roleId: string, permissionKeys: string[], adminUserId: string, adminRole: string) {
    const role = await prisma.adminRole.findUnique({ where: { id: roleId } });
    if (!role) throw new AppError(ErrorCode.NOT_FOUND, 'Role not found', 404);
    if (role.isSystem) throw new ConflictError(ErrorCode.CONFLICT, 'System roles have fixed permissions — create a custom role instead.');

    await this.setRolePermissions(roleId, permissionKeys);
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.role_permissions_updated', entityType: 'AdminRole', entityId: roleId, after: { permissionKeys } });
    return prisma.adminRole.findUnique({ where: { id: roleId }, include: { rolePermissions: { include: { permission: true } } } });
  }

  private async setRolePermissions(roleId: string, permissionKeys: string[]): Promise<void> {
    const permissions = await prisma.adminPermission.findMany({ where: { key: { in: permissionKeys } } });
    await prisma.adminRolePermission.deleteMany({ where: { roleId } });
    await prisma.adminRolePermission.createMany({ data: permissions.map((p) => ({ roleId, permissionId: p.id })) });
  }

  // ── Admin staff directory ──
  async listAdmins(params: { page: number; limit: number; search?: string }) {
    const skip = (params.page - 1) * params.limit;
    const { total, items } = await adminUserRepository.list({ search: params.search, skip, take: params.limit });
    return {
      items: items.map((a) => ({ id: a.id, name: a.name, email: a.email, role: a.role.name, status: a.status, lastLoginAt: a.lastLoginAt, createdAt: a.createdAt })),
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async createAdmin(input: { name: string; email: string; roleId: string }, actorAdminId: string, actorRole: string) {
    const existing = await adminUserRepository.findByEmail(input.email);
    if (existing) throw new ConflictError(ErrorCode.CONFLICT, 'An admin with this email already exists.');

    const temporaryPassword = randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, env.security.bcryptSaltRounds);
    const admin = await adminUserRepository.create({ name: input.name, email: input.email, passwordHash, roleId: input.roleId });

    await adminAuditLogRepository.record({ adminUserId: actorAdminId, actorRole, action: 'admin.admin_user_created', entityType: 'AdminUser', entityId: admin.id });
    // Returned once, directly — this admin portal has no outbound admin-invite email flow yet (documented scope boundary, same as the templates table).
    return { id: admin.id, name: admin.name, email: admin.email, temporaryPassword };
  }

  async updateRole(adminUserId: string, roleId: string, actorAdminId: string, actorRole: string) {
    const admin = await adminUserRepository.updateRole(adminUserId, roleId);
    await adminAuditLogRepository.record({ adminUserId: actorAdminId, actorRole, action: 'admin.admin_user_role_changed', entityType: 'AdminUser', entityId: adminUserId, after: { roleId } });
    return admin;
  }

  async setStatus(adminUserId: string, status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED', actorAdminId: string, actorRole: string) {
    const admin = await adminUserRepository.updateStatus(adminUserId, status);
    await adminAuditLogRepository.record({ adminUserId: actorAdminId, actorRole, action: 'admin.admin_user_status_changed', entityType: 'AdminUser', entityId: adminUserId, after: { status } });
    return admin;
  }
}

export const adminRoleService = new AdminRoleService();
