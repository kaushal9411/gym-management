import { AppError, ConflictError, NotFoundError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { AuthEvents, eventBus } from '../../../core/events/event-bus';
import { passwordService } from '../../../core/security/password.service';
import { generateOpaqueToken, hashToken } from '../../../core/security/token.util';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import { RoleRepository } from '../../authentication/repositories/role.repository';
import { SessionRepository } from '../../authentication/repositories/session.repository';
import { UserRepository as AuthUserRepository } from '../../authentication/repositories/user.repository';
import { VerificationRepository } from '../../authentication/repositories/verification.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import { RoleManagementRepository } from '../../roles/repositories/role-management.repository';
import { UserManagementRepository } from '../../users/repositories/user-management.repository';
import {
  STAFF_ROLE_NAMES,
  type AssignBranchesInput,
  type AssignRoleInput,
  type BulkStaffActionResult,
  type CreateStaffInput,
  type ListStaffQuery,
  type StaffBulkImportResult,
  type StaffBulkImportRow,
  type StaffDetailDto,
  type StaffListItemDto,
  type StaffRoleName,
  type UpdateStaffInput,
} from '../dto/staff.dto';
import { StaffProfileRepository } from '../repositories/staff-profile.repository';
import { StaffRepository, type StaffUserRow } from '../repositories/staff.repository';

export const StaffEvents = {
  ActivationRequested: 'staff.activation_requested',
} as const;

/** 7 days — staff onboarding has more to fill in than a quick password reset, so the link lives longer than a generic invitation. */
const STAFF_ACTIVATION_TTL_HOURS = 168;

function roleLimitField(role: StaffRoleName): 'maxManagers' | 'maxTrainers' | 'maxReceptionists' {
  if (role === 'MANAGER') return 'maxManagers';
  if (role === 'TRAINER') return 'maxTrainers';
  return 'maxReceptionists';
}

function toListItem(user: StaffUserRow): StaffListItemDto {
  const role = user.userRoles.find((ur) => (STAFF_ROLE_NAMES as readonly string[]).includes(ur.role.name))?.role.name as
    | StaffRoleName
    | undefined;
  const branches = user.userBranches.map((ub) => ({
    branchId: ub.branchId,
    branchName: ub.branch.name,
    isPrimary: ub.isPrimary,
  }));
  const profile = user.staffProfile;
  return {
    id: user.id,
    employeeId: profile?.employeeId ?? '',
    firstName: profile?.firstName ?? '',
    lastName: profile?.lastName ?? '',
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    status: user.status,
    role: role ?? 'RECEPTIONIST',
    branches,
    primaryBranch: branches.find((b) => b.isPrimary) ?? null,
    employmentType: profile?.employmentType ?? 'FULL_TIME',
    workStatus: profile?.workStatus ?? 'WORKING',
    joiningDate: (profile?.joiningDate ?? user.createdAt).toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    deletedAt: user.deletedAt?.toISOString() ?? null,
  };
}

function toDetail(user: StaffUserRow): StaffDetailDto {
  const profile = user.staffProfile;
  return {
    ...toListItem(user),
    gender: profile?.gender ?? null,
    dateOfBirth: profile?.dateOfBirth?.toISOString() ?? null,
    addressLine: profile?.addressLine ?? null,
    city: profile?.city ?? null,
    state: profile?.state ?? null,
    country: profile?.country ?? null,
    postalCode: profile?.postalCode ?? null,
    notes: profile?.notes ?? null,
    salaryType: profile?.salaryType ?? 'MONTHLY',
    salaryAmount: profile?.salaryAmount?.toString() ?? null,
    shift: profile?.shift ?? null,
    weeklyOff: profile?.weeklyOff ?? null,
    emergencyContactName: user.emergencyContactName,
    emergencyContactPhone: user.emergencyContactPhone,
    emergencyContactRelation: user.emergencyContactRelation,
    updatedAt: user.updatedAt.toISOString(),
  };
}

export class StaffService {
  private readonly db: TenantScopedPrisma;
  private readonly staff: StaffRepository;
  private readonly profiles: StaffProfileRepository;
  private readonly users: UserManagementRepository;
  private readonly roleManagement: RoleManagementRepository;
  private readonly authRoleRepository: RoleRepository;
  private readonly sessionRepository: SessionRepository;
  private readonly verification: VerificationRepository;
  private readonly authUserRepository: AuthUserRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.staff = new StaffRepository(this.db);
    this.profiles = new StaffProfileRepository(this.db);
    this.users = new UserManagementRepository(this.db);
    this.roleManagement = new RoleManagementRepository(this.db);
    this.authRoleRepository = new RoleRepository(this.db);
    this.sessionRepository = new SessionRepository(this.db);
    this.verification = new VerificationRepository(this.db);
    this.authUserRepository = new AuthUserRepository(this.db);
    this.auditLog = new AuditLogRepository(this.db);
  }

  async list(query: ListStaffQuery) {
    const { items, total } = await this.staff.list(this.tenantId, query);
    return {
      items: items.map(toListItem),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async getById(userId: string): Promise<StaffDetailDto> {
    return toDetail(await this.mustFind(userId));
  }

  async create(input: CreateStaffInput, actor: IamActor): Promise<StaffDetailDto> {
    await this.assertStaffCapacity(input.role);
    await this.assertEmailAvailable(input.email);
    if (input.phone) await this.assertPhoneAvailable(input.phone);
    const role = await this.mustFindStaffRole(input.role);

    const branchIds = Array.from(new Set([input.primaryBranchId, ...(input.branchIds ?? [])]));
    await this.assertBranchesExist(branchIds);

    const employeeId = input.employeeId
      ? await this.assertEmployeeIdAvailable(input.employeeId)
      : await this.profiles.nextEmployeeId(this.tenantId);

    const passwordHash = await passwordService.hash(`St4ff-${generateOpaqueToken(12)}!A`);
    const name = `${input.firstName} ${input.lastName}`.trim();

    const user = await this.users.create({
      tenantId: this.tenantId,
      name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      passwordHash,
      status: 'PENDING_VERIFICATION',
      allBranches: false,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      emergencyContactRelation: input.emergencyContactRelation,
    });

    await this.users.setRoles(user.id, [role.id]);
    await this.users.setBranches(
      this.tenantId,
      user.id,
      false,
      branchIds.map((branchId) => ({ branchId, isPrimary: branchId === input.primaryBranchId })),
    );
    await this.profiles.create({
      tenantId: this.tenantId,
      userId: user.id,
      employeeId,
      firstName: input.firstName,
      lastName: input.lastName,
      gender: input.gender,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
      joiningDate: input.joiningDate ? new Date(input.joiningDate) : undefined,
      addressLine: input.addressLine,
      city: input.city,
      state: input.state,
      country: input.country,
      postalCode: input.postalCode,
      notes: input.notes,
      employmentType: input.employmentType,
      salaryType: input.salaryType,
      salaryAmount: input.salaryAmount,
      shift: input.shift,
      weeklyOff: input.weeklyOff,
      workStatus: input.workStatus,
    });
    await this.authRoleRepository.bumpPermissionVersion(this.tenantId, user.id);
    await this.audit(actor, 'staff.created', user.id);
    await this.sendActivationEmail(user.id, user.email, actor.role, role.name);
    return this.getById(user.id);
  }

  async update(userId: string, input: UpdateStaffInput, actor: IamActor): Promise<StaffDetailDto> {
    const staffMember = await this.mustFind(userId);
    if (input.email && input.email.toLowerCase() !== staffMember.email) {
      await this.assertEmailAvailable(input.email);
    }
    if (input.phone && input.phone !== staffMember.phone) {
      await this.assertPhoneAvailable(input.phone);
    }
    const employeeId =
      input.employeeId && input.employeeId !== staffMember.staffProfile?.employeeId
        ? await this.assertEmployeeIdAvailable(input.employeeId)
        : undefined;

    const firstName = input.firstName ?? staffMember.staffProfile?.firstName;
    const lastName = input.lastName ?? staffMember.staffProfile?.lastName;
    const nameChanged = input.firstName !== undefined || input.lastName !== undefined;

    await this.users.update(userId, {
      ...(nameChanged ? { name: `${firstName} ${lastName}`.trim() } : {}),
      email: input.email?.toLowerCase(),
      phone: input.phone,
      avatarUrl: input.avatarUrl,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      emergencyContactRelation: input.emergencyContactRelation,
    });
    await this.profiles.update(userId, {
      ...(employeeId ? { employeeId } : {}),
      firstName: input.firstName,
      lastName: input.lastName,
      gender: input.gender,
      dateOfBirth: input.dateOfBirth === null ? null : input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
      joiningDate: input.joiningDate ? new Date(input.joiningDate) : undefined,
      addressLine: input.addressLine,
      city: input.city,
      state: input.state,
      country: input.country,
      postalCode: input.postalCode,
      notes: input.notes,
      employmentType: input.employmentType,
      salaryType: input.salaryType,
      salaryAmount: input.salaryAmount === null ? null : input.salaryAmount,
      shift: input.shift,
      weeklyOff: input.weeklyOff,
      workStatus: input.workStatus,
    });
    await this.audit(actor, 'staff.updated', userId);
    return this.getById(userId);
  }

  async activate(userId: string, actor: IamActor): Promise<void> {
    await this.guardSelfAction(userId, actor, 'activate');
    await this.users.setStatus(userId, 'ACTIVE');
    await this.audit(actor, 'staff.activated', userId);
  }

  async deactivate(userId: string, actor: IamActor): Promise<void> {
    await this.guardSelfAction(userId, actor, 'deactivate');
    await this.users.setStatus(userId, 'DEACTIVATED');
    await this.sessionRepository.revokeAllForUser(this.tenantId, userId);
    await this.audit(actor, 'staff.deactivated', userId);
  }

  async suspend(userId: string, actor: IamActor): Promise<void> {
    await this.guardSelfAction(userId, actor, 'suspend');
    await this.users.setStatus(userId, 'SUSPENDED');
    await this.sessionRepository.revokeAllForUser(this.tenantId, userId);
    await this.audit(actor, 'staff.suspended', userId);
  }

  async softDelete(userId: string, actor: IamActor): Promise<void> {
    await this.guardSelfAction(userId, actor, 'delete');
    await this.users.softDelete(userId);
    await this.sessionRepository.revokeAllForUser(this.tenantId, userId);
    await this.audit(actor, 'staff.deleted', userId);
  }

  async restore(userId: string, actor: IamActor): Promise<void> {
    const staffMember = await this.mustFind(userId, { includeDeleted: true });
    if (staffMember.deletedAt) {
      await this.users.restore(userId);
    } else {
      await this.users.setStatus(userId, 'ACTIVE');
    }
    await this.audit(actor, 'staff.restored', userId);
  }

  /** Admin-triggered — reuses the exact self-service "forgot password" email + token machinery. */
  async resetPassword(userId: string, actor: IamActor): Promise<void> {
    const staffMember = await this.mustFind(userId);
    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + 30 * 60_000);
    await this.verification.createPasswordReset(this.tenantId, userId, hashToken(token), expiresAt);
    eventBus.emitEvent(AuthEvents.PasswordResetRequested, {
      tenantId: this.tenantId,
      userId,
      name: staffMember.name,
      email: staffMember.email,
      resetToken: token,
    });
    await this.audit(actor, 'staff.password_reset_requested', userId);
  }

  async resendActivation(userId: string, actor: IamActor): Promise<void> {
    const staffMember = await this.mustFind(userId);
    if (staffMember.status !== 'PENDING_VERIFICATION') {
      throw new ConflictError(ErrorCode.CONFLICT, 'This staff member has already activated their account.');
    }
    const role = staffMember.userRoles.find((ur) => (STAFF_ROLE_NAMES as readonly string[]).includes(ur.role.name))?.role;
    await this.sendActivationEmail(userId, staffMember.email, actor.role, role?.name ?? 'Staff');
    await this.audit(actor, 'staff.invitation_resent', userId);
  }

  async assignBranches(userId: string, input: AssignBranchesInput, actor: IamActor): Promise<StaffDetailDto> {
    await this.mustFind(userId);
    if (!input.branchIds.includes(input.primaryBranchId)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'The primary branch must be one of the assigned branches.', 422);
    }
    await this.assertBranchesExist(input.branchIds);
    await this.users.setBranches(
      this.tenantId,
      userId,
      false,
      input.branchIds.map((branchId) => ({ branchId, isPrimary: branchId === input.primaryBranchId })),
    );
    await this.audit(actor, 'staff.branches_assigned', userId);
    return this.getById(userId);
  }

  async assignRole(userId: string, input: AssignRoleInput, actor: IamActor): Promise<StaffDetailDto> {
    const staffMember = await this.mustFind(userId);
    const currentRole = staffMember.userRoles.find((ur) =>
      (STAFF_ROLE_NAMES as readonly string[]).includes(ur.role.name),
    )?.role.name;
    if (currentRole !== input.role) {
      await this.assertStaffCapacity(input.role);
    }
    const role = await this.mustFindStaffRole(input.role);
    await this.users.setRoles(userId, [role.id]);
    await this.authRoleRepository.bumpPermissionVersion(this.tenantId, userId);
    await this.audit(actor, 'staff.role_assigned', userId);
    return this.getById(userId);
  }

  /** CSV export — same "Excel opens it natively" approach as the Users module. */
  async exportCsv(): Promise<string> {
    const rows = await this.staff.listForExport(this.tenantId);
    const header = 'Employee ID,First Name,Last Name,Email,Phone,Role,Status,Work Status,Employment Type,Primary Branch,Joining Date';
    const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    const lines = rows.map((u) => {
      const dto = toListItem(u);
      return [
        dto.employeeId,
        escape(dto.firstName),
        escape(dto.lastName),
        dto.email,
        dto.phone ?? '',
        dto.role,
        dto.status,
        dto.workStatus,
        dto.employmentType,
        dto.primaryBranch ? escape(dto.primaryBranch.branchName) : '',
        dto.joiningDate.slice(0, 10),
      ].join(',');
    });
    return [header, ...lines].join('\n');
  }

  /** Bulk import — one bad row never rolls back the others (mirrors the Users module's bulkImport). */
  async bulkImport(rows: StaffBulkImportRow[], actor: IamActor): Promise<StaffBulkImportResult> {
    const defaultBranch =
      (await this.db.branch.findFirst({ where: { tenantId: this.tenantId, isDefault: true } })) ??
      (await this.db.branch.findFirst({ where: { tenantId: this.tenantId, isActive: true } }));

    const result: StaffBulkImportResult = { created: 0, failed: [] };
    for (const [index, row] of rows.entries()) {
      try {
        const role = (row.role?.toUpperCase() as StaffRoleName | undefined) ?? 'RECEPTIONIST';
        if (!(STAFF_ROLE_NAMES as readonly string[]).includes(role)) {
          throw new Error(`Unknown role "${row.role}"`);
        }
        let primaryBranchId = defaultBranch?.id;
        if (row.primaryBranchName) {
          const branch = await this.db.branch.findFirst({
            where: { tenantId: this.tenantId, name: { equals: row.primaryBranchName, mode: 'insensitive' } },
          });
          if (branch) primaryBranchId = branch.id;
        }
        if (!primaryBranchId) throw new Error('No branch available to assign — create a branch first.');

        await this.create(
          {
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            phone: row.phone,
            employeeId: row.employeeId,
            role,
            primaryBranchId,
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

  async bulkActivate(userIds: string[], actor: IamActor): Promise<BulkStaffActionResult> {
    return this.bulkAction(userIds, actor, (id, a) => this.activate(id, a));
  }

  async bulkDeactivate(userIds: string[], actor: IamActor): Promise<BulkStaffActionResult> {
    return this.bulkAction(userIds, actor, (id, a) => this.deactivate(id, a));
  }

  async bulkDelete(userIds: string[], actor: IamActor): Promise<BulkStaffActionResult> {
    return this.bulkAction(userIds, actor, (id, a) => this.softDelete(id, a));
  }

  // ── Public activation flow (token is the credential — no auth required) ──

  async lookupActivation(token: string): Promise<{ name: string; email: string; expiresAt: string }> {
    const record = await this.db.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!record || record.usedAt) {
      throw new AppError(ErrorCode.TOKEN_INVALID, 'This activation link is not valid.', 410);
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new AppError(ErrorCode.TOKEN_EXPIRED, 'This activation link has expired. Ask your manager to resend it.', 410);
    }
    const user = await this.db.user.findFirst({ where: { id: record.userId } });
    if (!user) throw new NotFoundError('Staff account not found.');
    return { name: user.name, email: user.email, expiresAt: record.expiresAt.toISOString() };
  }

  async acceptActivation(input: { token: string; password: string }): Promise<{ email: string }> {
    const result = await this.verification.consumePasswordReset(hashToken(input.token));
    if (result === 'not_found') throw new AppError(ErrorCode.TOKEN_INVALID, 'This activation link is not valid.', 410);
    if (result === 'expired') {
      throw new AppError(ErrorCode.TOKEN_EXPIRED, 'This activation link has expired. Ask your manager to resend it.', 410);
    }

    const user = await this.db.user.findFirst({ where: { id: result.userId } });
    if (!user) throw new NotFoundError('Staff account not found.');
    if (user.status !== 'PENDING_VERIFICATION') {
      throw new ConflictError(ErrorCode.CONFLICT, 'This account has already been activated.');
    }

    const passwordHash = await passwordService.hash(input.password);
    await this.authUserRepository.updatePasswordHash(result.tenantId, result.userId, passwordHash);
    await this.users.update(result.userId, { status: 'ACTIVE', emailVerifiedAt: new Date() });
    await this.auditLog.record({
      tenantId: result.tenantId,
      actorUserId: result.userId,
      actorRole: 'STAFF',
      action: 'staff.activated',
      entityType: 'user',
      entityId: result.userId,
    });
    return { email: user.email };
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async bulkAction(
    userIds: string[],
    actor: IamActor,
    action: (userId: string, actor: IamActor) => Promise<void>,
  ): Promise<BulkStaffActionResult> {
    const result: BulkStaffActionResult = { succeeded: [], failed: [] };
    for (const userId of userIds) {
      try {
        await action(userId, actor);
        result.succeeded.push(userId);
      } catch (error) {
        result.failed.push({ userId, reason: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    return result;
  }

  private async sendActivationEmail(
    userId: string,
    email: string,
    invitedByRole: string,
    roleLabel: string,
  ): Promise<void> {
    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + STAFF_ACTIVATION_TTL_HOURS * 3600_000);
    await this.verification.createPasswordReset(this.tenantId, userId, hashToken(token), expiresAt);
    eventBus.emitEvent(StaffEvents.ActivationRequested, {
      tenantId: this.tenantId,
      email,
      invitedByName: invitedByRole,
      roleLabel,
      token,
    });
  }

  private async mustFind(userId: string, opts?: { includeDeleted?: boolean }): Promise<StaffUserRow> {
    const staffMember = await this.staff.findDetail(this.tenantId, userId);
    if (!staffMember || (!opts?.includeDeleted && staffMember.deletedAt)) {
      throw new NotFoundError('Staff member not found.');
    }
    return staffMember;
  }

  private async mustFindStaffRole(roleName: StaffRoleName) {
    const role = await this.roleManagement.findByName(this.tenantId, roleName);
    if (!role) throw new NotFoundError(`Role "${roleName}" is not seeded.`);
    if (!role.isActive) throw new AppError(ErrorCode.VALIDATION_ERROR, `Role "${roleName}" is inactive.`, 422);
    return role;
  }

  private async assertEmailAvailable(email: string): Promise<void> {
    const existing = await this.users.findByEmail(this.tenantId, email);
    if (existing) throw new ConflictError(ErrorCode.CONFLICT, 'An account with this email already exists.');
  }

  private async assertPhoneAvailable(phone: string): Promise<void> {
    const existing = await this.users.findByPhone(this.tenantId, phone);
    if (existing) throw new ConflictError(ErrorCode.CONFLICT, 'An account with this phone number already exists.');
  }

  private async assertEmployeeIdAvailable(employeeId: string): Promise<string> {
    const existing = await this.profiles.findByEmployeeId(this.tenantId, employeeId);
    if (existing) throw new ConflictError(ErrorCode.CONFLICT, 'This Employee ID is already in use.');
    return employeeId;
  }

  private async assertBranchesExist(branchIds: string[]): Promise<void> {
    if (branchIds.length === 0) return;
    const found = await this.db.branch.count({ where: { id: { in: branchIds }, tenantId: this.tenantId, isActive: true } });
    if (found !== branchIds.length) throw new NotFoundError('One of the selected branches does not exist or is inactive.');
  }

  private async guardSelfAction(userId: string, actor: IamActor, verb: string): Promise<void> {
    await this.mustFind(userId);
    if (userId === actor.userId) {
      throw new AppError(ErrorCode.FORBIDDEN, `You cannot ${verb} your own account here.`, 403);
    }
  }

  /** No live enforcement existed anywhere in the codebase before this — see docs/BACKEND-GUIDE.md §Staff Management. */
  private async assertStaffCapacity(role: StaffRoleName): Promise<void> {
    const limit = await this.db.tenantLimit.findUnique({ where: { tenantId: this.tenantId } });
    if (!limit) return;

    const roleCount = await this.staff.countByRole(this.tenantId, role);
    const maxForRole = limit[roleLimitField(role)];
    if (roleCount >= maxForRole) {
      throw new ConflictError(
        ErrorCode.CONFLICT,
        `Your plan allows up to ${maxForRole} ${role.toLowerCase()}(s). Upgrade your plan to add more.`,
      );
    }

    const totalStaff = await this.staff.countTotalStaff(this.tenantId);
    if (totalStaff >= limit.maxStaff) {
      throw new ConflictError(
        ErrorCode.CONFLICT,
        `Your plan allows up to ${limit.maxStaff} staff member(s) in total. Upgrade your plan to add more.`,
      );
    }
  }

  private async audit(actor: IamActor, action: string, entityId: string): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType: 'staff',
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }
}
