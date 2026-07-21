import { ConflictError, NotFoundError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import type {
  CreateMembershipPlanInput,
  ListMembershipPlansQuery,
  MembershipPlanDto,
  UpdateMembershipPlanInput,
} from '../dto/member.dto';
import { MembershipPlanRepository, type MembershipPlanRow } from '../repositories/membership-plan.repository';
import { approximateDurationDays } from '../utils/duration.util';

function toDto(plan: MembershipPlanRow): MembershipPlanDto {
  return {
    id: plan.id,
    name: plan.name,
    planCode: plan.planCode,
    description: plan.description,
    category: plan.category,
    durationValue: plan.durationValue,
    durationType: plan.durationType,
    durationDays: plan.durationDays,
    price: plan.price.toString(),
    joiningFee: plan.joiningFee.toString(),
    taxPercentage: plan.taxPercentage.toString(),
    discountPercentage: plan.discountPercentage.toString(),
    isActive: plan.isActive,
    displayOrder: plan.displayOrder,
    notes: plan.notes,
    gymAccessAllBranches: plan.gymAccessAllBranches,
    accessBranchIds: (plan.accessBranchIds as string[] | null) ?? null,
    ptSessionsIncluded: plan.ptSessionsIncluded,
    groupClassesIncluded: plan.groupClassesIncluded,
    dietConsultationIncluded: plan.dietConsultationIncluded,
    lockerAccess: plan.lockerAccess,
    guestPasses: plan.guestPasses,
    freezeAllowed: plan.freezeAllowed,
    freezeDaysLimit: plan.freezeDaysLimit,
    validityStart: plan.validityStart?.toISOString() ?? null,
    validityEnd: plan.validityEnd?.toISOString() ?? null,
    gracePeriodDays: plan.gracePeriodDays,
    renewalWindowDays: plan.renewalWindowDays,
    autoRenewalAllowed: plan.autoRenewalAllowed,
    minAge: plan.minAge,
    maxAge: plan.maxAge,
    memberCount: plan._count.memberships,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    deletedAt: plan.deletedAt?.toISOString() ?? null,
  };
}

export class MembershipPlanService {
  private readonly plans: MembershipPlanRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    const db = getTenantScopedClient(tenantId);
    this.plans = new MembershipPlanRepository(db);
    this.auditLog = new AuditLogRepository(db);
  }

  async list(query: ListMembershipPlansQuery) {
    const { items, total } = await this.plans.list(this.tenantId, query);
    return {
      items: items.map(toDto),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  /** Unfiltered active plans — backs Assign/Renew/Upgrade dropdowns without a full paginated fetch. */
  async listAssignable(): Promise<MembershipPlanDto[]> {
    return (await this.plans.listAssignable(this.tenantId)).map(toDto);
  }

  async getById(planId: string): Promise<MembershipPlanDto> {
    return toDto(await this.mustFind(planId));
  }

  async create(input: CreateMembershipPlanInput, actor: IamActor): Promise<MembershipPlanDto> {
    await this.assertNameAvailable(input.name);
    const planCode = input.planCode ? await this.assertPlanCodeAvailable(input.planCode) : await this.plans.nextPlanCode(this.tenantId);

    const plan = await this.plans.create({
      tenantId: this.tenantId,
      name: input.name,
      planCode,
      description: input.description,
      category: input.category,
      durationValue: input.durationValue,
      durationType: input.durationType,
      durationDays: approximateDurationDays(input.durationValue, input.durationType),
      price: input.price,
      joiningFee: input.joiningFee ?? 0,
      taxPercentage: input.taxPercentage ?? 0,
      discountPercentage: input.discountPercentage ?? 0,
      isActive: input.isActive ?? true,
      displayOrder: input.displayOrder ?? 0,
      notes: input.notes,
      gymAccessAllBranches: input.gymAccessAllBranches ?? true,
      accessBranchIds: input.accessBranchIds,
      ptSessionsIncluded: input.ptSessionsIncluded ?? 0,
      groupClassesIncluded: input.groupClassesIncluded ?? 0,
      dietConsultationIncluded: input.dietConsultationIncluded ?? false,
      lockerAccess: input.lockerAccess ?? false,
      guestPasses: input.guestPasses ?? 0,
      freezeAllowed: input.freezeAllowed ?? true,
      freezeDaysLimit: input.freezeDaysLimit,
      validityStart: input.validityStart ? new Date(input.validityStart) : undefined,
      validityEnd: input.validityEnd ? new Date(input.validityEnd) : undefined,
      gracePeriodDays: input.gracePeriodDays ?? 0,
      renewalWindowDays: input.renewalWindowDays ?? 0,
      autoRenewalAllowed: input.autoRenewalAllowed ?? true,
      minAge: input.minAge,
      maxAge: input.maxAge,
    });
    await this.audit(actor, 'membership_plan.created', plan.id);
    return toDto(plan);
  }

  async update(planId: string, input: UpdateMembershipPlanInput, actor: IamActor): Promise<MembershipPlanDto> {
    const existing = await this.mustFind(planId);
    if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) await this.assertNameAvailable(input.name);
    const planCode =
      input.planCode && input.planCode !== existing.planCode ? await this.assertPlanCodeAvailable(input.planCode) : undefined;

    const durationValue = input.durationValue ?? existing.durationValue;
    const durationType = input.durationType ?? existing.durationType;
    const durationChanged = input.durationValue !== undefined || input.durationType !== undefined;

    await this.plans.update(planId, {
      name: input.name,
      ...(planCode ? { planCode } : {}),
      description: input.description,
      category: input.category,
      durationValue: input.durationValue,
      durationType: input.durationType,
      ...(durationChanged ? { durationDays: approximateDurationDays(durationValue, durationType) } : {}),
      price: input.price,
      joiningFee: input.joiningFee,
      taxPercentage: input.taxPercentage,
      discountPercentage: input.discountPercentage,
      isActive: input.isActive,
      displayOrder: input.displayOrder,
      notes: input.notes,
      gymAccessAllBranches: input.gymAccessAllBranches,
      accessBranchIds: input.accessBranchIds,
      ptSessionsIncluded: input.ptSessionsIncluded,
      groupClassesIncluded: input.groupClassesIncluded,
      dietConsultationIncluded: input.dietConsultationIncluded,
      lockerAccess: input.lockerAccess,
      guestPasses: input.guestPasses,
      freezeAllowed: input.freezeAllowed,
      freezeDaysLimit: input.freezeDaysLimit,
      validityStart: input.validityStart === null ? null : input.validityStart ? new Date(input.validityStart) : undefined,
      validityEnd: input.validityEnd === null ? null : input.validityEnd ? new Date(input.validityEnd) : undefined,
      gracePeriodDays: input.gracePeriodDays,
      renewalWindowDays: input.renewalWindowDays,
      autoRenewalAllowed: input.autoRenewalAllowed,
      minAge: input.minAge,
      maxAge: input.maxAge,
    });
    await this.audit(actor, 'membership_plan.updated', planId);
    return this.getById(planId);
  }

  async activate(planId: string, actor: IamActor): Promise<void> {
    await this.mustFind(planId);
    await this.plans.setActive(planId, true);
    await this.audit(actor, 'membership_plan.activated', planId);
  }

  async deactivate(planId: string, actor: IamActor): Promise<void> {
    await this.mustFind(planId);
    await this.plans.setActive(planId, false);
    await this.audit(actor, 'membership_plan.deactivated', planId);
  }

  async softDelete(planId: string, actor: IamActor): Promise<void> {
    await this.mustFind(planId);
    await this.plans.softDelete(planId);
    await this.audit(actor, 'membership_plan.deleted', planId);
  }

  async restore(planId: string, actor: IamActor): Promise<MembershipPlanDto> {
    const plan = await this.mustFind(planId, { includeDeleted: true });
    if (!plan.deletedAt) throw new ConflictError(ErrorCode.CONFLICT, 'This plan is not deleted.');
    await this.plans.restore(planId);
    await this.audit(actor, 'membership_plan.restored', planId);
    return this.getById(planId);
  }

  async duplicate(planId: string, actor: IamActor): Promise<MembershipPlanDto> {
    const source = await this.mustFind(planId);
    const planCode = await this.plans.nextPlanCode(this.tenantId);
    let name = `${source.name} (Copy)`;
    let suffix = 2;
    while (await this.plans.findByName(this.tenantId, name)) {
      name = `${source.name} (Copy ${suffix})`;
      suffix += 1;
    }

    const plan = await this.plans.create({
      tenantId: this.tenantId,
      name,
      planCode,
      description: source.description,
      category: source.category,
      durationValue: source.durationValue,
      durationType: source.durationType,
      durationDays: source.durationDays,
      price: source.price,
      joiningFee: source.joiningFee,
      taxPercentage: source.taxPercentage,
      discountPercentage: source.discountPercentage,
      isActive: false,
      displayOrder: source.displayOrder,
      notes: source.notes,
      gymAccessAllBranches: source.gymAccessAllBranches,
      accessBranchIds: source.accessBranchIds as string[] | undefined,
      ptSessionsIncluded: source.ptSessionsIncluded,
      groupClassesIncluded: source.groupClassesIncluded,
      dietConsultationIncluded: source.dietConsultationIncluded,
      lockerAccess: source.lockerAccess,
      guestPasses: source.guestPasses,
      freezeAllowed: source.freezeAllowed,
      freezeDaysLimit: source.freezeDaysLimit,
      gracePeriodDays: source.gracePeriodDays,
      renewalWindowDays: source.renewalWindowDays,
      autoRenewalAllowed: source.autoRenewalAllowed,
      minAge: source.minAge,
      maxAge: source.maxAge,
    });
    await this.audit(actor, 'membership_plan.duplicated', plan.id);
    return toDto(plan);
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async mustFind(planId: string, opts?: { includeDeleted?: boolean }): Promise<MembershipPlanRow> {
    const plan = await this.plans.findById(this.tenantId, planId, opts);
    if (!plan) throw new NotFoundError('Membership plan not found.');
    return plan;
  }

  private async assertNameAvailable(name: string): Promise<void> {
    const existing = await this.plans.findByName(this.tenantId, name);
    if (existing) throw new ConflictError(ErrorCode.CONFLICT, 'A membership plan with this name already exists.');
  }

  private async assertPlanCodeAvailable(planCode: string): Promise<string> {
    const existing = await this.plans.findByPlanCode(this.tenantId, planCode);
    if (existing) throw new ConflictError(ErrorCode.CONFLICT, 'This plan code is already in use.');
    return planCode;
  }

  private async audit(actor: IamActor, action: string, entityId: string): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType: 'membership_plan',
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }
}
