import { AppError, ConflictError, NotFoundError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { eventBus } from '../../../core/events/event-bus';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import { RoleRepository } from '../../authentication/repositories/role.repository';
import type { CreateRoleInput, RoleDto, UpdateRoleInput } from '../dto/role.dto';
import { RoleManagementRepository, type RoleWithPermissions } from '../repositories/role-management.repository';

export interface IamActor {
  userId: string;
  role: string;
  ipAddress?: string;
  userAgent?: string;
}

export const IamEvents = {
  RoleChanged: 'iam.role_changed',
} as const;

function toDto(role: RoleWithPermissions, userCount: number): RoleDto {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    priority: role.priority,
    isDefault: role.isDefault,
    isActive: role.isActive,
    permissions: role.rolePermissions.map((rp) => rp.permission.key).sort(),
    userCount,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}

/**
 * Role management: the six system roles are a shared, immutable catalog
 * (editing one would change every tenant on the platform); tenants create
 * CUSTOM roles for anything beyond them. Every permission-affecting write
 * bumps the permission version of affected users so cached permission sets
 * die immediately.
 */
export class RoleService {
  private readonly repository: RoleManagementRepository;
  private readonly authRoleRepository: RoleRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    const db = getTenantScopedClient(tenantId);
    this.repository = new RoleManagementRepository(db);
    this.authRoleRepository = new RoleRepository(db);
    this.auditLog = new AuditLogRepository(db);
  }

  async list(): Promise<RoleDto[]> {
    const [system, custom] = await Promise.all([
      this.repository.listSystemRoles(),
      this.repository.listCustomRoles(this.tenantId),
    ]);
    const all = [...system, ...custom];
    const counts = await this.repository.countUsersPerRole(
      this.tenantId,
      all.map((r) => r.id),
    );
    return all.map((role) => toDto(role, counts.get(role.id) ?? 0));
  }

  async getById(roleId: string): Promise<RoleDto> {
    const role = await this.assertVisible(roleId);
    const counts = await this.repository.countUsersPerRole(this.tenantId, [roleId]);
    return toDto(role, counts.get(roleId) ?? 0);
  }

  async create(input: CreateRoleInput, actor: IamActor): Promise<RoleDto> {
    await this.assertNameAvailable(input.name);
    const permissionIds = await this.resolvePermissionIds(input.permissions);

    if (input.isDefault) await this.repository.clearDefaultFlag(this.tenantId);
    const role = await this.repository.create(
      this.tenantId,
      { name: input.name, description: input.description, priority: input.priority, isDefault: input.isDefault },
      permissionIds,
    );

    await this.audit(actor, 'iam.role_created', role.id);
    return toDto(role, 0);
  }

  async update(roleId: string, input: UpdateRoleInput, actor: IamActor): Promise<RoleDto> {
    const role = await this.assertVisible(roleId);
    this.assertCustom(role, 'edited');

    if (input.name && input.name.toLowerCase() !== role.name.toLowerCase()) {
      await this.assertNameAvailable(input.name);
    }
    if (input.isDefault) await this.repository.clearDefaultFlag(this.tenantId);

    await this.repository.update(roleId, {
      name: input.name,
      description: input.description,
      priority: input.priority,
      isDefault: input.isDefault,
      isActive: input.isActive,
    });

    if (input.permissions) {
      const permissionIds = await this.resolvePermissionIds(input.permissions);
      await this.repository.setPermissions(roleId, permissionIds);
      await this.invalidateHolders(roleId);
      await this.audit(actor, 'iam.role_permissions_updated', roleId);
    }

    await this.audit(actor, 'iam.role_updated', roleId);
    return this.getById(roleId);
  }

  async delete(roleId: string, actor: IamActor): Promise<void> {
    const role = await this.assertVisible(roleId);
    this.assertCustom(role, 'deleted');

    const holders = await this.repository.userIdsHoldingRole(this.tenantId, roleId);
    if (holders.length > 0) {
      throw new ConflictError(
        ErrorCode.CONFLICT,
        `This role is still assigned to ${holders.length} user(s). Reassign them first.`,
      );
    }
    await this.repository.delete(roleId);
    await this.audit(actor, 'iam.role_deleted', roleId);
  }

  /** Clones system OR custom roles into a new custom role with the same permission set. */
  async clone(roleId: string, newName: string | undefined, actor: IamActor): Promise<RoleDto> {
    const source = await this.assertVisible(roleId);
    const name = newName ?? `${source.name} (copy)`;
    await this.assertNameAvailable(name);

    const role = await this.repository.create(
      this.tenantId,
      { name, description: source.description ?? undefined, priority: source.priority },
      source.rolePermissions.map((rp) => rp.permissionId),
    );
    await this.audit(actor, 'iam.role_cloned', role.id);
    return toDto(role, 0);
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async assertVisible(roleId: string): Promise<RoleWithPermissions> {
    const role = await this.repository.findById(roleId);
    // A role is visible to this tenant if it's the shared system catalog or its own.
    if (!role || (role.tenantId !== null && role.tenantId !== this.tenantId)) {
      throw new NotFoundError('Role not found.');
    }
    return role;
  }

  private assertCustom(role: RoleWithPermissions, verb: string): void {
    if (role.isSystem || role.tenantId === null) {
      throw new AppError(ErrorCode.FORBIDDEN, `System roles cannot be ${verb} — clone the role instead.`, 403);
    }
  }

  private async assertNameAvailable(name: string): Promise<void> {
    const existing = await this.repository.findByName(this.tenantId, name);
    if (existing) throw new ConflictError(ErrorCode.CONFLICT, `A role named "${name}" already exists.`);
  }

  private async resolvePermissionIds(keys: string[]): Promise<string[]> {
    const byKey = await this.repository.findPermissionIdsByKeys(keys);
    const unknown = keys.filter((k) => !byKey.has(k));
    if (unknown.length > 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Unknown permission key(s): ${unknown.join(', ')}`, 422);
    }
    return keys.map((k) => byKey.get(k)!);
  }

  /** Permission change on a role must invalidate every holder's cached permission set. */
  private async invalidateHolders(roleId: string): Promise<void> {
    const holders = await this.repository.userIdsHoldingRole(this.tenantId, roleId);
    for (const userId of holders) {
      await this.authRoleRepository.bumpPermissionVersion(this.tenantId, userId);
    }
    eventBus.emitEvent(IamEvents.RoleChanged, { tenantId: this.tenantId, roleId, affectedUsers: holders.length });
  }

  private async audit(actor: IamActor, action: string, entityId: string): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType: 'role',
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }
}
