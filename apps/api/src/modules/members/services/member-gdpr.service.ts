import { NotFoundError } from '../../../core/errors/app-error';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import type { MemberGdprExportDto } from '../dto/member.dto';
import { MemberRepository } from '../repositories/member.repository';

/**
 * GDPR export/erasure (audit remediation, Prompt 46) — a standalone service
 * (not folded into `MemberService`) so it can be called identically from
 * both the staff-side controller AND the member-portal's own self-service
 * export endpoint, same "one core engine, two entry points" shape as the
 * mandatory-2FA module.
 */
export class MemberGdprService {
  private readonly db: TenantScopedPrisma;
  private readonly members: MemberRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.members = new MemberRepository(this.db);
    this.auditLog = new AuditLogRepository(this.db);
  }

  /**
   * Everything genuinely personal about this member, in one bundle — a
   * "right to data portability" export. Document CONTENTS aren't included
   * (only filename/type/upload date) — there's no object-storage delete
   * capability in this codebase yet either (see `eraseData` below), so
   * fetching+re-serving binary files here was out of scope for this pass.
   */
  async exportData(memberId: string): Promise<MemberGdprExportDto> {
    const member = await this.members.findDetail(this.tenantId, memberId, { includeDeleted: true });
    if (!member) throw new NotFoundError('Member not found.');

    const [attendance, workoutPlans, dietPlans, invoices, payments, documents, classBookings] = await Promise.all([
      this.db.attendance.findMany({ where: { tenantId: this.tenantId, memberId }, orderBy: { checkInTime: 'desc' } }),
      this.db.memberWorkoutPlan.findMany({
        where: { tenantId: this.tenantId, memberId },
        include: { workoutPlan: { select: { name: true } }, progress: true },
        orderBy: { assignedDate: 'desc' },
      }),
      this.db.memberDietPlan.findMany({
        where: { tenantId: this.tenantId, memberId },
        include: { dietPlan: { select: { name: true } }, dailyLogs: true },
        orderBy: { assignedDate: 'desc' },
      }),
      this.db.memberInvoice.findMany({ where: { tenantId: this.tenantId, memberId }, orderBy: { invoiceDate: 'desc' } }),
      this.db.memberPayment.findMany({ where: { tenantId: this.tenantId, memberId }, orderBy: { paymentDate: 'desc' } }),
      this.db.memberDocument.findMany({ where: { tenantId: this.tenantId, memberId } }),
      this.db.classBooking.findMany({
        where: { tenantId: this.tenantId, memberId },
        include: { classSession: { include: { groupClass: { select: { name: true } } } } },
        orderBy: { bookedAt: 'desc' },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        id: member.id,
        memberId: member.memberId,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        phone: member.phone,
        gender: member.gender,
        dateOfBirth: member.dateOfBirth?.toISOString().slice(0, 10) ?? null,
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
        branch: member.branch.name,
        trainer: member.trainer?.name ?? null,
        status: member.status,
        joiningDate: member.joiningDate.toISOString().slice(0, 10),
        createdAt: member.createdAt.toISOString(),
      },
      memberships: member.memberships.map((m) => ({
        planName: m.plan.name,
        startDate: m.startDate.toISOString().slice(0, 10),
        endDate: m.endDate.toISOString().slice(0, 10),
        status: m.status,
        priceAtAssignment: m.priceAtAssignment.toString(),
        autoRenew: m.autoRenew,
      })),
      freezes: member.freezes.map((f) => ({
        reason: f.reason,
        frozenAt: f.frozenAt.toISOString(),
        unfrozenAt: f.unfrozenAt?.toISOString() ?? null,
      })),
      attendance: attendance.map((a) => ({
        checkInTime: a.checkInTime.toISOString(),
        checkOutTime: a.checkOutTime?.toISOString() ?? null,
        method: a.method,
        status: a.status,
      })),
      workoutPlans: workoutPlans.map((p) => ({
        planName: p.workoutPlan.name,
        startDate: p.startDate.toISOString().slice(0, 10),
        endDate: p.endDate?.toISOString().slice(0, 10) ?? null,
        status: p.status,
        progressEntries: p.progress.length,
      })),
      dietPlans: dietPlans.map((p) => ({
        planName: p.dietPlan.name,
        startDate: p.startDate.toISOString().slice(0, 10),
        endDate: p.endDate?.toISOString().slice(0, 10) ?? null,
        status: p.status,
        dailyLogEntries: p.dailyLogs.length,
      })),
      invoices: invoices.map((i) => ({
        invoiceNumber: i.invoiceNumber,
        invoiceDate: i.invoiceDate.toISOString().slice(0, 10),
        totalAmount: i.totalAmount.toString(),
        status: i.status,
      })),
      payments: payments.map((p) => ({
        paymentNumber: p.paymentNumber,
        paymentDate: p.paymentDate.toISOString().slice(0, 10),
        finalAmount: p.finalAmount.toString(),
        method: p.method,
        status: p.status,
      })),
      documents: documents.map((d) => ({ type: d.type, fileName: d.fileName, uploadedAt: d.uploadedAt.toISOString() })),
      classBookings: classBookings.map((b) => ({
        className: b.classSession.groupClass.name,
        sessionDate: b.classSession.sessionDate.toISOString().slice(0, 10),
        status: b.status,
        bookedAt: b.bookedAt.toISOString(),
      })),
    };
  }

  /**
   * Right-to-erasure: ANONYMIZES the member row rather than hard-deleting
   * it. Financial records (invoices/payments) legally need to be retained
   * for accounting — deleting the `Member` row entirely would either cascade
   * away audit-required financial history or be blocked by the `onDelete:
   * Restrict` FKs those tables already have (see schema.prisma). Once the
   * name/contact/medical fields on the source `Member` row are gone, the
   * financial rows referencing `memberId` carry no PII on their own.
   *
   * Portal access (credential/sessions/verification tokens) and uploaded
   * documents ARE hard-deleted — nothing legally requires keeping those.
   * **Known limitation**: this deletes the `MemberDocument` DB rows but not
   * the underlying object-storage files — no delete-object capability
   * exists anywhere in this codebase yet (`core/storage/storage.service.ts`
   * only has upload/presign). A future pass adding real storage deletion
   * should wire it in here.
   */
  async eraseData(memberId: string, actor: IamActor): Promise<void> {
    const member = await this.members.findDetail(this.tenantId, memberId, { includeDeleted: true });
    if (!member) throw new NotFoundError('Member not found.');

    await this.db.memberSession.deleteMany({ where: { tenantId: this.tenantId, memberId } });
    await this.db.memberVerification.deleteMany({ where: { tenantId: this.tenantId, memberId } });
    await this.db.memberCredential.deleteMany({ where: { tenantId: this.tenantId, memberId } });
    await this.db.memberDocument.deleteMany({ where: { tenantId: this.tenantId, memberId } });

    await this.members.update(memberId, {
      firstName: 'Erased',
      lastName: 'Member',
      email: null,
      phone: null,
      profilePhotoUrl: null,
      dateOfBirth: null,
      bloodGroup: null,
      height: null,
      weight: null,
      occupation: null,
      addressLine: null,
      city: null,
      state: null,
      country: null,
      postalCode: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      emergencyContactRelation: null,
      medicalConditions: null,
      allergies: null,
      fitnessGoals: null,
      notes: 'Personal data erased per GDPR request.',
      status: 'INACTIVE',
      deletedAt: new Date(),
    });

    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'member.gdpr_erased',
      entityType: 'member',
      entityId: memberId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  }
}
