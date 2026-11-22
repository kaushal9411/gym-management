import { AppError, ConflictError, ValidationError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { businessDate } from '../../../core/utils/business-time';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import type { IamActor } from '../../authentication/utils/actor.util';
import type { AttendanceDayDto, EmployeeRefDto, ShiftRefDto } from '../dto/hr.dto';
import { HrAttendanceRepository, type AttendanceRow } from '../repositories/hr-attendance.repository';
import type { PolicyRow } from '../repositories/hr-config.repository';
import { HrEmployeeRepository, type EmployeeRow } from '../repositories/hr-employee.repository';
import { checkInStatus, evaluateCheckOut, lateMinutesFor, summarizeDays, type AttendanceStats, type StoredStatus } from '../utils/attendance.util';
import { addDays, currentMonth, eachDate, fromDateCol, istInstant, monthEnd, monthStart, parseHm } from '../utils/hr-dates.util';

import { HrAccess } from './hr-access.service';
import { HrAudit } from './hr-audit.service';
import { HrCalendarService, toEmployeeRef, toShiftRef, type EmployeeCtx } from './hr-calendar.service';
import { HrConfigService } from './hr-config.service';

export interface MarkInput {
  userId: string;
  date: string;
  status: StoredStatus;
  checkInTime?: string;
  checkOutTime?: string;
  remark: string;
}

const TIMED_STATUSES: StoredStatus[] = ['PRESENT', 'LATE', 'HALF_DAY'];

export interface MonthView {
  month: string;
  days: AttendanceDayDto[];
  stats: AttendanceStats;
}

export interface DayBuckets {
  present: number;
  late: number;
  halfDay: number;
  onLeave: number;
  absent: number;
  weeklyOff: number;
  holiday: number;
  notMarked: number;
}

export function bucketsOf(stats: AttendanceStats): DayBuckets {
  return { present: stats.present, late: stats.late, halfDay: stats.halfDay, onLeave: stats.onLeave, absent: stats.absent, weeklyOff: stats.weeklyOff, holiday: stats.holiday, notMarked: stats.notMarked };
}

export class HrAttendanceService {
  readonly repo: HrAttendanceRepository;
  readonly config: HrConfigService;
  readonly calendar: HrCalendarService;
  readonly access: HrAccess;
  private readonly audit: HrAudit;

  constructor(private readonly tenantId: string) {
    const db = getTenantScopedClient(tenantId);
    this.repo = new HrAttendanceRepository(db);
    this.config = new HrConfigService(tenantId);
    this.calendar = new HrCalendarService(tenantId, this.config);
    this.access = new HrAccess(tenantId, new HrEmployeeRepository(db));
    this.audit = new HrAudit(tenantId, db);
  }

  // ── self-service ────────────────────────────────────────────────────────
  async checkIn(userId: string, note: string | undefined, actor: IamActor): Promise<AttendanceDayDto> {
    const emp = await this.access.requireSelf(userId);
    const policy = await this.config.getPolicyRow();
    const ctx = (await this.calendar.contexts([emp], policy)).get(userId)!;
    const now = new Date();
    const today = businessDate(now);
    const existing = await this.repo.findRow(this.tenantId, userId, today);

    if (existing?.checkInAt) throw new ConflictError(ErrorCode.ALREADY_CHECKED_IN, 'You have already checked in today.');
    if (existing && existing.status === 'ON_LEAVE') throw new ConflictError(ErrorCode.INVALID_STATE, 'You are on approved leave today.');
    if (existing && existing.leaveRequestId === null && !['ABSENT', 'WEEKLY_OFF', 'HOLIDAY'].includes(existing.status)) {
      throw new ConflictError(ErrorCode.INVALID_STATE, 'Attendance for today was already marked by HR.');
    }

    const lateMinutes = lateMinutesFor(now, ctx.shift);
    const halfLeave = existing?.leaveRequestId != null; // approved half-day leave: keep the leave status, just record the punch
    const row = await this.repo.upsertRow(this.tenantId, userId, today, {
      status: halfLeave ? existing!.status : checkInStatus(lateMinutes),
      checkInAt: now,
      checkOutAt: null,
      workedMinutes: null,
      lateMinutes,
      overtimeMinutes: 0,
      source: halfLeave ? existing!.source : 'SELF',
      markedBy: halfLeave ? existing!.markedBy : null,
      remark: note ?? (halfLeave ? existing!.remark : null),
      leaveRequestId: halfLeave ? existing!.leaveRequestId : null,
      shiftName: ctx.shift?.name ?? null,
      shiftStart: ctx.shift?.startTime ?? null,
      shiftEnd: ctx.shift?.endTime ?? null,
    });
    await this.audit.record(actor, 'hr.attendance_checkin', 'hr_attendance', row.id, { date: today, lateMinutes });
    return this.dto(row, ctx);
  }

  async checkOut(userId: string, actor: IamActor): Promise<AttendanceDayDto> {
    const emp = await this.access.requireSelf(userId);
    const policy = await this.config.getPolicyRow();
    const ctx = (await this.calendar.contexts([emp], policy)).get(userId)!;
    const now = new Date();
    const today = businessDate(now);
    const existing = await this.repo.findRow(this.tenantId, userId, today);
    if (!existing?.checkInAt) throw new ConflictError(ErrorCode.NOT_CHECKED_IN, 'You have not checked in today.');
    if (existing.checkOutAt) throw new ConflictError(ErrorCode.ALREADY_CHECKED_OUT, 'You have already checked out today.');

    const result = evaluateCheckOut(existing.checkInAt, now, existing.lateMinutes, {
      halfDayThresholdHours: Number(policy.halfDayThresholdHours),
      standardDayHours: Number(policy.standardDayHours),
    });
    const row = await this.repo.upsertRow(this.tenantId, userId, today, {
      status: existing.leaveRequestId ? existing.status : result.status,
      checkInAt: existing.checkInAt,
      checkOutAt: now,
      workedMinutes: result.workedMinutes,
      lateMinutes: existing.lateMinutes,
      overtimeMinutes: result.overtimeMinutes,
      source: existing.source,
      markedBy: existing.markedBy,
      remark: existing.remark,
      leaveRequestId: existing.leaveRequestId,
      shiftName: existing.shiftName,
      shiftStart: existing.shiftStart,
      shiftEnd: existing.shiftEnd,
    });
    await this.audit.record(actor, 'hr.attendance_checkout', 'hr_attendance', row.id, { date: today, workedMinutes: result.workedMinutes, status: row.status });
    return this.dto(row, ctx);
  }

  // ── reads ───────────────────────────────────────────────────────────────
  /** Every calendar day of `month` for one employee (computed where no row exists) + stats. */
  async monthFor(ctx: EmployeeCtx, month: string): Promise<MonthView> {
    const from = monthStart(month);
    const to = monthEnd(month);
    const [rows, holidays] = await Promise.all([this.repo.rowsForRange(this.tenantId, from, to, [ctx.userId]), this.config.repo.listHolidays(this.tenantId, from, to)]);
    const names = await this.access.employees.namesFor(this.tenantId, rows.map((r) => r.markedBy));
    const byDate = new Map(rows.map((r) => [fromDateCol(r.date), r]));
    const holidayMap = this.calendar.holidayMap(ctx, holidays);
    const days = eachDate(from, to).map((date) => this.calendar.dayDto({ date, ctx, row: byDate.get(date) ?? null, holidays: holidayMap, names }));
    return { month, days, stats: summarizeDays(days) };
  }

  async selfMonth(userId: string, month: string | undefined): Promise<MonthView> {
    const m = month ?? currentMonth();
    if (m > currentMonth()) throw new ValidationError('Validation failed', { fields: [{ field: 'month', message: 'Month cannot be in the future.' }] });
    const emp = await this.access.requireSelf(userId);
    const ctx = (await this.calendar.contexts([emp])).get(userId)!;
    return this.monthFor(ctx, m);
  }

  async employeeMonth(userId: string, month: string | undefined, actorUserId: string): Promise<MonthView> {
    const emp = await this.access.mustFindEmployee(userId, actorUserId);
    const ctx = (await this.calendar.contexts([emp])).get(userId)!;
    return this.monthFor(ctx, month ?? currentMonth());
  }

  /** Everyone for one date. */
  async dayList(q: { date?: string; branchId?: string; search?: string }, actorUserId: string) {
    const date = q.date ?? businessDate();
    const { items } = await this.access.employees.list(this.tenantId, { branchId: q.branchId, search: q.search, restrictToBranchIds: await this.access.scope(actorUserId) });
    const view = await this.dayViewFor(items, date);
    return {
      date,
      summary: bucketsOf(summarizeDays(view.map((v) => v.attendance))),
      items: view,
    };
  }

  async dayViewFor(employees: EmployeeRow[], date: string): Promise<Array<{ employee: EmployeeRefDto; shift: ShiftRefDto | null; attendance: AttendanceDayDto }>> {
    const ctxs = await this.calendar.contexts(employees);
    const [rows, holidays] = await Promise.all([
      this.repo.rowsForRange(this.tenantId, date, date, employees.map((e) => e.id)),
      this.config.repo.listHolidays(this.tenantId, date, date),
    ]);
    const names = await this.access.employees.namesFor(this.tenantId, rows.map((r) => r.markedBy));
    const rowBy = new Map(rows.map((r) => [r.userId, r]));
    return employees.map((e) => {
      const ctx = ctxs.get(e.id)!;
      return {
        employee: toEmployeeRef(ctx),
        shift: ctx.shift ? toShiftRef(ctx.shift) : null,
        attendance: this.calendar.dayDto({ date, ctx, row: rowBy.get(e.id) ?? null, holidays: this.calendar.holidayMap(ctx, holidays), names }),
      };
    });
  }

  /** Month grid for everyone. */
  async monthlyGrid(q: { month?: string; branchId?: string }, actorUserId: string) {
    const month = q.month ?? currentMonth();
    const from = monthStart(month);
    const to = monthEnd(month);
    const { items } = await this.access.employees.list(this.tenantId, { branchId: q.branchId, restrictToBranchIds: await this.access.scope(actorUserId) });
    const ctxs = await this.calendar.contexts(items);
    const [rows, holidays] = await Promise.all([this.repo.rowsForRange(this.tenantId, from, to, items.map((e) => e.id)), this.config.repo.listHolidays(this.tenantId, from, to)]);
    const byUser = new Map<string, Map<string, AttendanceRow>>();
    for (const r of rows) {
      const m = byUser.get(r.userId) ?? new Map<string, AttendanceRow>();
      m.set(fromDateCol(r.date), r);
      byUser.set(r.userId, m);
    }
    const days = eachDate(from, to);
    const names = new Map<string, string>();
    return {
      month,
      days,
      employees: items.map((e) => {
        const ctx = ctxs.get(e.id)!;
        const hm = this.calendar.holidayMap(ctx, holidays);
        const dayDtos = days.map((date) => this.calendar.dayDto({ date, ctx, row: byUser.get(e.id)?.get(date) ?? null, holidays: hm, names }));
        return { employee: toEmployeeRef(ctx), cells: dayDtos.map((d) => d.status), stats: summarizeDays(dayDtos) };
      }),
    };
  }

  // ── HR writes ───────────────────────────────────────────────────────────
  async mark(input: MarkInput, actor: IamActor): Promise<AttendanceDayDto> {
    const emp = await this.access.mustFindEmployee(input.userId, actor.userId);
    const ctx = (await this.calendar.contexts([emp])).get(input.userId)!;
    const policy = await this.config.getPolicyRow();
    return this.applyMark(input, ctx, policy, actor);
  }

  async bulk(input: { date: string; remark: string; entries: Array<Omit<MarkInput, 'date' | 'remark'> & { remark?: string }> }, actor: IamActor) {
    const ids = [...new Set(input.entries.map((e) => e.userId))];
    const scope = await this.access.scope(actor.userId);
    const emps = await this.access.employees.findMany(this.tenantId, ids, scope);
    const missing = ids.filter((id) => !emps.some((e) => e.id === id));
    if (missing.length) {
      throw new ValidationError('Validation failed', { fields: missing.map((id) => ({ field: 'entries', message: `Employee ${id} was not found.` })) });
    }
    if (new Set(ids).size !== input.entries.length) throw new ValidationError('Validation failed', { fields: [{ field: 'entries', message: 'Each employee may appear only once.' }] });
    const ctxs = await this.calendar.contexts(emps);
    const policy = await this.config.getPolicyRow();
    // validate everything first so a bad entry fails the whole batch before any write
    const prepared = input.entries.map((e) => ({ ...e, date: input.date, remark: e.remark ?? input.remark }));
    for (const p of prepared) this.validateMark(p, ctxs.get(p.userId)!);
    const items: AttendanceDayDto[] = [];
    for (const p of prepared) items.push(await this.applyMark(p, ctxs.get(p.userId)!, policy, actor, true));
    await this.audit.record(actor, 'hr.attendance_bulk_marked', 'hr_attendance', undefined, { date: input.date, count: items.length, remark: input.remark });
    return { date: input.date, updated: items.length, items };
  }

  async clear(q: { userId: string; date: string; remark: string }, actor: IamActor): Promise<{ date: string; userId: string; status: string }> {
    const emp = await this.access.mustFindEmployee(q.userId, actor.userId);
    const ctx = (await this.calendar.contexts([emp])).get(q.userId)!;
    const row = await this.repo.findRow(this.tenantId, q.userId, q.date);
    if (!row) throw new AppError(ErrorCode.NOT_FOUND, 'No attendance record exists for that day.', 404);
    await this.repo.deleteRow(this.tenantId, q.userId, q.date);
    const holidays = await this.config.repo.listHolidays(this.tenantId, q.date, q.date);
    const after = this.calendar.dayDto({ date: q.date, ctx, row: null, holidays: this.calendar.holidayMap(ctx, holidays), names: new Map() });
    await this.audit.record(actor, 'hr.attendance_cleared', 'hr_attendance', row.id, { userId: q.userId, date: q.date, remark: q.remark, before: this.snapshot(row) });
    return { date: q.date, userId: q.userId, status: after.status };
  }

  // ── leave integration ───────────────────────────────────────────────────
  /** Write SYSTEM rows for approved leave days (overwrites whatever was recorded for those days). */
  async writeLeaveRows(args: { userId: string; leaveRequestId: string; dates: string[]; dayPart: 'FULL_DAY' | 'HALF_DAY_MORNING' | 'HALF_DAY_EVENING'; ctx: EmployeeCtx; approverUserId: string }): Promise<number> {
    for (const date of args.dates) {
      await this.repo.upsertRow(this.tenantId, args.userId, date, {
        status: args.dayPart === 'FULL_DAY' ? 'ON_LEAVE' : 'HALF_DAY',
        checkInAt: null,
        checkOutAt: null,
        workedMinutes: null,
        lateMinutes: 0,
        overtimeMinutes: 0,
        source: 'SYSTEM',
        markedBy: args.approverUserId,
        remark: 'Approved leave',
        leaveRequestId: args.leaveRequestId,
        shiftName: args.ctx.shift?.name ?? null,
        shiftStart: args.ctx.shift?.startTime ?? null,
        shiftEnd: args.ctx.shift?.endTime ?? null,
      });
    }
    return args.dates.length;
  }

  removeLeaveRows(leaveRequestId: string): Promise<number> {
    return this.repo.deleteByLeave(this.tenantId, leaveRequestId);
  }

  // ── internals ───────────────────────────────────────────────────────────
  private validateMark(input: MarkInput, ctx: EmployeeCtx): void {
    const fields: Array<{ field: string; message: string }> = [];
    const today = businessDate();
    if (input.date > today) fields.push({ field: 'date', message: 'Attendance cannot be marked for a future date.' });
    if (input.date < ctx.joiningDate) fields.push({ field: 'date', message: `The employee joined on ${ctx.joiningDate}.` });
    const timed = TIMED_STATUSES.includes(input.status);
    if (!timed && (input.checkInTime || input.checkOutTime)) fields.push({ field: 'checkInTime', message: 'Times are only allowed with PRESENT, LATE or HALF_DAY.' });
    if (input.checkOutTime && !input.checkInTime) fields.push({ field: 'checkOutTime', message: 'checkInTime is required when checkOutTime is given.' });
    if (input.checkInTime && input.checkOutTime && parseHm(input.checkOutTime) <= parseHm(input.checkInTime)) {
      fields.push({ field: 'checkOutTime', message: 'Check-out must be after check-in.' });
    }
    if (fields.length) throw new ValidationError('Validation failed', { fields });
  }

  private async applyMark(input: MarkInput, ctx: EmployeeCtx, policy: PolicyRow, actor: IamActor, skipAudit = false): Promise<AttendanceDayDto> {
    this.validateMark(input, ctx);
    const before = await this.repo.findRow(this.tenantId, input.userId, input.date);
    const checkInAt = input.checkInTime ? istInstant(input.date, input.checkInTime) : null;
    const checkOutAt = input.checkOutTime ? istInstant(input.date, input.checkOutTime) : null;
    const lateMinutes = checkInAt ? lateMinutesFor(checkInAt, ctx.shift) : 0;
    let workedMinutes: number | null = null;
    let overtimeMinutes = 0;
    if (checkInAt && checkOutAt) {
      const r = evaluateCheckOut(checkInAt, checkOutAt, lateMinutes, { halfDayThresholdHours: Number(policy.halfDayThresholdHours), standardDayHours: Number(policy.standardDayHours) });
      workedMinutes = r.workedMinutes;
      overtimeMinutes = r.overtimeMinutes;
    }
    const data: Parameters<HrAttendanceRepository['upsertRow']>[3] = {
      status: input.status,
      checkInAt,
      checkOutAt,
      workedMinutes,
      lateMinutes,
      overtimeMinutes,
      source: 'MANUAL',
      markedBy: actor.userId,
      remark: input.remark,
      leaveRequestId: null,
      shiftName: ctx.shift?.name ?? null,
      shiftStart: ctx.shift?.startTime ?? null,
      shiftEnd: ctx.shift?.endTime ?? null,
    };
    const row = await this.repo.upsertRow(this.tenantId, input.userId, input.date, data);
    if (!skipAudit) {
      await this.audit.record(actor, 'hr.attendance_marked', 'hr_attendance', row.id, { userId: input.userId, date: input.date, before: before ? this.snapshot(before) : null, after: this.snapshot(row), remark: input.remark });
    }
    return this.dto(row, ctx);
  }

  private snapshot(r: AttendanceRow) {
    return { status: r.status, checkInAt: r.checkInAt?.toISOString() ?? null, checkOutAt: r.checkOutAt?.toISOString() ?? null, source: r.source, remark: r.remark };
  }

  async dto(row: AttendanceRow, ctx: EmployeeCtx, knownNames?: Map<string, string>): Promise<AttendanceDayDto> {
    const date = fromDateCol(row.date);
    const holidays = await this.config.repo.listHolidays(this.tenantId, date, date);
    const names = new Map(knownNames ?? []);
    if (row.markedBy && !names.get(row.markedBy)) {
      const fetched = await this.access.employees.namesFor(this.tenantId, [row.markedBy]);
      for (const [k, v] of fetched) names.set(k, v);
    }
    return this.calendar.dayDto({ date, ctx, row, holidays: this.calendar.holidayMap(ctx, holidays), names });
  }

  /** The 7-day window ending at `today` — used by the overview trend. */
  last7(today: string): string[] {
    return eachDate(addDays(today, -6), today);
  }
}
