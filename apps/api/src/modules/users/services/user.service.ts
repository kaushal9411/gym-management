import { AppError, ConflictError, NotFoundError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { passwordService } from '../../../core/security/password.service';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import { RoleRepository } from '../../authentication/repositories/role.repository';
import { SessionRepository } from '../../authentication/repositories/session.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import { RoleManagementRepository } from '../../roles/repositories/role-management.repository';
import type {
  BulkImportResult,
  BulkImportRow,
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
  UserDetailDto,
  UserListItemDto,
} from '../dto/user.dto';
import {
  UserManagementRepository,
  type UserWithAccess,
  type UserWithFullAccess,
} from '../repositories/user-management.repository';

/** Platform-plane role — never assignable through the tenant portal. */
const UNASSIGNABLE_ROLES = new Set(['SUPER_ADMIN']);

function toListItem(user: UserWithAccess): UserListItemDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    status: user.status,
    avatarUrl: user.avatarUrl,
    roles: user.userRoles
      .sort((a, b) => b.role.priority - a.role.priority)
      .map((ur) => ({ id: ur.role.id, name: ur.role.name, isSystem: ur.role.isSystem })),
    allBranches: user.allBranches,
    branches: user.userBranches.map((ub) => ({
      branchId: ub.branchId,
      branchName: ub.branch.name,
      isPrimary: ub.isPrimary,
      expiresAt: ub.expiresAt?.toISOString() ?? null,
    })),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    deletedAt: user.deletedAt?.toISOString() ?? null,
  };
}

export class UserService {
  private readonly repository: UserManagementRepository;
  private readonly roleManagement: RoleManagementRepository;
  private readonly authRoleRepository: RoleRepository;
  private readonly sessionRepository: SessionRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    const db = getTenantScopedClient(tenantId);
    this.repository = new UserManagementRepository(db);
    this.roleManagement = new RoleManagementRepository(db);
    this.authRoleRepository = new RoleRepository(db);
    this.sessionRepository = new SessionRepository(db);
    this.auditLog = new AuditLogRepository(db);
  }

  async list(query: ListUsersQuery) {
    const { items, total } = await this.repository.list(this.tenantId, query);
    return {
      items: items.map(toListItem),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async getById(userId: string): Promise<UserDetailDto> {
    const user = await this.mustFind(userId);
    const effectivePermissions = await this.authRoleRepository.getPermissionKeysForUser(this.tenantId, userId);
    return {
      ...toListItem(user),
      emergencyContactName: user.emergencyContactName,
      emergencyContactPhone: user.emergencyContactPhone,
      emergencyContactRelation: user.emergencyContactRelation,
      notificationPreferences: (user.notificationPreferences as Record<string, boolean> | null) ?? null,
      permissionOverrides: user.userPermissions.map((up) => ({ key: up.permission.key, mode: up.mode })),
      effectivePermissions: effectivePermissions.sort(),
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async create(input: CreateUserInput, actor: IamActor): Promise<UserDetailDto> {
    await this.assertEmailAvailable(input.email);
    if (input.phone) await this.assertPhoneAvailable(input.phone);
    await this.assertRolesAssignable(input.roleIds);

    const passwordHash = await passwordService.hash(input.password);
    // Admin-created accounts skip email verification — the owner vouches for them.
    const user = await this.repository.create({
      tenantId: this.tenantId,
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      passwordHash,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      allBranches: input.allBranches ?? true,
    });

    await this.repository.setRoles(user.id, input.roleIds);
    if (input.allBranches === false && input.branches) {
      await this.repository.setBranches(this.tenantId, user.id, false, input.branches);
    }
    await this.authRoleRepository.bumpPermissionVersion(this.tenantId, user.id);
    await this.audit(actor, 'iam.user_created', user.id);
    return this.getById(user.id);
  }

  async update(userId: string, input: UpdateUserInput, actor: IamActor): Promise<UserDetailDto> {
    const user = await this.mustFind(userId);
    if (input.email && input.email.toLowerCase() !== user.email) {
      await this.assertEmailAvailable(input.email);
    }
    if (input.phone && input.phone !== user.phone) {
      await this.assertPhoneAvailable(input.phone);
    }
    await this.repository.update(userId, {
      name: input.name,
      email: input.email?.toLowerCase(),
      phone: input.phone,
      avatarUrl: input.avatarUrl,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      emergencyContactRelation: input.emergencyContactRelation,
    });
    await this.audit(actor, 'iam.user_updated', userId);
    return this.getById(userId);
  }

  async suspend(userId: string, actor: IamActor): Promise<void> {
    await this.guardStatusChange(userId, actor, 'suspend');
    await this.repository.setStatus(userId, 'SUSPENDED');
    await this.sessionRepository.revokeAllForUser(this.tenantId, userId);
    await this.audit(actor, 'iam.user_suspended', userId);
  }

  async deactivate(userId: string, actor: IamActor): Promise<void> {
    await this.guardStatusChange(userId, actor, 'deactivate');
    await this.repository.setStatus(userId, 'DEACTIVATED');
    await this.sessionRepository.revokeAllForUser(this.tenantId, userId);
    await this.audit(actor, 'iam.user_deactivated', userId);
  }

  async restore(userId: string, actor: IamActor): Promise<void> {
    const user = await this.mustFind(userId, { includeDeleted: true });
    if (user.deletedAt) {
      await this.repository.restore(userId);
    } else {
      await this.repository.setStatus(userId, 'ACTIVE');
    }
    await this.audit(actor, 'iam.user_restored', userId);
  }

  async softDelete(userId: string, actor: IamActor): Promise<void> {
    await this.guardStatusChange(userId, actor, 'delete');
    await this.repository.softDelete(userId);
    await this.sessionRepository.revokeAllForUser(this.tenantId, userId);
    await this.audit(actor, 'iam.user_deleted', userId);
  }

  async setRoles(userId: string, roleIds: string[], actor: IamActor): Promise<UserDetailDto> {
    const user = await this.mustFind(userId);
    if (userId === actor.userId) {
      throw new AppError(ErrorCode.FORBIDDEN, 'You cannot change your own roles.', 403);
    }
    await this.assertRolesAssignable(roleIds);

    // Never let the tenant end up ownerless.
    const owners = await this.repository.ownerUserIds(this.tenantId);
    const targetIsOwner = owners.includes(userId);
    if (targetIsOwner && owners.length === 1) {
      const ownerRole = user.userRoles.find((ur) => ur.role.name === 'OWNER')?.roleId;
      if (ownerRole && !roleIds.includes(ownerRole)) {
        throw new ConflictError(ErrorCode.CONFLICT, 'This is the only Owner — assign another Owner first.');
      }
    }

    await this.repository.setRoles(userId, roleIds);
    await this.authRoleRepository.bumpPermissionVersion(this.tenantId, userId);
    await this.audit(actor, 'iam.user_roles_updated', userId);
    return this.getById(userId);
  }

  async setBranches(
    userId: string,
    allBranches: boolean,
    branches: Array<{ branchId: string; isPrimary?: boolean; expiresAt?: string }>,
    actor: IamActor,
  ): Promise<UserDetailDto> {
    await this.mustFind(userId);
    await this.assertBranchesExist(branches.map((b) => b.branchId));
    await this.repository.setBranches(this.tenantId, userId, allBranches, branches);
    await this.audit(actor, 'iam.user_branches_updated', userId);
    return this.getById(userId);
  }

  async setPermissionOverrides(
    userId: string,
    overrides: Array<{ key: string; mode: 'GRANT' | 'DENY' }>,
    actor: IamActor,
  ): Promise<UserDetailDto> {
    await this.mustFind(userId);
    const byKey = await this.roleManagement.findPermissionIdsByKeys(overrides.map((o) => o.key));
    const unknown = overrides.filter((o) => !byKey.has(o.key));
    if (unknown.length > 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `Unknown permission key(s): ${unknown.map((o) => o.key).join(', ')}`,
        422,
      );
    }
    await this.repository.setPermissionOverrides(
      this.tenantId,
      userId,
      overrides.map((o) => ({ permissionId: byKey.get(o.key)!, mode: o.mode })),
    );
    await this.authRoleRepository.bumpPermissionVersion(this.tenantId, userId);
    await this.audit(actor, 'iam.user_permissions_updated', userId);
    return this.getById(userId);
  }

  /** CSV export — Excel opens CSV natively; a dedicated XLSX writer can be swapped in later. */
  async exportCsv(): Promise<string> {
    const users = await this.repository.listForExport(this.tenantId);
    const header = 'Name,Email,Phone,Status,Roles,Branch Access,Last Login,Created';
    const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    const rows = users.map((u) =>
      [
        escape(u.name),
        u.email,
        u.phone ?? '',
        u.status,
        escape(u.userRoles.map((ur) => ur.role.name).join('; ')),
        u.allBranches ? 'All branches' : escape(u.userBranches.map((ub) => ub.branch.name).join('; ')),
        u.lastLoginAt?.toISOString() ?? '',
        u.createdAt.toISOString(),
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }

  /**
   * Bulk import — each row independent; one bad row never rolls back the
   * others. Rows without a role fall back to the tenant's default custom
   * role, else the RECEPTIONIST system role.
   */
  async bulkImport(rows: BulkImportRow[], actor: IamActor): Promise<BulkImportResult> {
    const roles = [...(await this.roleManagement.listSystemRoles()), ...(await this.roleManagement.listCustomRoles(this.tenantId))];
    const fallbackRole =
      roles.find((r) => r.tenantId === this.tenantId && r.isDefault) ?? roles.find((r) => r.name === 'RECEPTIONIST');

    const result: BulkImportResult = { created: 0, failed: [] };
    for (const [index, row] of rows.entries()) {
      try {
        const role = row.roleName
          ? roles.find((r) => r.name.toLowerCase() === row.roleName!.toLowerCase() && !UNASSIGNABLE_ROLES.has(r.name))
          : fallbackRole;
        if (!role) throw new Error(`Unknown role "${row.roleName}"`);

        await this.create(
          {
            name: row.name,
            email: row.email,
            phone: row.phone || undefined,
            // Random throwaway when the sheet doesn't provide one — the user resets via "forgot password".
            password: row.password || `Imp0rt!${Math.random().toString(36).slice(2, 10)}A`,
            roleIds: [role.id],
          },
          actor,
        );
        result.created += 1;
      } catch (error) {
        result.failed.push({
          row: index + 1,
          email: row.email,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    return result;
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async mustFind(userId: string, opts?: { includeDeleted?: boolean }): Promise<UserWithFullAccess> {
    const user = await this.repository.findDetail(this.tenantId, userId);
    if (!user || (!opts?.includeDeleted && user.deletedAt)) throw new NotFoundError('User not found.');
    return user;
  }

  private async assertEmailAvailable(email: string): Promise<void> {
    const existing = await this.repository.findByEmail(this.tenantId, email);
    if (existing) throw new ConflictError(ErrorCode.CONFLICT, 'An account with this email already exists.');
  }

  private async assertPhoneAvailable(phone: string): Promise<void> {
    const existing = await this.repository.findByPhone(this.tenantId, phone);
    if (existing) throw new ConflictError(ErrorCode.CONFLICT, 'An account with this phone number already exists.');
  }

  private async assertRolesAssignable(roleIds: string[]): Promise<void> {
    if (roleIds.length === 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Assign at least one role.', 422);
    }
    for (const roleId of roleIds) {
      const role = await this.roleManagement.findById(roleId);
      if (!role || (role.tenantId !== null && role.tenantId !== this.tenantId)) {
        throw new NotFoundError('One of the selected roles does not exist.');
      }
      if (UNASSIGNABLE_ROLES.has(role.name)) {
        throw new AppError(ErrorCode.FORBIDDEN, `The ${role.name} role cannot be assigned here.`, 403);
      }
      if (!role.isActive) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, `Role "${role.name}" is inactive.`, 422);
      }
    }
  }

  private async assertBranchesExist(branchIds: string[]): Promise<void> {
    if (branchIds.length === 0) return;
    const db = getTenantScopedClient(this.tenantId);
    const found = await db.branch.count({ where: { id: { in: branchIds }, tenantId: this.tenantId } });
    if (found !== branchIds.length) throw new NotFoundError('One of the selected branches does not exist.');
  }

  private async guardStatusChange(userId: string, actor: IamActor, verb: string): Promise<void> {
    await this.mustFind(userId);
    if (userId === actor.userId) {
      throw new AppError(ErrorCode.FORBIDDEN, `You cannot ${verb} your own account.`, 403);
    }
    const owners = await this.repository.ownerUserIds(this.tenantId);
    if (owners.includes(userId) && owners.length === 1) {
      throw new ConflictError(ErrorCode.CONFLICT, `This is the only Owner — assign another Owner before you ${verb} them.`);
    }
  }

  private async audit(actor: IamActor, action: string, entityId: string): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType: 'user',
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }
}
