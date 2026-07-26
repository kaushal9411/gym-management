import type { Prisma } from '@prisma/client';

import { ConflictError, NotFoundError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import type { BranchDto, CreateBranchInput, ListBranchesQuery, OperatingHours, UpdateBranchInput } from '../dto/branch.dto';
import { BranchRepository, type BranchRow } from '../repositories/branch.repository';

function toDto(branch: BranchRow): BranchDto {
  return {
    id: branch.id,
    name: branch.name,
    branchCode: branch.branchCode,
    email: branch.email,
    phone: branch.phone,
    whatsappNumber: branch.whatsappNumber,
    addressLine1: branch.addressLine1,
    addressLine2: branch.addressLine2,
    city: branch.city,
    state: branch.state,
    country: branch.country,
    postalCode: branch.postalCode,
    latitude: branch.latitude?.toString() ?? null,
    longitude: branch.longitude?.toString() ?? null,
    operatingHours: (branch.operatingHours as OperatingHours | null) ?? null,
    holidays: (branch.holidays as BranchDto['holidays']) ?? null,
    capacity: branch.capacity,
    maxMembers: branch.maxMembers,
    maxStaff: branch.maxStaff,
    allowCheckIn: branch.allowCheckIn,
    notes: branch.notes,
    isDefault: branch.isDefault,
    isActive: branch.isActive,
    timezone: branch.timezone,
    memberCount: branch._count.members,
    staffCount: branch._count.userBranches,
    createdAt: branch.createdAt.toISOString(),
    updatedAt: branch.updatedAt.toISOString(),
    deletedAt: branch.deletedAt?.toISOString() ?? null,
  };
}

export class BranchService {
  private readonly db: TenantScopedPrisma;
  private readonly branches: BranchRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.branches = new BranchRepository(this.db);
    this.auditLog = new AuditLogRepository(this.db);
  }

  async list(query: ListBranchesQuery) {
    const { items, total } = await this.branches.list(this.tenantId, query);
    return { items: items.map(toDto), total, page: query.page, limit: query.limit, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
  }

  /** Unfiltered active-branch list — backs the portal's branch selector and every `BranchSelect` dropdown. */
  async listAssignable() {
    return this.branches.listAssignable(this.tenantId);
  }

  async getById(id: string): Promise<BranchDto> {
    return toDto(await this.mustFind(id));
  }

  async create(input: CreateBranchInput, actor: IamActor): Promise<BranchDto> {
    await this.assertBranchCapacity();
    await this.assertNameAvailable(input.name);
    const branchCode = input.branchCode ? await this.assertBranchCodeAvailable(input.branchCode) : await this.branches.nextBranchCode(this.tenantId);

    const isFirstBranch = (await this.branches.countTotal(this.tenantId)) === 0;
    const isDefault = input.isDefault ?? isFirstBranch;
    if (isDefault) await this.branches.clearDefault(this.tenantId);

    const timezone = input.timezone ?? (await this.db.tenantSettings.findUnique({ where: { tenantId: this.tenantId }, select: { timezone: true } }))?.timezone ?? 'UTC';

    const branch = await this.branches.create({
      tenantId: this.tenantId,
      name: input.name,
      branchCode,
      email: input.email,
      phone: input.phone,
      whatsappNumber: input.whatsappNumber,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      state: input.state,
      country: input.country,
      postalCode: input.postalCode,
      latitude: input.latitude,
      longitude: input.longitude,
      timezone,
      operatingHours: input.operatingHours as Prisma.InputJsonValue | undefined,
      holidays: input.holidays as Prisma.InputJsonValue | undefined,
      capacity: input.capacity,
      maxMembers: input.maxMembers,
      maxStaff: input.maxStaff,
      allowCheckIn: input.allowCheckIn ?? true,
      notes: input.notes,
      isDefault,
      isActive: input.isActive ?? true,
    });
    await this.audit(actor, 'branch.created', branch.id);
    return toDto(branch);
  }

  async update(id: string, input: UpdateBranchInput, actor: IamActor): Promise<BranchDto> {
    const existing = await this.mustFind(id);
    if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) await this.assertNameAvailable(input.name);
    const branchCode =
      input.branchCode && input.branchCode !== existing.branchCode ? await this.assertBranchCodeAvailable(input.branchCode) : undefined;

    await this.branches.update(id, {
      name: input.name,
      ...(branchCode ? { branchCode } : {}),
      email: input.email,
      phone: input.phone,
      whatsappNumber: input.whatsappNumber,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      city: input.city,
      state: input.state,
      country: input.country,
      postalCode: input.postalCode,
      latitude: input.latitude,
      longitude: input.longitude,
      timezone: input.timezone,
      operatingHours: input.operatingHours as Prisma.InputJsonValue | undefined,
      holidays: input.holidays as Prisma.InputJsonValue | undefined,
      capacity: input.capacity,
      maxMembers: input.maxMembers,
      maxStaff: input.maxStaff,
      allowCheckIn: input.allowCheckIn,
      notes: input.notes,
    });
    await this.audit(actor, 'branch.updated', id);
    return this.getById(id);
  }

  async activate(id: string, actor: IamActor): Promise<void> {
    await this.mustFind(id);
    await this.branches.setActive(id, true);
    await this.audit(actor, 'branch.activated', id);
  }

  /** Business rules: the default branch can't be deactivated, and a tenant must always keep at least one active branch. */
  async deactivate(id: string, actor: IamActor): Promise<void> {
    const branch = await this.mustFind(id);
    if (branch.isDefault) {
      throw new ConflictError(ErrorCode.CONFLICT, 'The default branch cannot be deactivated — set another branch as default first.');
    }
    if (branch.isActive && (await this.branches.countActive(this.tenantId)) <= 1) {
      throw new ConflictError(ErrorCode.CONFLICT, 'A tenant must have at least one active branch.');
    }
    await this.branches.setActive(id, false);
    await this.audit(actor, 'branch.deactivated', id);
  }

  /** Business rule: only one default branch per tenant, and it must be active. */
  async setDefault(id: string, actor: IamActor): Promise<BranchDto> {
    const branch = await this.mustFind(id);
    if (!branch.isActive) throw new ConflictError(ErrorCode.CONFLICT, 'An inactive branch cannot be set as the default — activate it first.');
    if (!branch.isDefault) {
      await this.branches.clearDefault(this.tenantId);
      await this.branches.setDefault(id);
    }
    await this.audit(actor, 'branch.set_default', id);
    return this.getById(id);
  }

  /** Business rules: the default branch cannot be deleted, and a tenant must always keep at least one active branch. Soft delete only. */
  async softDelete(id: string, actor: IamActor): Promise<void> {
    const branch = await this.mustFind(id);
    if (branch.isDefault) {
      throw new ConflictError(ErrorCode.CONFLICT, 'The default branch cannot be deleted — set another branch as default first.');
    }
    if (branch.isActive && (await this.branches.countActive(this.tenantId)) <= 1) {
      throw new ConflictError(ErrorCode.CONFLICT, 'A tenant must have at least one active branch.');
    }
    await this.branches.softDelete(id);
    await this.audit(actor, 'branch.deleted', id);
  }

  async restore(id: string, actor: IamActor): Promise<BranchDto> {
    const branch = await this.mustFind(id, { includeDeleted: true });
    if (!branch.deletedAt) throw new ConflictError(ErrorCode.CONFLICT, 'This branch is not deleted.');
    await this.branches.restore(id);
    await this.audit(actor, 'branch.restored', id);
    return this.getById(id);
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async mustFind(id: string, opts?: { includeDeleted?: boolean }): Promise<BranchRow> {
    const branch = await this.branches.findById(this.tenantId, id, opts);
    if (!branch) throw new NotFoundError('Branch not found.');
    return branch;
  }

  private async assertNameAvailable(name: string): Promise<void> {
    const existing = await this.branches.findByName(this.tenantId, name);
    if (existing) throw new ConflictError(ErrorCode.CONFLICT, 'A branch with this name already exists.');
  }

  private async assertBranchCodeAvailable(branchCode: string): Promise<string> {
    const existing = await this.branches.findByBranchCode(this.tenantId, branchCode);
    if (existing) throw new ConflictError(ErrorCode.CONFLICT, 'This branch code is already in use.');
    return branchCode;
  }

  /** No live enforcement existed anywhere before Staff Management (Prompt 13) added the pattern — mirrored here for branches, against `TenantLimit.maxBranches`. */
  private async assertBranchCapacity(): Promise<void> {
    const limit = await this.db.tenantLimit.findUnique({ where: { tenantId: this.tenantId } });
    if (!limit) return;
    const total = await this.branches.countTotal(this.tenantId);
    if (total >= limit.maxBranches) {
      throw new ConflictError(ErrorCode.CONFLICT, `Your plan allows up to ${limit.maxBranches} branch(es). Upgrade your plan to add more.`);
    }
  }

  private async audit(actor: IamActor, action: string, entityId: string): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType: 'branch',
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }
}
