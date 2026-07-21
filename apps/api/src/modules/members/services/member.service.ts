import QRCode from 'qrcode';

import { AppError, ConflictError, NotFoundError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { generateOpaqueToken } from '../../../core/security/token.util';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import {
  type AssignMembershipInput,
  type AssignTrainerInput,
  type BulkMemberActionResult,
  type CancelMembershipInput,
  type CreateMemberInput,
  type DowngradeMembershipInput,
  type ExtendMembershipInput,
  type FreezeMembershipInput,
  type ListMembersQuery,
  type MemberBulkImportResult,
  type MemberBulkImportRow,
  type MemberDetailDto,
  type MemberDocumentDto,
  type MemberListItemDto,
  type RenewMembershipInput,
  type TransferBranchInput,
  type UpdateMemberInput,
  type UpgradeMembershipInput,
  type UploadDocumentInput,
} from '../dto/member.dto';
import { MemberDocumentRepository } from '../repositories/member-document.repository';
import { MemberRepository, type MemberRow } from '../repositories/member.repository';
import { MembershipPlanRepository, type MembershipPlanRow } from '../repositories/membership-plan.repository';
import { MembershipRepository } from '../repositories/membership.repository';
import { addDuration } from '../utils/duration.util';

function toListItem(member: MemberRow): MemberListItemDto {
  const activeMembership = member.memberships.find((m) => m.status === 'ACTIVE');
  return {
    id: member.id,
    memberId: member.memberId,
    firstName: member.firstName,
    lastName: member.lastName,
    name: `${member.firstName} ${member.lastName}`.trim(),
    profilePhotoUrl: member.profilePhotoUrl,
    email: member.email,
    phone: member.phone,
    gender: member.gender,
    status: member.status,
    branch: { id: member.branch.id, name: member.branch.name },
    trainer: member.trainer ? { id: member.trainer.id, name: member.trainer.name } : null,
    currentMembership: activeMembership
      ? {
          id: activeMembership.id,
          planId: activeMembership.planId,
          planName: activeMembership.plan.name,
          startDate: activeMembership.startDate.toISOString(),
          endDate: activeMembership.endDate.toISOString(),
          status: activeMembership.status,
          autoRenew: activeMembership.autoRenew,
        }
      : null,
    joiningDate: member.joiningDate.toISOString(),
    createdAt: member.createdAt.toISOString(),
    deletedAt: member.deletedAt?.toISOString() ?? null,
  };
}

function toDetail(member: MemberRow): MemberDetailDto {
  const listItem = toListItem(member);
  const activeMembership = member.memberships.find((m) => m.status === 'ACTIVE');
  const canCheckIn =
    member.status === 'ACTIVE' && !!activeMembership && new Date(activeMembership.endDate) >= new Date();
  return {
    ...listItem,
    dateOfBirth: member.dateOfBirth?.toISOString() ?? null,
    bloodGroup: member.bloodGroup,
    height: member.height?.toString() ?? null,
    weight: member.weight?.toString() ?? null,
    occupation: member.occupation,
    addressLine: member.addressLine,
    city: member.city,
    state: member.state,
    country: member.country,
    postalCode: member.postalCode,
    emergencyContactName: member.emergencyContactName,
    emergencyContactPhone: member.emergencyContactPhone,
    emergencyContactRelation: member.emergencyContactRelation,
    medicalConditions: member.medicalConditions,
    allergies: member.allergies,
    fitnessGoals: member.fitnessGoals,
    notes: member.notes,
    qrCodeToken: member.qrCodeToken,
    qrCodeImageUrl: member.qrCodeImageUrl,
    canCheckIn,
    membershipHistory: member.memberships.map((m) => ({
      id: m.id,
      planId: m.planId,
      planName: m.plan.name,
      startDate: m.startDate.toISOString(),
      endDate: m.endDate.toISOString(),
      durationDays: m.durationDays,
      priceAtAssignment: m.priceAtAssignment.toString(),
      status: m.status,
      autoRenew: m.autoRenew,
      createdAt: m.createdAt.toISOString(),
    })),
    freezeHistory: member.freezes.map((f) => ({
      id: f.id,
      membershipId: f.membershipId,
      reason: f.reason,
      frozenAt: f.frozenAt.toISOString(),
      unfrozenAt: f.unfrozenAt?.toISOString() ?? null,
    })),
    updatedAt: member.updatedAt.toISOString(),
  };
}

async function buildQrCode(tenantId: string, token: string): Promise<string> {
  return QRCode.toDataURL(`fitcloud-member:${tenantId}:${token}`, { width: 320, margin: 1 });
}

export class MemberService {
  private readonly db: TenantScopedPrisma;
  private readonly members: MemberRepository;
  private readonly membershipPlans: MembershipPlanRepository;
  private readonly memberships: MembershipRepository;
  private readonly documents: MemberDocumentRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.members = new MemberRepository(this.db);
    this.membershipPlans = new MembershipPlanRepository(this.db);
    this.memberships = new MembershipRepository(this.db);
    this.documents = new MemberDocumentRepository(this.db);
    this.auditLog = new AuditLogRepository(this.db);
  }

  async list(query: ListMembersQuery) {
    const { items, total } = await this.members.list(this.tenantId, query);
    return {
      items: items.map(toListItem),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async getById(id: string): Promise<MemberDetailDto> {
    return toDetail(await this.mustFind(id));
  }

  async create(input: CreateMemberInput, actor: IamActor): Promise<MemberDetailDto> {
    await this.assertMemberCapacity();
    if (input.email) await this.assertEmailAvailable(input.email);
    if (input.phone) await this.assertPhoneAvailable(input.phone);
    await this.assertBranchExists(input.branchId);
    if (input.trainerId) await this.assertTrainerValid(input.trainerId);

    const memberCode = input.memberId
      ? await this.assertMemberCodeAvailable(input.memberId)
      : await this.members.nextMemberCode(this.tenantId);

    const qrCodeToken = generateOpaqueToken(16);
    const qrCodeImageUrl = await buildQrCode(this.tenantId, qrCodeToken);

    const member = await this.members.create({
      tenantId: this.tenantId,
      memberId: memberCode,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      gender: input.gender,
      dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
      bloodGroup: input.bloodGroup,
      height: input.height,
      weight: input.weight,
      occupation: input.occupation,
      addressLine: input.addressLine,
      city: input.city,
      state: input.state,
      country: input.country,
      postalCode: input.postalCode,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      emergencyContactRelation: input.emergencyContactRelation,
      medicalConditions: input.medicalConditions,
      allergies: input.allergies,
      fitnessGoals: input.fitnessGoals,
      joiningDate: input.joiningDate ? new Date(input.joiningDate) : undefined,
      branchId: input.branchId,
      trainerId: input.trainerId,
      notes: input.notes,
      qrCodeToken,
      qrCodeImageUrl,
    });
    await this.audit(actor, 'member.created', member.id);
    return toDetail(member);
  }

  async update(id: string, input: UpdateMemberInput, actor: IamActor): Promise<MemberDetailDto> {
    const existing = await this.mustFind(id);
    if (input.email && input.email !== existing.email) await this.assertEmailAvailable(input.email);
    if (input.phone && input.phone !== existing.phone) await this.assertPhoneAvailable(input.phone);
    const memberCode =
      input.memberId && input.memberId !== existing.memberId
        ? await this.assertMemberCodeAvailable(input.memberId)
        : undefined;

    await this.members.update(id, {
      ...(memberCode ? { memberId: memberCode } : {}),
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      profilePhotoUrl: input.profilePhotoUrl,
      gender: input.gender,
      dateOfBirth: input.dateOfBirth === null ? null : input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
      bloodGroup: input.bloodGroup,
      height: input.height,
      weight: input.weight,
      occupation: input.occupation,
      addressLine: input.addressLine,
      city: input.city,
      state: input.state,
      country: input.country,
      postalCode: input.postalCode,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      emergencyContactRelation: input.emergencyContactRelation,
      medicalConditions: input.medicalConditions,
      allergies: input.allergies,
      fitnessGoals: input.fitnessGoals,
      notes: input.notes,
    });
    await this.audit(actor, 'member.updated', id);
    return this.getById(id);
  }

  async activate(id: string, actor: IamActor): Promise<void> {
    await this.mustFind(id);
    await this.members.setStatus(id, 'ACTIVE');
    await this.audit(actor, 'member.activated', id);
  }

  async deactivate(id: string, actor: IamActor): Promise<void> {
    await this.mustFind(id);
    await this.members.setStatus(id, 'INACTIVE');
    await this.audit(actor, 'member.deactivated', id);
  }

  async freeze(id: string, input: FreezeMembershipInput, actor: IamActor): Promise<void> {
    const member = await this.mustFind(id);
    if (member.status === 'FROZEN') throw new ConflictError(ErrorCode.CONFLICT, 'This member is already frozen.');
    const activeMembership = member.memberships.find((m) => m.status === 'ACTIVE');
    await this.memberships.createFreeze({
      tenantId: this.tenantId,
      memberId: id,
      membershipId: activeMembership?.id,
      reason: input.reason,
    });
    await this.members.setStatus(id, 'FROZEN');
    await this.audit(actor, 'member.frozen', id);
  }

  async unfreeze(id: string, actor: IamActor): Promise<void> {
    const member = await this.mustFind(id);
    if (member.status !== 'FROZEN') throw new ConflictError(ErrorCode.CONFLICT, 'This member is not frozen.');
    const freeze = await this.memberships.findActiveFreeze(this.tenantId, id);
    if (freeze) await this.memberships.unfreeze(freeze.id);
    await this.members.setStatus(id, 'ACTIVE');
    await this.audit(actor, 'member.unfrozen', id);
  }

  async softDelete(id: string, actor: IamActor): Promise<void> {
    await this.mustFind(id);
    await this.members.softDelete(id);
    await this.audit(actor, 'member.deleted', id);
  }

  async restore(id: string, actor: IamActor): Promise<void> {
    const member = await this.mustFind(id, { includeDeleted: true });
    if (member.deletedAt) {
      await this.members.restore(id);
    } else {
      await this.members.setStatus(id, 'ACTIVE');
    }
    await this.audit(actor, 'member.restored', id);
  }

  async assignMembership(id: string, input: AssignMembershipInput, actor: IamActor): Promise<MemberDetailDto> {
    const member = await this.mustFind(id);
    const existingActive = member.memberships.find((m) => m.status === 'ACTIVE');
    if (existingActive) {
      throw new ConflictError(
        ErrorCode.CONFLICT,
        'This member already has an active membership — use Renew or Upgrade instead.',
      );
    }
    const plan = await this.mustFindPlan(input.planId);
    this.assertPlanAssignable(plan, member);
    if (input.autoRenew && !plan.autoRenewalAllowed) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Plan "${plan.name}" does not allow auto-renewal.`, 422);
    }

    const startDate = input.startDate ? new Date(input.startDate) : new Date();
    const endDate = addDuration(startDate, plan.durationValue, plan.durationType);
    await this.memberships.create({
      tenantId: this.tenantId,
      memberId: id,
      planId: plan.id,
      startDate,
      endDate,
      durationDays: daysBetween(startDate, endDate),
      priceAtAssignment: plan.price,
      status: 'ACTIVE',
      autoRenew: input.autoRenew ?? false,
    });
    await this.audit(actor, 'member.membership_assigned', id);
    return this.getById(id);
  }

  async renewMembership(id: string, input: RenewMembershipInput, actor: IamActor): Promise<MemberDetailDto> {
    const member = await this.mustFind(id);
    const current = member.memberships.find((m) => m.status === 'ACTIVE');
    if (!current) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'This member has no active membership to renew — assign one first.', 422);
    }
    const plan = input.planId ? await this.mustFindPlan(input.planId) : await this.mustFindPlan(current.planId);
    this.assertRenewalWindow(plan, current.endDate);

    await this.memberships.supersede(current.id);
    const now = new Date();
    const startDate = current.endDate > now ? current.endDate : now;
    const endDate = addDuration(startDate, plan.durationValue, plan.durationType);
    await this.memberships.create({
      tenantId: this.tenantId,
      memberId: id,
      planId: plan.id,
      startDate,
      endDate,
      durationDays: daysBetween(startDate, endDate),
      priceAtAssignment: plan.price,
      status: 'ACTIVE',
      autoRenew: input.autoRenew ?? current.autoRenew,
    });
    await this.audit(actor, 'member.membership_renewed', id);
    return this.getById(id);
  }

  async upgradeMembership(id: string, input: UpgradeMembershipInput, actor: IamActor): Promise<MemberDetailDto> {
    return this.changePlan(id, input.planId, actor, 'member.membership_upgraded');
  }

  async downgradeMembership(id: string, input: DowngradeMembershipInput, actor: IamActor): Promise<MemberDetailDto> {
    return this.changePlan(id, input.planId, actor, 'member.membership_downgraded');
  }

  private async changePlan(id: string, planId: string, actor: IamActor, auditAction: string): Promise<MemberDetailDto> {
    const member = await this.mustFind(id);
    const current = member.memberships.find((m) => m.status === 'ACTIVE');
    if (!current) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'This member has no active membership to change — assign one first.', 422);
    }
    const plan = await this.mustFindPlan(planId);
    this.assertPlanAssignable(plan, member);

    await this.memberships.supersede(current.id);
    const now = new Date();
    const endDate = addDuration(now, plan.durationValue, plan.durationType);
    await this.memberships.create({
      tenantId: this.tenantId,
      memberId: id,
      planId: plan.id,
      startDate: now,
      endDate,
      durationDays: daysBetween(now, endDate),
      priceAtAssignment: plan.price,
      status: 'ACTIVE',
      autoRenew: current.autoRenew,
    });
    await this.audit(actor, auditAction, id);
    return this.getById(id);
  }

  async extendMembership(id: string, input: ExtendMembershipInput, actor: IamActor): Promise<MemberDetailDto> {
    const member = await this.mustFind(id);
    const current = member.memberships.find((m) => m.status === 'ACTIVE');
    if (!current) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'This member has no active membership to extend — assign one first.', 422);
    }
    const newEndDate = addDuration(current.endDate, input.days, 'DAYS');
    await this.memberships.update(current.id, {
      endDate: newEndDate,
      durationDays: current.durationDays + input.days,
    });
    await this.audit(actor, 'member.membership_extended', id);
    return this.getById(id);
  }

  async cancelMembership(id: string, input: CancelMembershipInput, actor: IamActor): Promise<MemberDetailDto> {
    const member = await this.mustFind(id);
    const current = member.memberships.find((m) => m.status === 'ACTIVE');
    if (!current) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'This member has no active membership to cancel.', 422);
    }
    await this.memberships.cancel(current.id);
    await this.audit(actor, 'member.membership_cancelled', id);
    return this.getById(id);
  }

  /** "Resume" is the Membership Plans module's name for what Prompt 14 called "unfreeze" — same underlying action. */
  async resumeMembership(id: string, actor: IamActor): Promise<void> {
    return this.unfreeze(id, actor);
  }

  async transferBranch(id: string, input: TransferBranchInput, actor: IamActor): Promise<MemberDetailDto> {
    await this.mustFind(id);
    await this.assertBranchExists(input.branchId);
    await this.members.update(id, { branchId: input.branchId });
    await this.audit(actor, 'member.branch_transferred', id);
    return this.getById(id);
  }

  async assignTrainer(id: string, input: AssignTrainerInput, actor: IamActor): Promise<MemberDetailDto> {
    await this.mustFind(id);
    if (input.trainerId) await this.assertTrainerValid(input.trainerId);
    await this.members.update(id, { trainerId: input.trainerId });
    await this.audit(actor, 'member.trainer_assigned', id);
    return this.getById(id);
  }

  async regenerateQrCode(id: string, actor: IamActor): Promise<{ qrCodeToken: string; qrCodeImageUrl: string }> {
    await this.mustFind(id);
    const qrCodeToken = generateOpaqueToken(16);
    const qrCodeImageUrl = await buildQrCode(this.tenantId, qrCodeToken);
    await this.members.update(id, { qrCodeToken, qrCodeImageUrl });
    await this.audit(actor, 'member.qr_code_regenerated', id);
    return { qrCodeToken, qrCodeImageUrl };
  }

  async listDocuments(id: string): Promise<MemberDocumentDto[]> {
    await this.mustFind(id);
    const rows = await this.documents.list(this.tenantId, id);
    return rows.map((d) => ({
      id: d.id,
      type: d.type,
      fileName: d.fileName,
      fileDataUrl: d.fileDataUrl,
      uploadedAt: d.uploadedAt.toISOString(),
    }));
  }

  async uploadDocument(id: string, input: UploadDocumentInput, actor: IamActor): Promise<MemberDocumentDto> {
    await this.mustFind(id);
    const doc = await this.documents.create({
      tenantId: this.tenantId,
      memberId: id,
      type: input.type,
      fileName: input.fileName,
      fileDataUrl: input.fileDataUrl,
    });
    await this.audit(actor, 'member.document_uploaded', id);
    return {
      id: doc.id,
      type: doc.type,
      fileName: doc.fileName,
      fileDataUrl: doc.fileDataUrl,
      uploadedAt: doc.uploadedAt.toISOString(),
    };
  }

  async deleteDocument(id: string, documentId: string, actor: IamActor): Promise<void> {
    await this.mustFind(id);
    const doc = await this.documents.findById(this.tenantId, documentId);
    if (!doc || doc.memberId !== id) throw new NotFoundError('Document not found.');
    await this.documents.delete(documentId);
    await this.audit(actor, 'member.document_deleted', id);
  }

  /** CSV export — Excel opens CSV natively. */
  async exportCsv(): Promise<string> {
    const rows = await this.members.listForExport(this.tenantId);
    const header =
      'Member ID,First Name,Last Name,Email,Phone,Status,Branch,Trainer,Current Plan,Membership Status,Membership End Date,Joining Date';
    const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    const lines = rows.map((m) => {
      const dto = toListItem(m);
      return [
        dto.memberId,
        escape(dto.firstName),
        escape(dto.lastName),
        dto.email ?? '',
        dto.phone ?? '',
        dto.status,
        escape(dto.branch.name),
        dto.trainer ? escape(dto.trainer.name) : '',
        dto.currentMembership ? escape(dto.currentMembership.planName) : '',
        dto.currentMembership?.status ?? '',
        dto.currentMembership?.endDate.slice(0, 10) ?? '',
        dto.joiningDate.slice(0, 10),
      ].join(',');
    });
    return [header, ...lines].join('\n');
  }

  /** Bulk import — one bad row never rolls back the others. */
  async bulkImport(rows: MemberBulkImportRow[], actor: IamActor): Promise<MemberBulkImportResult> {
    const defaultBranch =
      (await this.db.branch.findFirst({ where: { tenantId: this.tenantId, isDefault: true } })) ??
      (await this.db.branch.findFirst({ where: { tenantId: this.tenantId, isActive: true } }));

    const result: MemberBulkImportResult = { created: 0, failed: [] };
    for (const [index, row] of rows.entries()) {
      const name = `${row.firstName} ${row.lastName}`.trim();
      try {
        let branchId = defaultBranch?.id;
        if (row.branchName) {
          const branch = await this.db.branch.findFirst({
            where: { tenantId: this.tenantId, name: { equals: row.branchName, mode: 'insensitive' } },
          });
          if (branch) branchId = branch.id;
        }
        if (!branchId) throw new Error('No branch available to assign — create a branch first.');

        let trainerId: string | undefined;
        if (row.trainerEmail) {
          const trainer = await this.db.user.findFirst({
            where: { tenantId: this.tenantId, email: row.trainerEmail.toLowerCase(), deletedAt: null },
          });
          if (trainer) trainerId = trainer.id;
        }

        const member = await this.create(
          {
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email || undefined,
            phone: row.phone || undefined,
            memberId: row.memberId || undefined,
            branchId,
            trainerId,
          },
          actor,
        );

        if (row.planName) {
          const plan = await this.membershipPlans.findByName(this.tenantId, row.planName);
          if (plan) await this.assignMembership(member.id, { planId: plan.id }, actor);
        }
        result.created += 1;
      } catch (error) {
        result.failed.push({ row: index + 1, name, reason: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    return result;
  }

  async bulkActivate(memberIds: string[], actor: IamActor): Promise<BulkMemberActionResult> {
    return this.bulkAction(memberIds, actor, (id, a) => this.activate(id, a));
  }

  async bulkDeactivate(memberIds: string[], actor: IamActor): Promise<BulkMemberActionResult> {
    return this.bulkAction(memberIds, actor, (id, a) => this.deactivate(id, a));
  }

  async bulkDelete(memberIds: string[], actor: IamActor): Promise<BulkMemberActionResult> {
    return this.bulkAction(memberIds, actor, (id, a) => this.softDelete(id, a));
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async bulkAction(
    memberIds: string[],
    actor: IamActor,
    action: (id: string, actor: IamActor) => Promise<void>,
  ): Promise<BulkMemberActionResult> {
    const result: BulkMemberActionResult = { succeeded: [], failed: [] };
    for (const memberId of memberIds) {
      try {
        await action(memberId, actor);
        result.succeeded.push(memberId);
      } catch (error) {
        result.failed.push({ memberId, reason: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    return result;
  }

  private async mustFind(id: string, opts?: { includeDeleted?: boolean }): Promise<MemberRow> {
    const member = await this.members.findDetail(this.tenantId, id, opts);
    if (!member) throw new NotFoundError('Member not found.');
    return member;
  }

  private async mustFindPlan(planId: string) {
    const plan = await this.membershipPlans.findById(this.tenantId, planId);
    if (!plan) throw new NotFoundError('Membership plan not found.');
    if (!plan.isActive) throw new AppError(ErrorCode.VALIDATION_ERROR, `Plan "${plan.name}" is inactive.`, 422);
    if (plan.deletedAt) throw new NotFoundError('Membership plan not found.');
    return plan;
  }

  /** Plan purchase window + member age eligibility — both no-op when the plan doesn't set them. */
  private assertPlanAssignable(plan: MembershipPlanRow, member: MemberRow): void {
    const now = new Date();
    if (plan.validityStart && now < plan.validityStart) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Plan "${plan.name}" is not available for purchase yet.`, 422);
    }
    if (plan.validityEnd && now > plan.validityEnd) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Plan "${plan.name}" is no longer available for purchase.`, 422);
    }
    if ((plan.minAge !== null || plan.maxAge !== null) && member.dateOfBirth) {
      const age = ageInYears(member.dateOfBirth, now);
      if (plan.minAge !== null && age < plan.minAge) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, `Plan "${plan.name}" requires a minimum age of ${plan.minAge}.`, 422);
      }
      if (plan.maxAge !== null && age > plan.maxAge) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, `Plan "${plan.name}" has a maximum age of ${plan.maxAge}.`, 422);
      }
    }
  }

  /** `renewalWindowDays === 0` means "anytime" — otherwise renewal is blocked until that many days before expiry. */
  private assertRenewalWindow(plan: MembershipPlanRow, currentEndDate: Date): void {
    if (plan.renewalWindowDays <= 0) return;
    const windowOpensAt = addDuration(currentEndDate, -plan.renewalWindowDays, 'DAYS');
    if (new Date() < windowOpensAt) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `Plan "${plan.name}" can only be renewed within ${plan.renewalWindowDays} day(s) of expiry.`,
        422,
      );
    }
  }

  private async assertEmailAvailable(email: string): Promise<void> {
    const existing = await this.members.findByEmail(this.tenantId, email.toLowerCase());
    if (existing) throw new ConflictError(ErrorCode.CONFLICT, 'A member with this email already exists.');
  }

  private async assertPhoneAvailable(phone: string): Promise<void> {
    const existing = await this.members.findByPhone(this.tenantId, phone);
    if (existing) throw new ConflictError(ErrorCode.CONFLICT, 'A member with this phone number already exists.');
  }

  private async assertMemberCodeAvailable(memberId: string): Promise<string> {
    const existing = await this.members.findByMemberId(this.tenantId, memberId);
    if (existing) throw new ConflictError(ErrorCode.CONFLICT, 'This Member ID is already in use.');
    return memberId;
  }

  private async assertBranchExists(branchId: string): Promise<void> {
    const found = await this.db.branch.count({ where: { id: branchId, tenantId: this.tenantId, isActive: true } });
    if (found === 0) throw new NotFoundError('Selected branch does not exist or is inactive.');
  }

  private async assertTrainerValid(trainerId: string): Promise<void> {
    const trainer = await this.db.user.findFirst({
      where: { id: trainerId, tenantId: this.tenantId, deletedAt: null, userRoles: { some: { role: { name: 'TRAINER' } } } },
    });
    if (!trainer) throw new NotFoundError('Selected trainer does not exist or is not a Trainer.');
  }

  /** No live enforcement existed anywhere before Staff Management (Prompt 13) added the pattern — mirrored here for members. */
  private async assertMemberCapacity(): Promise<void> {
    const limit = await this.db.tenantLimit.findUnique({ where: { tenantId: this.tenantId } });
    if (!limit) return;
    const total = await this.members.countTotal(this.tenantId);
    if (total >= limit.maxMembers) {
      throw new ConflictError(
        ErrorCode.CONFLICT,
        `Your plan allows up to ${limit.maxMembers} member(s). Upgrade your plan to add more.`,
      );
    }
  }

  private async audit(actor: IamActor, action: string, entityId: string): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType: 'member',
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function ageInYears(dateOfBirth: Date, at: Date): number {
  let age = at.getFullYear() - dateOfBirth.getFullYear();
  const hasHadBirthdayThisYear =
    at.getMonth() > dateOfBirth.getMonth() ||
    (at.getMonth() === dateOfBirth.getMonth() && at.getDate() >= dateOfBirth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}
