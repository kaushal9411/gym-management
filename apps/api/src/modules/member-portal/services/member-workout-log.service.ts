import type { Prisma } from '@prisma/client';

import { NotFoundError, ValidationError } from '../../../core/errors/app-error';
import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { dateInTimezone } from '../../attendance/utils/timezone.util';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import {
  MemberWorkoutPlanRepository,
  type MemberWorkoutPlanRow,
} from '../../workouts/repositories/member-workout-plan.repository';
import {
  MemberWorkoutLogRepository,
  type WorkoutLogRow,
  type WorkoutSessionRow,
} from '../repositories/member-workout-log.repository';
import { dayToDate } from '../utils/member-measurement.util';
import {
  TRACKING_WEEKS_LOADED,
  addDays,
  buildWorkoutTracking,
  plannedExercisesOn,
  resolveWorkoutLogDay,
  weekStartOf,
  weekdayLabel,
  weekdayOf,
  type PlanExerciseInfo,
  type WorkoutLogEntry,
  type WorkoutSessionEntry,
  type WorkoutTracking,
} from '../utils/member-workout-tracking.util';
import { hasPerformanceValue } from '../validators/member-workout-log.validators';

export interface WorkoutRequestContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface WorkoutLogInput {
  exerciseId: string;
  date?: string;
  status: 'COMPLETED' | 'SKIPPED';
  setsDone?: number | null;
  repsDone?: number | null;
  weightKg?: number | null;
  durationMin?: number | null;
  notes?: string | null;
}

export type WorkoutLogUpdateInput = Partial<Omit<WorkoutLogInput, 'exerciseId' | 'date'>>;

export interface WorkoutCompleteInput {
  date?: string;
  durationMin?: number | null;
  effort?: number | null;
  notes?: string | null;
}

export interface WorkoutLogDto {
  id: string;
  date: string;
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string | null;
  status: 'COMPLETED' | 'SKIPPED';
  setsDone: number | null;
  repsDone: number | null;
  weightKg: number | null;
  durationMin: number | null;
  notes: string | null;
  updatedAt: string;
}

export interface WorkoutSessionDto {
  date: string;
  durationMin: number | null;
  effort: number | null;
  notes: string | null;
}

const isUniqueViolation = (error: unknown): boolean => (error as { code?: string } | null)?.code === 'P2002';
const dayOf = (d: Date): string => d.toISOString().slice(0, 10);
const clean = (s: string | null | undefined): string | null | undefined => (s === undefined ? undefined : s === null || s === '' ? null : s);
const money = (n: number | null | undefined): number | null | undefined =>
  n === undefined ? undefined : n === null ? null : Math.round(n * 100) / 100;

export function toWorkoutLogDto(row: WorkoutLogRow): WorkoutLogDto {
  return {
    id: row.id,
    date: dayOf(row.logDate),
    exerciseId: row.exerciseId,
    exerciseName: row.exercise.name,
    muscleGroup: row.exercise.muscleGroup,
    status: row.status,
    setsDone: row.setsDone,
    repsDone: row.repsDone,
    weightKg: row.weightKg === null ? null : Number(row.weightKg),
    durationMin: row.durationMin,
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toEntry(row: WorkoutLogRow): WorkoutLogEntry {
  return {
    id: row.id,
    assignmentId: row.memberWorkoutPlanId,
    date: dayOf(row.logDate),
    exerciseId: row.exerciseId,
    status: row.status,
    setsDone: row.setsDone,
    repsDone: row.repsDone,
    weightKg: row.weightKg === null ? null : Number(row.weightKg),
    durationMin: row.durationMin,
    notes: row.notes,
  };
}

function toSessionEntry(row: WorkoutSessionRow): WorkoutSessionEntry {
  return { id: row.id, date: dayOf(row.logDate), durationMin: row.durationMin, effort: row.effort, notes: row.notes };
}

/** The legacy `GET /portal/workout` body - field-for-field what it always returned. */
export function toWorkoutAssignmentDto(a: MemberWorkoutPlanRow) {
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

export type MemberWorkoutPayload = ReturnType<typeof toWorkoutAssignmentDto> & { tracking: WorkoutTracking };

interface LoadedPlan {
  today: string;
  assignment: MemberWorkoutPlanRow;
  window: { startDate: string; endDate: string | null };
  schedule: PlanExerciseInfo[];
}

/**
 * Member daily workout log (`/portal/workout/log*`) + the `tracking` block on
 * `GET /portal/workout`.
 *
 * Rules: the member id comes ONLY from the token; every row touched must have
 * `memberId = self` (another member's id is a 404). Logs attach to the member's
 * ACTIVE assignment; the exercise must be scheduled on the logged weekday; "today"
 * is the branch-local date, no future dates, back-dating limited to
 * {@link WORKOUT_LOG_BACKDATE_DAYS}. One log per (assignment, exercise, day): logging
 * again updates it. SKIPPED rows carry no sets/reps/weight/duration.
 *
 * Legacy mirror: after every write the LATEST log of the touched exercise (by day)
 * is copied into `MemberWorkoutProgress` (the staff-visible one-row-per-exercise
 * status), or the row is reset to PENDING when no log remains. The tenant-scoped
 * client has no interactive transaction, so the log write and the mirror are two
 * statements; the mirror is recomputed from the logs every time, so a failed second
 * statement self-heals on the next write.
 */
export class MemberWorkoutLogService {
  private readonly db: TenantScopedPrisma;
  private readonly logs: MemberWorkoutLogRepository;
  private readonly assignments: MemberWorkoutPlanRepository;
  private readonly auditLog: AuditLogRepository;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
    this.logs = new MemberWorkoutLogRepository(this.db);
    this.assignments = new MemberWorkoutPlanRepository(this.db);
    this.auditLog = new AuditLogRepository(this.db);
  }

  // ── reads ────────────────────────────────────────────────────────────────

  /** `GET /portal/workout`: the legacy assignment body plus `tracking` (null when nothing is assigned). */
  async getWorkoutPayload(memberId: string): Promise<MemberWorkoutPayload | null> {
    const assignment = await this.assignments.findActiveByMember(this.tenantId, memberId);
    return assignment ? this.payloadFor(memberId, assignment) : null;
  }

  /** Legacy body + tracking for a specific assignment (the legacy progress endpoint may touch a past one). */
  async payloadFor(memberId: string, assignment: MemberWorkoutPlanRow): Promise<MemberWorkoutPayload> {
    const today = await this.today(memberId);
    const schedule = await this.scheduleOf(assignment.workoutPlan.id);
    const tracking = await this.buildTracking(memberId, today, assignment, schedule);
    return { ...toWorkoutAssignmentDto(assignment), tracking };
  }

  /** `GET /portal/workout/log?days=` - newest first. */
  async history(memberId: string, days: number): Promise<{ today: string; from: string; entries: WorkoutLogDto[]; sessions: WorkoutSessionDto[] }> {
    const today = await this.today(memberId);
    const from = addDays(today, -(days - 1));
    const [rows, sessions] = await Promise.all([
      this.logs.listRange(this.tenantId, memberId, dayToDate(from), dayToDate(today)),
      this.logs.listSessions(this.tenantId, memberId, dayToDate(from), dayToDate(today)),
    ]);
    return {
      today,
      from,
      entries: rows.map(toWorkoutLogDto),
      sessions: sessions.map((s) => ({ date: dayOf(s.logDate), durationMin: s.durationMin, effort: s.effort, notes: s.notes })),
    };
  }

  // ── writes ───────────────────────────────────────────────────────────────

  async log(
    memberId: string,
    input: WorkoutLogInput,
    ctx: WorkoutRequestContext,
  ): Promise<{ entry: WorkoutLogDto; created: boolean; workout: MemberWorkoutPayload }> {
    const plan = await this.loadActive(memberId);
    const day = resolveWorkoutLogDay(input.date, plan.today);
    const exercise = this.assertScheduled(plan, input.exerciseId, day);
    const assignmentId = plan.assignment.id;
    const logDate = dayToDate(day);

    const skipped = input.status === 'SKIPPED';
    const values = {
      status: input.status,
      setsDone: skipped ? null : input.setsDone,
      repsDone: skipped ? null : input.repsDone,
      weightKg: skipped ? null : money(input.weightKg),
      durationMin: skipped ? null : input.durationMin,
      notes: clean(input.notes),
    };

    let created = false;
    let row: WorkoutLogRow;
    const existing = await this.logs.findByKey(this.tenantId, assignmentId, exercise.exerciseId, logDate);
    if (existing) {
      row = await this.logs.update(existing.id, stripUndefined(values));
    } else {
      try {
        row = await this.logs.create({
          tenantId: this.tenantId,
          memberId,
          memberWorkoutPlanId: assignmentId,
          exerciseId: exercise.exerciseId,
          logDate,
          status: input.status,
          setsDone: values.setsDone ?? null,
          repsDone: values.repsDone ?? null,
          weightKg: values.weightKg ?? null,
          durationMin: values.durationMin ?? null,
          notes: values.notes ?? null,
        });
        created = true;
      } catch (error) {
        // Lost a same-day race against the unique key -> update the winner instead.
        if (!isUniqueViolation(error)) throw error;
        const raced = await this.logs.findByKey(this.tenantId, assignmentId, exercise.exerciseId, logDate);
        if (!raced) throw error;
        row = await this.logs.update(raced.id, stripUndefined(values));
      }
    }

    await this.syncProgress(assignmentId, exercise.exerciseId);
    await this.audit(created ? 'member_portal.workout_logged' : 'member_portal.workout_log_updated', 'member_workout_log', row.id, memberId, ctx, {
      day,
      exerciseId: exercise.exerciseId,
      status: input.status,
      fields: loggedFieldNames(input),
    });
    return { entry: toWorkoutLogDto(row), created, workout: await this.payloadOrThrow(memberId) };
  }

  /** Edit the detail fields / status of an entry (any age). The day and the exercise never change. */
  async update(
    memberId: string,
    id: string,
    input: WorkoutLogUpdateInput,
    ctx: WorkoutRequestContext,
  ): Promise<{ entry: WorkoutLogDto; workout: MemberWorkoutPayload }> {
    const existing = await this.mustOwn(memberId, id);
    const nextStatus = input.status ?? existing.status;
    if (nextStatus === 'SKIPPED' && hasPerformanceValue(input)) {
      throw new ValidationError('Mark the exercise as done before adding sets, reps, weight or duration.');
    }
    const skipped = nextStatus === 'SKIPPED';
    const data = stripUndefined({
      status: input.status,
      setsDone: skipped ? null : input.setsDone,
      repsDone: skipped ? null : input.repsDone,
      weightKg: skipped ? null : money(input.weightKg),
      durationMin: skipped ? null : input.durationMin,
      notes: clean(input.notes),
    });
    const row = await this.logs.update(id, data);
    await this.syncProgress(row.memberWorkoutPlanId, row.exerciseId);
    await this.audit('member_portal.workout_log_updated', 'member_workout_log', id, memberId, ctx, {
      day: dayOf(row.logDate),
      exerciseId: row.exerciseId,
      status: row.status,
      fields: loggedFieldNames(input),
    });
    return { entry: toWorkoutLogDto(row), workout: await this.payloadOrThrow(memberId) };
  }

  /** Undo: removes the entry (the exercise goes back to "not logged" for that day). */
  async remove(memberId: string, id: string, ctx: WorkoutRequestContext): Promise<MemberWorkoutPayload | null> {
    const existing = await this.mustOwn(memberId, id);
    await this.logs.delete(id);
    await this.syncProgress(existing.memberWorkoutPlanId, existing.exerciseId);
    await this.audit('member_portal.workout_log_deleted', 'member_workout_log', id, memberId, ctx, {
      day: dayOf(existing.logDate),
      exerciseId: existing.exerciseId,
    });
    return this.getWorkoutPayload(memberId);
  }

  /**
   * "Complete workout": every scheduled exercise of the day that is not logged yet becomes
   * COMPLETED (explicit SKIPPED ones stay skipped) and the optional duration / effort / note
   * is stored for the day. At least one exercise must end up completed.
   */
  async completeDay(
    memberId: string,
    input: WorkoutCompleteInput,
    ctx: WorkoutRequestContext,
  ): Promise<{ completedNow: number; workout: MemberWorkoutPayload }> {
    const plan = await this.loadActive(memberId);
    const day = resolveWorkoutLogDay(input.date, plan.today);
    const planned = this.plannedOn(plan, day);
    const logDate = dayToDate(day);

    let completedNow = 0;
    let completedTotal = 0;
    for (const e of planned) {
      // eslint-disable-next-line no-await-in-loop -- tiny per-day list; keeps each write + mirror ordered
      const existing = await this.logs.findByKey(this.tenantId, plan.assignment.id, e.exerciseId, logDate);
      if (existing) {
        if (existing.status === 'COMPLETED') completedTotal += 1;
        continue;
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        await this.logs.create({
          tenantId: this.tenantId,
          memberId,
          memberWorkoutPlanId: plan.assignment.id,
          exerciseId: e.exerciseId,
          logDate,
          status: 'COMPLETED',
        });
        completedNow += 1;
        completedTotal += 1;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error; // a concurrent request logged it first - keep theirs
        // eslint-disable-next-line no-await-in-loop
        const raced = await this.logs.findByKey(this.tenantId, plan.assignment.id, e.exerciseId, logDate);
        if (raced?.status === 'COMPLETED') completedTotal += 1;
      }
      // eslint-disable-next-line no-await-in-loop
      await this.syncProgress(plan.assignment.id, e.exerciseId);
    }
    if (completedTotal === 0) {
      throw new ValidationError('Every exercise for this day is marked skipped - mark at least one as done first.');
    }

    const hasMeta = input.durationMin !== undefined || input.effort !== undefined || input.notes !== undefined;
    if (hasMeta) await this.saveSession(memberId, plan.assignment.id, logDate, input);

    await this.audit('member_portal.workout_session_completed', 'member_workout_session', plan.assignment.id, memberId, ctx, {
      day,
      completedNow,
      completedTotal,
      fields: [input.durationMin != null ? 'durationMin' : null, input.effort != null ? 'effort' : null, input.notes ? 'notes' : null].filter(Boolean),
    });
    return { completedNow, workout: await this.payloadOrThrow(memberId) };
  }

  /** Clear everything logged for a day (entries + session metadata) - a fresh start for that day. */
  async resetDay(memberId: string, date: string, ctx: WorkoutRequestContext): Promise<MemberWorkoutPayload | null> {
    const today = await this.today(memberId);
    const day = resolveWorkoutLogDay(date, today);
    const logDate = dayToDate(day);
    const rows = await this.logs.listForDay(this.tenantId, memberId, logDate);
    await this.logs.deleteForDay(this.tenantId, memberId, logDate);
    await this.logs.deleteSessionForDay(this.tenantId, memberId, logDate);
    for (const r of rows) {
      // eslint-disable-next-line no-await-in-loop
      await this.syncProgress(r.memberWorkoutPlanId, r.exerciseId);
    }
    await this.audit('member_portal.workout_day_reset', 'member_workout_log', memberId, memberId, ctx, { day, entries: rows.length });
    return this.getWorkoutPayload(memberId);
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async saveSession(memberId: string, assignmentId: string, logDate: Date, input: WorkoutCompleteInput): Promise<void> {
    const data = stripUndefined({ durationMin: input.durationMin, effort: input.effort, notes: clean(input.notes) });
    const existing = await this.logs.findSession(this.tenantId, memberId, logDate);
    if (existing) {
      await this.logs.updateSession(existing.id, { ...data, memberWorkoutPlanId: assignmentId });
      return;
    }
    try {
      await this.logs.createSession({
        tenantId: this.tenantId,
        memberId,
        memberWorkoutPlanId: assignmentId,
        logDate,
        durationMin: input.durationMin ?? null,
        effort: input.effort ?? null,
        notes: clean(input.notes) ?? null,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const raced = await this.logs.findSession(this.tenantId, memberId, logDate);
      if (!raced) throw error;
      await this.logs.updateSession(raced.id, { ...data, memberWorkoutPlanId: assignmentId });
    }
  }

  /** Row must exist and belong to this member (404 otherwise - never reveal other members' ids). */
  private async mustOwn(memberId: string, id: string): Promise<WorkoutLogRow> {
    const row = await this.logs.findById(this.tenantId, id);
    if (!row || row.memberId !== memberId) throw new NotFoundError('Workout log entry not found.');
    return row;
  }

  private async syncProgress(assignmentId: string, exerciseId: string): Promise<void> {
    const latest = await this.logs.latestForExercise(this.tenantId, assignmentId, exerciseId);
    if (latest) {
      await this.assignments.upsertProgress(this.tenantId, assignmentId, exerciseId, {
        status: latest.status,
        notes: latest.notes ?? undefined,
      });
    } else {
      await this.logs.resetProgress(this.tenantId, assignmentId, exerciseId);
    }
  }

  private async loadActive(memberId: string): Promise<LoadedPlan> {
    const assignment = await this.assignments.findActiveByMember(this.tenantId, memberId);
    if (!assignment) throw new NotFoundError('You don’t have an active workout plan yet.');
    const today = await this.today(memberId);
    const schedule = await this.scheduleOf(assignment.workoutPlan.id);
    return {
      today,
      assignment,
      window: { startDate: dayOf(assignment.startDate), endDate: assignment.endDate ? dayOf(assignment.endDate) : null },
      schedule,
    };
  }

  private plannedOn(plan: LoadedPlan, day: string): PlanExerciseInfo[] {
    if (day < plan.window.startDate) throw new ValidationError(`Your plan starts on ${plan.window.startDate}.`);
    const planned = plannedExercisesOn(plan.schedule, plan.window, day);
    if (planned.length === 0) throw new ValidationError(`Nothing is scheduled for ${weekdayLabel(weekdayOf(day))}.`);
    return planned;
  }

  /** The exercise must be part of the plan AND scheduled on that weekday. */
  private assertScheduled(plan: LoadedPlan, exerciseId: string, day: string): PlanExerciseInfo {
    if (!plan.schedule.some((e) => e.exerciseId === exerciseId)) {
      throw new ValidationError('This exercise is not part of your assigned workout plan.');
    }
    const planned = this.plannedOn(plan, day);
    const hit = planned.find((e) => e.exerciseId === exerciseId);
    if (!hit) {
      const name = plan.schedule.find((e) => e.exerciseId === exerciseId)?.name ?? 'This exercise';
      throw new ValidationError(`${name} isn’t scheduled for ${weekdayLabel(weekdayOf(day))}.`);
    }
    return hit;
  }

  private async scheduleOf(planId: string): Promise<PlanExerciseInfo[]> {
    const rows = await this.logs.planSchedule(this.tenantId, planId);
    return rows.map((r) => ({
      exerciseId: r.exerciseId,
      name: r.exercise.name,
      muscleGroup: r.exercise.muscleGroup,
      dayOfWeek: r.dayOfWeek,
      sortOrder: r.sortOrder,
      sets: r.sets ?? r.exercise.defaultSets,
      reps: r.repetitions ?? r.exercise.defaultReps,
      restSeconds: r.restSeconds ?? r.exercise.restSeconds,
      notes: r.notes,
    }));
  }

  private async buildTracking(
    memberId: string,
    today: string,
    assignment: MemberWorkoutPlanRow,
    schedule: PlanExerciseInfo[],
  ): Promise<WorkoutTracking> {
    const from = addDays(weekStartOf(today), -7 * (TRACKING_WEEKS_LOADED - 1));
    const [rows, sessions, weighted, total] = await Promise.all([
      this.logs.listRange(this.tenantId, memberId, dayToDate(from), dayToDate(today)),
      this.logs.listSessions(this.tenantId, memberId, dayToDate(from), dayToDate(today)),
      this.logs.listWeighted(this.tenantId, memberId),
      this.logs.count(this.tenantId, memberId),
    ]);
    return buildWorkoutTracking({
      today,
      assignment: {
        id: assignment.id,
        startDate: dayOf(assignment.startDate),
        endDate: assignment.endDate ? dayOf(assignment.endDate) : null,
      },
      schedule,
      logs: rows.map(toEntry),
      sessions: sessions.map(toSessionEntry),
      weighted: weighted.map((w) => ({
        exerciseId: w.exerciseId,
        exerciseName: w.exercise.name,
        date: dayOf(w.logDate),
        weightKg: Number(w.weightKg),
        repsDone: w.repsDone,
      })),
      everLogged: total > 0,
    });
  }

  private async payloadOrThrow(memberId: string): Promise<MemberWorkoutPayload> {
    const payload = await this.getWorkoutPayload(memberId);
    if (!payload) throw new NotFoundError('You don’t have an active workout plan yet.');
    return payload;
  }

  /** The member's branch-local calendar date. */
  private async today(memberId: string): Promise<string> {
    const member = await this.db.member.findFirst({
      where: { tenantId: this.tenantId, id: memberId, deletedAt: null },
      select: { branch: { select: { timezone: true } } },
    });
    if (!member) throw new NotFoundError('Member not found.');
    return dateInTimezone(member.branch.timezone || 'UTC');
  }

  private async audit(
    action: string,
    entityType: string,
    entityId: string,
    memberId: string,
    ctx: WorkoutRequestContext,
    after: Record<string, unknown>,
  ): Promise<void> {
    await this.auditLog.record({
      tenantId: this.tenantId,
      actorUserId: null,
      actorRole: 'MEMBER',
      action,
      entityType,
      entityId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      // Field NAMES + day only; never the logged values.
      after: { memberId, ...after } as Prisma.InputJsonObject,
    });
  }
}

/** Drops `undefined` keys (Prisma treats them as "leave unchanged", but explicit is clearer and testable). */
function stripUndefined<T extends Record<string, unknown>>(obj: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as { [K in keyof T]?: Exclude<T[K], undefined> };
}

function loggedFieldNames(input: Partial<WorkoutLogInput>): string[] {
  const keys = ['status', 'setsDone', 'repsDone', 'weightKg', 'durationMin', 'notes'] as const;
  return keys.filter((k) => input[k] !== undefined);
}
