import type { DeviceTokenPlatform, Prisma } from '@prisma/client';

import { env } from '../../../config/env';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { AttendanceRepository } from '../../attendance/repositories/attendance.repository';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import { ClassBookingService } from '../../classes/services/class-booking.service';
import { ClassSessionService } from '../../classes/services/class-session.service';
import { deviceTokenService } from '../../device-tokens/services/device-token.service';
import { MemberDietPlanRepository } from '../../diet/repositories/member-diet-plan.repository';
import { MemberPaymentRepository } from '../../finance/repositories/member-payment.repository';
import { MemberInvoiceService } from '../../finance/services/member-invoice.service';
import { MemberPaymentService } from '../../finance/services/member-payment.service';
import { createOrder, verifyOrderPaymentSignature } from '../../finance/services/razorpay-gateway.service';
import { MeasurementService } from '../../measurements/services/measurement.service';
import { MemberRepository } from '../../members/repositories/member.repository';
import { MembershipRepository } from '../../members/repositories/membership.repository';
import { assertRenewalEligible, performRenewal, MemberService } from '../../members/services/member.service';
import { computeFinalMembershipPrice } from '../../members/utils/plan-pricing.util';
import { notifyMembershipRenewed } from '../../tenant-notifications/services/notification-trigger.service';
import { tenantNotificationService } from '../../tenant-notifications/services/tenant-notification.service';
import { tenantService } from '../../tenants/service/tenant.service';
import { MemberWorkoutPlanRepository } from '../../workouts/repositories/member-workout-plan.repository';

/** Same shape `SubscriptionService#startCheckout`/`OnboardingService#startCheckout` already return — both tenant-web's and mobile's existing Checkout-modal code consume this exact union with zero translation. */
export type RenewalCheckoutResult =
  | { requiresPayment: false }
  | { requiresPayment: true; paymentId: string; orderId: string; amount: number; currency: string; keyId: string };

export interface VerifyRenewalCheckoutInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

/** `'SUCCESS'`/`'FAILED'` matches `MemberPaymentStatus` directly (the Prisma enum this payment actually uses) — deliberately not `'SUCCEEDED'` like the platform-billing `Payment` model's own enum, a different model entirely. */
export interface VerifyRenewalCheckoutResult {
  status: 'SUCCESS' | 'FAILED';
}

/**
 * Every method here is called with the member's OWN id (`req.memberAuth.sub`)
 * — never a caller-supplied one — so there is no separate "permission check"
 * step the way staff routes have `requirePermission`. The member auth plane
 * has no RBAC at all (see member-jwt.service.ts); "can this member see this
 * row" is enforced entirely by always filtering queries to their own id,
 * the same application-level pattern branch-scoping already uses elsewhere
 * in this codebase (RLS isolates by tenant, not by member-within-tenant).
 */
export class MemberPortalService {
  private readonly db: TenantScopedPrisma;
  private readonly attendance: AttendanceRepository;
  private readonly workoutAssignments: MemberWorkoutPlanRepository;
  private readonly dietAssignments: MemberDietPlanRepository;
  private readonly invoices: MemberInvoiceService;
  private readonly auditLog: AuditLogRepository;
  private readonly classSessions: ClassSessionService;
  private readonly classBookings: ClassBookingService;
  private readonly members: MemberRepository;
  private readonly memberships: MembershipRepository;
  private readonly payments: MemberPaymentRepository;
  private readonly paymentService: MemberPaymentService;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.attendance = new AttendanceRepository(this.db);
    this.workoutAssignments = new MemberWorkoutPlanRepository(this.db);
    this.dietAssignments = new MemberDietPlanRepository(this.db);
    this.invoices = new MemberInvoiceService(tenantId);
    this.auditLog = new AuditLogRepository(this.db);
    this.classSessions = new ClassSessionService(tenantId);
    this.classBookings = new ClassBookingService(tenantId);
    this.members = new MemberRepository(this.db);
    this.memberships = new MembershipRepository(this.db);
    this.payments = new MemberPaymentRepository(this.db);
    this.paymentService = new MemberPaymentService(tenantId);
  }

  /** Reuses the exact same DTO the staff-side member detail page renders — it's the member's own data, so nothing needs hiding. */
  async getProfile(memberId: string) {
    return new MemberService(this.tenantId).getOwnProfile(memberId);
  }

  /**
   * Self-service renewal, step 1 — same "no self-service upgrade/downgrade"
   * scope as staff's own Renew action: this only ever renews the member's
   * CURRENT plan, and only once it has actually expired (`assertRenewalEligible`,
   * shared with `MemberService#renewMembership` so both paths enforce the
   * identical rule). The amount is always computed HERE from the plan's own
   * price/discount%/tax% (`computeFinalMembershipPrice`) — never accepted
   * from the client, since unlike the staff-trusted Add Member wizard, the
   * caller here is the member themselves. Mirrors `SubscriptionService#startCheckout`'s
   * shape exactly (Razorpay Orders + Checkout-modal, not a Payment Link —
   * see BACKEND-GUIDE.md's note on Payment Links' ~50% intermittent
   * failure rate on self-service-style flows) so both tenant-web and mobile
   * can reuse their existing Checkout-modal code against this response
   * almost verbatim.
   */
  async startRenewalCheckout(memberId: string): Promise<RenewalCheckoutResult> {
    const member = await this.members.findDetail(this.tenantId, memberId);
    if (!member) throw new NotFoundError('Member not found.');
    const current = await this.memberships.findActiveForMember(this.tenantId, memberId);
    if (!current) throw new AppError(ErrorCode.VALIDATION_ERROR, 'You have no membership to renew — contact the front desk.', 422);
    assertRenewalEligible(current);

    const price = computeFinalMembershipPrice(current.plan);
    if (price.finalPrice <= 0) {
      const renewed = await performRenewal(this.memberships, this.tenantId, memberId, current.id, current.plan, current.autoRenew);
      await this.auditLog.record({ tenantId: this.tenantId, actorUserId: null, actorRole: 'MEMBER', action: 'member_portal.renewed_free', entityType: 'Membership', entityId: renewed.id });
      await notifyMembershipRenewed(this.tenantId, {
        memberId: member.id,
        memberName: `${member.firstName} ${member.lastName}`.trim(),
        planName: current.plan.name,
        endDate: renewed.endDate.toISOString().slice(0, 10),
        memberEmail: member.email,
      });
      return { requiresPayment: false };
    }

    const paymentNumber = await this.payments.nextPaymentNumber(this.tenantId);
    const payment = await this.payments.create({
      tenantId: this.tenantId,
      paymentNumber,
      memberId,
      membershipId: current.id,
      branchId: member.branchId,
      amount: price.basePrice,
      discount: price.discountAmount,
      tax: price.taxAmount,
      finalAmount: price.finalPrice,
      method: 'ONLINE_GATEWAY',
      paymentDate: new Date(),
      status: 'PENDING',
      notes: 'Self-service membership renewal',
      recordedBy: null,
    });

    const order = await createOrder({
      amountInSmallestUnit: Math.round(price.finalPrice * 100),
      currency: 'INR',
      receipt: payment.paymentNumber,
      notes: { memberPaymentId: payment.id, tenantId: this.tenantId },
    });
    await this.payments.update(payment.id, { transactionReference: order.id });

    return {
      requiresPayment: true,
      paymentId: payment.id,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: env.razorpay.keyId!,
    };
  }

  /**
   * Self-service renewal, step 2 — called once Razorpay's Checkout modal
   * fires its success handler. Re-derives ownership (`payment.member.id ===
   * memberId`, never trusted from the route alone) before touching
   * anything, verifies the signature locally (no Razorpay API call), then
   * renews the membership (`performRenewal`, the same mutation staff's own
   * Renew action uses) and hands the payment off to
   * `MemberPaymentService#applyWebhookOutcome` — the exact same
   * invoice-generation/income-row/notification orchestration a Payment
   * Link's real webhook delivery already triggers, reused rather than
   * duplicated.
   */
  async verifyRenewalCheckout(memberId: string, paymentId: string, input: VerifyRenewalCheckoutInput): Promise<VerifyRenewalCheckoutResult> {
    const payment = await this.payments.findById(this.tenantId, paymentId);
    if (!payment || payment.member.id !== memberId) throw new NotFoundError('Payment not found.');
    if (payment.status === 'SUCCESS' || payment.status === 'FAILED') return { status: payment.status };
    if (payment.transactionReference !== input.razorpayOrderId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'This payment does not match the order being verified.', 400);
    }

    const valid = verifyOrderPaymentSignature({
      orderId: input.razorpayOrderId,
      paymentId: input.razorpayPaymentId,
      signature: input.razorpaySignature,
    });
    if (!valid) {
      await this.paymentService.applyWebhookOutcome(paymentId, 'failed');
      return { status: 'FAILED' };
    }

    const current = await this.memberships.findActiveForMember(this.tenantId, memberId);
    if (!current) throw new ConflictError(ErrorCode.CONFLICT, 'No active membership was found to renew.');
    assertRenewalEligible(current);
    const member = await this.members.findDetail(this.tenantId, memberId);
    if (!member) throw new NotFoundError('Member not found.');

    const renewed = await performRenewal(this.memberships, this.tenantId, memberId, current.id, current.plan, current.autoRenew);
    await this.payments.update(paymentId, { membershipId: renewed.id });
    await this.paymentService.applyWebhookOutcome(paymentId, 'paid', input.razorpayPaymentId);
    await this.auditLog.record({ tenantId: this.tenantId, actorUserId: null, actorRole: 'MEMBER', action: 'member_portal.renewed_paid', entityType: 'Membership', entityId: renewed.id });
    await notifyMembershipRenewed(this.tenantId, {
      memberId: member.id,
      memberName: `${member.firstName} ${member.lastName}`.trim(),
      planName: current.plan.name,
      endDate: renewed.endDate.toISOString().slice(0, 10),
      memberEmail: member.email,
    });

    return { status: 'SUCCESS' };
  }

  /**
   * Self-service "pay my outstanding invoice", step 1 — same Razorpay
   * Orders + Checkout-modal shape as `startRenewalCheckout`, reused
   * verbatim by both frontends. Unlike renewal, the amount is never
   * computed here — it's just the invoice's own `totalAmount`, already
   * fixed at generation time. Rejects an invoice that's already settled,
   * voided, or already has an active payment against it — same "one
   * payment per invoice" rule `MemberPaymentService#create` enforces for
   * staff-recorded payments.
   */
  async startInvoicePaymentCheckout(memberId: string, invoiceId: string): Promise<RenewalCheckoutResult> {
    const invoice = await this.db.memberInvoice.findFirst({ where: { tenantId: this.tenantId, id: invoiceId, memberId } });
    if (!invoice) throw new NotFoundError('Invoice not found.');
    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
      throw new ConflictError(ErrorCode.CONFLICT, 'This invoice is already settled.');
    }
    const existing = await this.payments.findActiveByInvoice(this.tenantId, invoiceId);
    if (existing) throw new ConflictError(ErrorCode.CONFLICT, 'This invoice already has a payment in progress.');

    const amount = Number(invoice.totalAmount);
    const paymentNumber = await this.payments.nextPaymentNumber(this.tenantId);
    const payment = await this.payments.create({
      tenantId: this.tenantId,
      paymentNumber,
      memberId,
      invoiceId,
      branchId: invoice.branchId,
      amount,
      discount: 0,
      tax: 0,
      finalAmount: amount,
      method: 'ONLINE_GATEWAY',
      paymentDate: new Date(),
      status: 'PENDING',
      notes: 'Self-service invoice payment',
      recordedBy: null,
    });

    const order = await createOrder({
      amountInSmallestUnit: Math.round(amount * 100),
      currency: 'INR',
      receipt: payment.paymentNumber,
      notes: { memberPaymentId: payment.id, tenantId: this.tenantId },
    });
    await this.payments.update(payment.id, { transactionReference: order.id });

    return {
      requiresPayment: true,
      paymentId: payment.id,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: env.razorpay.keyId!,
    };
  }

  /**
   * Self-service "pay my outstanding invoice", step 2 — verifies the
   * signature locally, then hands off to the exact same
   * `MemberPaymentService#applyWebhookOutcome` orchestration every other
   * settlement path uses (marks the invoice PAID, generates the Income
   * row, activates a PENDING membership if this invoice was its
   * registration fee, sends the payment-received notification). Nothing
   * membership-specific happens here — that's all inside
   * `onPaymentSucceeded`, reused rather than duplicated.
   */
  async verifyInvoicePaymentCheckout(memberId: string, invoiceId: string, paymentId: string, input: VerifyRenewalCheckoutInput): Promise<VerifyRenewalCheckoutResult> {
    const payment = await this.payments.findById(this.tenantId, paymentId);
    if (!payment || payment.member.id !== memberId || payment.invoiceId !== invoiceId) throw new NotFoundError('Payment not found.');
    if (payment.status === 'SUCCESS' || payment.status === 'FAILED') return { status: payment.status };
    if (payment.transactionReference !== input.razorpayOrderId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'This payment does not match the order being verified.', 400);
    }

    const valid = verifyOrderPaymentSignature({
      orderId: input.razorpayOrderId,
      paymentId: input.razorpayPaymentId,
      signature: input.razorpaySignature,
    });
    if (!valid) {
      await this.paymentService.applyWebhookOutcome(paymentId, 'failed');
      return { status: 'FAILED' };
    }

    await this.paymentService.applyWebhookOutcome(paymentId, 'paid', input.razorpayPaymentId);
    await this.auditLog.record({ tenantId: this.tenantId, actorUserId: null, actorRole: 'MEMBER', action: 'member_portal.invoice_paid', entityType: 'MemberInvoice', entityId: invoiceId });

    return { status: 'SUCCESS' };
  }

  async getAttendance(memberId: string, pagination: { page: number; limit: number }) {
    const { items, total } = await this.attendance.findByMember(this.tenantId, memberId, pagination);
    return {
      items: items.map((a) => ({
        id: a.id,
        branch: { id: a.branch.id, name: a.branch.name },
        checkInTime: a.checkInTime.toISOString(),
        checkOutTime: a.checkOutTime?.toISOString() ?? null,
        attendanceDate: a.attendanceDate.toISOString().slice(0, 10),
        method: a.method,
        status: a.status,
      })),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
    };
  }

  async getWorkout(memberId: string) {
    const assignment = await this.workoutAssignments.findActiveByMember(this.tenantId, memberId);
    return assignment ? toWorkoutAssignmentDto(assignment) : null;
  }

  async markWorkoutProgress(memberId: string, assignmentId: string, input: { exerciseId: string; status: 'PENDING' | 'COMPLETED' | 'SKIPPED'; notes?: string }) {
    const assignment = await this.workoutAssignments.findById(this.tenantId, assignmentId);
    if (!assignment || assignment.memberId !== memberId) throw new NotFoundError('Workout plan assignment not found.');
    const belongsToPlan = assignment.workoutPlan.exercises.some((e) => e.exerciseId === input.exerciseId);
    if (!belongsToPlan) throw new ValidationError('This exercise is not part of your assigned workout plan.');

    await this.workoutAssignments.upsertProgress(this.tenantId, assignmentId, input.exerciseId, { status: input.status, notes: input.notes });
    await this.auditLog.record({ tenantId: this.tenantId, actorUserId: null, actorRole: 'MEMBER', action: 'member_portal.workout_progress_marked', entityType: 'member_workout_plan', entityId: assignmentId });
    return toWorkoutAssignmentDto((await this.workoutAssignments.findById(this.tenantId, assignmentId))!);
  }

  async getDiet(memberId: string) {
    const assignment = await this.dietAssignments.findActiveByMember(this.tenantId, memberId);
    return assignment ? toDietAssignmentDto(assignment) : null;
  }

  /** Reuses the staff-side service's DTO shape — it's the member's own history, newest first, nothing needs hiding. */
  async getMeasurements(memberId: string) {
    return new MeasurementService(this.tenantId).listForSelf(memberId);
  }

  /** Same merge-not-overwrite semantics as the staff-side `DietPlanService#updateProgress` — a partial update (e.g. just water) must not wipe an already-logged meal for the same day. */
  async logDiet(memberId: string, assignmentId: string, input: { date: string; waterIntakeMl?: number; weightKg?: number; mealsStatus?: Record<string, 'PENDING' | 'COMPLETED' | 'SKIPPED'>; notes?: string }) {
    const assignment = await this.dietAssignments.findById(this.tenantId, assignmentId);
    if (!assignment || assignment.memberId !== memberId) throw new NotFoundError('Diet plan assignment not found.');

    const date = new Date(input.date);
    if (Number.isNaN(date.getTime())) throw new ValidationError('Invalid date.');

    const planMealTypes = new Set(assignment.dietPlan.meals.map((m) => m.mealType));
    if (input.mealsStatus) {
      for (const mealType of Object.keys(input.mealsStatus)) {
        if (!planMealTypes.has(mealType as never)) throw new ValidationError(`"${mealType}" is not part of your assigned diet plan.`);
      }
    }

    const dateStr = date.toISOString().slice(0, 10);
    const existingLog = assignment.dailyLogs.find((log) => log.date.toISOString().slice(0, 10) === dateStr);
    const existingMealsStatus = (existingLog?.mealsStatus as Record<string, string> | null) ?? {};

    await this.dietAssignments.upsertDailyLog(this.tenantId, assignmentId, date, {
      waterIntakeMl: input.waterIntakeMl ?? existingLog?.waterIntakeMl ?? undefined,
      weightKg: input.weightKg ?? (existingLog?.weightKg ? Number(existingLog.weightKg) : undefined),
      mealsStatus: { ...existingMealsStatus, ...input.mealsStatus } as Prisma.InputJsonValue,
      notes: input.notes ?? existingLog?.notes ?? undefined,
    });
    await this.auditLog.record({ tenantId: this.tenantId, actorUserId: null, actorRole: 'MEMBER', action: 'member_portal.diet_progress_logged', entityType: 'member_diet_plan', entityId: assignmentId });
    return toDietAssignmentDto((await this.dietAssignments.findById(this.tenantId, assignmentId))!);
  }

  async getInvoices(memberId: string, pagination: { page: number; limit: number }) {
    return this.invoices.listOwn({ page: pagination.page, limit: pagination.limit, memberId, sortBy: 'invoiceDate', sortDir: 'desc' });
  }

  async downloadInvoicePdf(memberId: string, invoiceId: string): Promise<{ filename: string; content: Buffer }> {
    const invoice = await this.invoices.getOwnById(invoiceId);
    if (invoice.member.id !== memberId) throw new NotFoundError('Invoice not found.');
    const tenant = await tenantService.resolveById(this.tenantId);
    if (!tenant) throw new AppError(ErrorCode.NOT_FOUND, 'Tenant not found.', 404);
    const content = await this.invoices.renderOwnPdf(invoiceId, tenant.name);
    return { filename: `${invoice.invoiceNumber}.pdf`, content };
  }

  /** Upcoming sessions at the member's own branch — no cross-branch browsing in this pass. */
  async getUpcomingClasses(memberId: string, dateFrom: string, dateTo: string) {
    const member = await this.db.member.findFirst({ where: { tenantId: this.tenantId, id: memberId }, select: { branchId: true } });
    if (!member) throw new NotFoundError('Member not found.');
    return this.classSessions.listByRange(undefined, { branchId: member.branchId, dateFrom, dateTo });
  }

  async bookClass(memberId: string, sessionId: string) {
    return this.classBookings.book(sessionId, memberId, { role: 'MEMBER' });
  }

  async cancelBooking(memberId: string, bookingId: string): Promise<void> {
    await this.classBookings.cancel(bookingId, memberId, { role: 'MEMBER' });
  }

  async getMyBookings(memberId: string) {
    return this.classBookings.listForMember(memberId);
  }

  async registerDeviceToken(memberId: string, token: string, platform: DeviceTokenPlatform): Promise<void> {
    await deviceTokenService.registerMemberToken(this.tenantId, memberId, token, platform);
  }

  async unregisterDeviceToken(token: string): Promise<void> {
    await deviceTokenService.unregisterMemberToken(this.tenantId, token);
  }

  async getNotifications(memberId: string, params: { unreadOnly?: boolean; page: number; limit: number }) {
    return tenantNotificationService.listForMember(this.tenantId, memberId, params);
  }

  async getUnreadNotificationCount(memberId: string) {
    return tenantNotificationService.unreadCountForMember(this.tenantId, memberId);
  }

  async markNotificationRead(memberId: string, id: string): Promise<void> {
    await tenantNotificationService.markReadForMember(this.tenantId, memberId, id);
  }

  async markAllNotificationsRead(memberId: string): Promise<void> {
    await tenantNotificationService.markAllReadForMember(this.tenantId, memberId);
  }
}

function toWorkoutAssignmentDto(assignment: Awaited<ReturnType<MemberWorkoutPlanRepository['findActiveByMember']>>) {
  const a = assignment!;
  return {
    id: a.id,
    status: a.status,
    startDate: a.startDate.toISOString().slice(0, 10),
    endDate: a.endDate?.toISOString().slice(0, 10) ?? null,
    trainerRemarks: a.trainerRemarks,
    workoutPlan: {
      id: a.workoutPlan.id,
      name: a.workoutPlan.name,
      level: a.workoutPlan.level,
      durationWeeks: a.workoutPlan.durationWeeks,
      exercises: a.workoutPlan.exercises.map((e) => ({ exerciseId: e.exerciseId, name: e.exercise.name, dayOfWeek: e.dayOfWeek })),
    },
    progress: a.progress.map((p) => ({ exerciseId: p.exerciseId, status: p.status, notes: p.notes, markedAt: p.markedAt?.toISOString() ?? null })),
  };
}

function toDietAssignmentDto(assignment: Awaited<ReturnType<MemberDietPlanRepository['findActiveByMember']>>) {
  const a = assignment!;
  return {
    id: a.id,
    status: a.status,
    startDate: a.startDate.toISOString().slice(0, 10),
    endDate: a.endDate?.toISOString().slice(0, 10) ?? null,
    trainerRemarks: a.trainerRemarks,
    dietPlan: {
      id: a.dietPlan.id,
      name: a.dietPlan.name,
      dailyCalories: a.dietPlan.dailyCalories,
      durationDays: a.dietPlan.durationDays,
      mealTypes: a.dietPlan.meals.map((m) => m.mealType),
    },
    dailyLogs: a.dailyLogs.map((l) => ({
      date: l.date.toISOString().slice(0, 10),
      waterIntakeMl: l.waterIntakeMl,
      weightKg: l.weightKg?.toString() ?? null,
      mealsStatus: l.mealsStatus,
      notes: l.notes,
    })),
  };
}
