import type { Prisma } from '@prisma/client';

import { AppError, NotFoundError, ValidationError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { AttendanceRepository } from '../../attendance/repositories/attendance.repository';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import { ClassBookingService } from '../../classes/services/class-booking.service';
import { ClassSessionService } from '../../classes/services/class-session.service';
import { MemberDietPlanRepository } from '../../diet/repositories/member-diet-plan.repository';
import { MemberInvoiceService } from '../../finance/services/member-invoice.service';
import { MemberService } from '../../members/services/member.service';
import { tenantService } from '../../tenants/service/tenant.service';
import { MemberWorkoutPlanRepository } from '../../workouts/repositories/member-workout-plan.repository';

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

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.attendance = new AttendanceRepository(this.db);
    this.workoutAssignments = new MemberWorkoutPlanRepository(this.db);
    this.dietAssignments = new MemberDietPlanRepository(this.db);
    this.invoices = new MemberInvoiceService(tenantId);
    this.auditLog = new AuditLogRepository(this.db);
    this.classSessions = new ClassSessionService(tenantId);
    this.classBookings = new ClassBookingService(tenantId);
  }

  /** Reuses the exact same DTO the staff-side member detail page renders — it's the member's own data, so nothing needs hiding. */
  async getProfile(memberId: string) {
    return new MemberService(this.tenantId).getOwnProfile(memberId);
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
