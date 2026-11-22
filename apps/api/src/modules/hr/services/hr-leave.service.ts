import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { businessDate } from '../../../core/utils/business-time';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import type { IamActor } from '../../authentication/utils/actor.util';
import type { LeaveBalanceDto, LeaveRequestDto, Paginated } from '../dto/hr.dto';
import type { LeaveTypeRow, PolicyRow } from '../repositories/hr-config.repository';
import { HrEmployeeRepository, type EmployeeRow } from '../repositories/hr-employee.repository';
import { HrLeaveRepository, type LeaveRow } from '../repositories/hr-leave.repository';
import { addDays, eachDate, fromDateCol, leaveYearBounds, leaveYearLabel, leaveYearOf, toDateCol } from '../utils/hr-dates.util';
import { balanceFigures, carryForwardAmount, computeLeaveDays, leaveSpansOverlap, type DayPart, type ExcludedDay } from '../utils/leave.util';

import { HrAccess } from './hr-access.service';
import { HrAttendanceService } from './hr-attendance.service';
import { HrAudit } from './hr-audit.service';
import { toEmployeeRef, toLeaveTypeRef, type EmployeeCtx } from './hr-calendar.service';
import { HrConfigService } from './hr-config.service';
import { HrNotificationService } from './hr-notification.service';

export interface LeaveInput {
  leaveTypeId: string;
  startDate: string;
  endDate?: string;
  dayPart: DayPart;
}

export interface LeavePreview {
  days: number;
  excluded: ExcludedDay[];
  available: number | null;
  sufficient: boolean;
}

const MAX_RANGE_DAYS = 120;
const MAX_AHEAD_DAYS = 366;
const dayPartLabel = (p: DayPart): string => (p === 'HALF_DAY_MORNING' ? ' (morning half)' : p === 'HALF_DAY_EVENING' ? ' (evening half)' : '');
const fmtRange = (s: string, e: string): string => (s === e ? s : `${s} to ${e}`);

export class HrLeaveService {
  readonly repo: HrLeaveRepository;
  readonly config: HrConfigService;
  readonly attendance: HrAttendanceService;
  readonly access: HrAccess;
  private readonly employees: HrEmployeeRepository;
  private readonly notifications: HrNotificationService;
  private readonly audit: HrAudit;

  constructor(private readonly tenantId: string) {
    const db = getTenantScopedClient(tenantId);
    this.repo = new HrLeaveRepository(db);
    this.config = new HrConfigService(tenantId);
    this.attendance = new HrAttendanceService(tenantId);
    this.employees = new HrEmployeeRepository(db);
    this.access = new HrAccess(tenantId, this.employees);
    this.notifications = new HrNotificationService(tenantId);
    this.audit = new HrAudit(tenantId, db);
  }

  // ── balances ────────────────────────────────────────────────────────────
  async currentLeaveYear(policy?: PolicyRow): Promise<number> {
    const p = policy ?? (await this.config.getPolicyRow());
    return leaveYearOf(businessDate(), p.leaveYearStartMonth);
  }

  /**
   * Balances for several employees in one leave year (rows are created lazily,
   * with carry-forward from the previous year for types that allow it).
   * `include` forces extra (possibly inactive) type ids to be listed.
   */
  async balancesForUsers(userIds: string[], leaveYear: number, include: string[] = []): Promise<Map<string, LeaveBalanceDto[]>> {
    const policy = await this.config.getPolicyRow();
    const allTypes = await this.config.repo.listLeaveTypes(this.tenantId, true);
    const types = allTypes.filter((t) => t.isActive || include.includes(t.id));
    const result = new Map<string, LeaveBalanceDto[]>(userIds.map((u) => [u, []]));
    if (userIds.length === 0 || types.length === 0) return result;

    let balances = await this.repo.listBalances(this.tenantId, userIds, leaveYear);
    const have = new Set(balances.map((b) => `${b.userId}:${b.leaveTypeId}`));
    const missing: Array<{ userId: string; type: LeaveTypeRow }> = [];
    for (const u of userIds) for (const t of types) if (!have.has(`${u}:${t.id}`)) missing.push({ userId: u, type: t });
    if (missing.length) {
      const prevRemaining = await this.previousRemaining(
        [...new Set(missing.filter((m) => m.type.carryForward).map((m) => m.userId))],
        leaveYear - 1,
      );
      await this.repo.createBalances(
        missing.map(({ userId, type }) => ({
          tenantId: this.tenantId,
          userId,
          leaveTypeId: type.id,
          leaveYear,
          quota: type.yearlyQuota === null ? 0 : type.yearlyQuota,
          carriedForward: type.carryForward ? carryForwardAmount(prevRemaining.get(`${userId}:${type.id}`) ?? 0, type.carryForwardMax === null ? null : Number(type.carryForwardMax)) : 0,
        })),
      );
      balances = await this.repo.listBalances(this.tenantId, userIds, leaveYear);
    }

    const usage = await this.repo.usage(this.tenantId, userIds, leaveYear);
    const bounds = leaveYearBounds(leaveYear, policy.leaveYearStartMonth);
    const label = leaveYearLabel(leaveYear, policy.leaveYearStartMonth);
    const typeBy = new Map(types.map((t) => [t.id, t]));
    for (const b of balances) {
      const type = typeBy.get(b.leaveTypeId);
      if (!type) continue;
      const used = usage.filter((x) => x.userId === b.userId && x.leaveTypeId === b.leaveTypeId && x.status === 'APPROVED').reduce((a, x) => a + x.days, 0);
      const pending = usage.filter((x) => x.userId === b.userId && x.leaveTypeId === b.leaveTypeId && x.status === 'PENDING').reduce((a, x) => a + x.days, 0);
      const unlimited = type.yearlyQuota === null;
      const fig = balanceFigures({ quota: unlimited ? null : Number(b.quota), carriedForward: Number(b.carriedForward), adjustment: Number(b.adjustment), used, pending });
      result.get(b.userId)!.push({
        leaveType: toLeaveTypeRef(type),
        leaveYear,
        leaveYearLabel: label,
        periodStart: bounds.start,
        periodEnd: bounds.end,
        quota: unlimited ? null : Number(b.quota),
        carriedForward: Number(b.carriedForward),
        adjustment: Number(b.adjustment),
        ...fig,
      });
    }
    const order = new Map(types.map((t, i) => [t.id, i]));
    for (const list of result.values()) list.sort((a, b) => (order.get(a.leaveType.id) ?? 0) - (order.get(b.leaveType.id) ?? 0));
    return result;
  }

  async balancesFor(userId: string, leaveYear?: number, include: string[] = []): Promise<LeaveBalanceDto[]> {
    const year = leaveYear ?? (await this.currentLeaveYear());
    return (await this.balancesForUsers([userId], year, include)).get(userId) ?? [];
  }

  private async previousRemaining(userIds: string[], prevYear: number): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (userIds.length === 0) return out;
    const [rows, usage] = await Promise.all([this.repo.listBalances(this.tenantId, userIds, prevYear), this.repo.usage(this.tenantId, userIds, prevYear)]);
    for (const b of rows) {
      const used = usage.filter((x) => x.userId === b.userId && x.leaveTypeId === b.leaveTypeId && x.status === 'APPROVED').reduce((a, x) => a + x.days, 0);
      out.set(`${b.userId}:${b.leaveTypeId}`, Number(b.quota) + Number(b.carriedForward) + Number(b.adjustment) - used);
    }
    return out;
  }

  async adjustBalance(input: { userId: string; leaveTypeId: string; leaveYear?: number; days: number; remark: string }, actor: IamActor): Promise<LeaveBalanceDto> {
    await this.access.mustFindEmployee(input.userId, actor.userId);
    const type = await this.config.mustFindLeaveType(input.leaveTypeId);
    if (type.yearlyQuota === null) throw new ConflictError(ErrorCode.INVALID_STATE, 'This leave type is unlimited; there is no balance to adjust.');
    const year = input.leaveYear ?? (await this.currentLeaveYear());
    const before = (await this.balancesFor(input.userId, year, [type.id])).find((b) => b.leaveType.id === type.id)!;
    const entitledAfter = (before.entitled ?? 0) + input.days;
    if (entitledAfter < before.used + before.pending - 1e-9) {
      throw new ValidationError('Validation failed', { fields: [{ field: 'days', message: `The adjustment would leave ${entitledAfter} entitled but ${before.used + before.pending} is already used or pending.` }] });
    }
    const row = (await this.repo.listBalances(this.tenantId, [input.userId], year)).find((b) => b.leaveTypeId === type.id)!;
    await this.repo.addAdjustment(row.id, input.days);
    const after = (await this.balancesFor(input.userId, year, [type.id])).find((b) => b.leaveType.id === type.id)!;
    await this.audit.record(actor, 'hr.leave_balance_adjusted', 'hr_leave_balance', row.id, { userId: input.userId, leaveType: type.code, leaveYear: year, days: input.days, remark: input.remark, before: before.entitled, after: after.entitled });
    return after;
  }

  // ── validation shared by preview / apply ────────────────────────────────
  private async validate(emp: EmployeeRow, ctx: EmployeeCtx, input: LeaveInput, opts: { onBehalf: boolean; exceptId?: string }) {
    const policy = await this.config.getPolicyRow();
    const type = await this.config.mustFindLeaveType(input.leaveTypeId);
    const fail = (field: string, message: string): never => {
      throw new ValidationError('Validation failed', { fields: [{ field, message }] });
    };
    if (!type.isActive) fail('leaveTypeId', 'This leave type is not active.');
    const startDate = input.startDate;
    const endDate = input.endDate ?? input.startDate;
    const today = businessDate();
    if (endDate < startDate) fail('endDate', 'End date cannot be before the start date.');
    if (input.dayPart !== 'FULL_DAY' && startDate !== endDate) fail('dayPart', 'A half-day leave must be a single day (start date = end date).');
    if (eachDate(startDate, endDate).length > MAX_RANGE_DAYS) fail('endDate', `A leave request can cover at most ${MAX_RANGE_DAYS} days.`);
    if (startDate < ctx.joiningDate) fail('startDate', `Leave cannot start before the joining date (${ctx.joiningDate}).`);
    if (!opts.onBehalf && startDate < addDays(today, -policy.backdateLeaveDays)) {
      fail('startDate', `Leave can be applied for at most ${policy.backdateLeaveDays} days in the past.`);
    }
    if (startDate > addDays(today, MAX_AHEAD_DAYS)) fail('startDate', 'Leave cannot start more than a year ahead.');
    const year = leaveYearOf(startDate, policy.leaveYearStartMonth);
    if (leaveYearOf(endDate, policy.leaveYearStartMonth) !== year) fail('endDate', 'A leave request cannot span two leave years. Apply separately for each leave year.');

    const holidays = await this.config.repo.listHolidays(this.tenantId, startDate, endDate);
    const calc = computeLeaveDays({ startDate, endDate, dayPart: input.dayPart, weeklyOff: ctx.weeklyOff, holidays: this.attendance.calendar.holidayMap(ctx, holidays) });
    if (calc.days <= 0) throw new AppError(ErrorCode.NO_WORKING_DAYS, 'The selected dates are all weekly offs or holidays, so no leave is needed.', 422);

    const open = await this.repo.openOverlapping(this.tenantId, [emp.id], startDate, endDate, opts.exceptId);
    const clash = open.find((o) => leaveSpansOverlap({ startDate, endDate, dayPart: input.dayPart }, { startDate: fromDateCol(o.startDate), endDate: fromDateCol(o.endDate), dayPart: o.dayPart }));
    if (clash) {
      throw new ConflictError(ErrorCode.LEAVE_OVERLAP, `This overlaps an existing ${clash.status.toLowerCase()} leave request (${fmtRange(fromDateCol(clash.startDate), fromDateCol(clash.endDate))}).`);
    }

    let available: number | null = null;
    if (type.yearlyQuota !== null) {
      const bal = (await this.balancesFor(emp.id, year, [type.id])).find((b) => b.leaveType.id === type.id);
      available = bal?.available ?? 0;
    }
    return { policy, type, startDate, endDate, year, calc, available, sufficient: available === null || calc.days <= available + 1e-9 };
  }

  async preview(emp: EmployeeRow, input: LeaveInput, onBehalf: boolean): Promise<LeavePreview> {
    const ctx = (await this.attendance.calendar.contexts([emp])).get(emp.id)!;
    const v = await this.validate(emp, ctx, input, { onBehalf });
    return { days: v.calc.days, excluded: v.calc.excluded, available: v.available, sufficient: v.sufficient };
  }

  // ── apply ───────────────────────────────────────────────────────────────
  async apply(emp: EmployeeRow, input: LeaveInput & { reason: string }, actor: IamActor, opts: { onBehalf: boolean; autoApprove?: boolean; remark?: string }): Promise<LeaveRequestDto> {
    const ctx = (await this.attendance.calendar.contexts([emp])).get(emp.id)!;
    const v = await this.validate(emp, ctx, input, { onBehalf: opts.onBehalf });
    if (!v.sufficient) {
      throw new AppError(ErrorCode.INSUFFICIENT_LEAVE_BALANCE, `Only ${v.available} day(s) of ${v.type.name} are available, but ${v.calc.days} requested.`, 422);
    }
    if (opts.autoApprove && emp.id === actor.userId) throw new ForbiddenError('You cannot approve your own leave request.');
    const created = await this.repo.create({
      tenantId: this.tenantId,
      userId: emp.id,
      leaveTypeId: v.type.id,
      startDate: toDateCol(v.startDate),
      endDate: toDateCol(v.endDate),
      dayPart: input.dayPart,
      days: v.calc.days,
      reason: input.reason,
      status: 'PENDING',
      leaveYear: v.year,
      appliedOnBehalf: opts.onBehalf && emp.id !== actor.userId,
      appliedBy: actor.userId,
    });
    await this.audit.record(actor, 'hr.leave_applied', 'hr_leave_request', created.id, { userId: emp.id, leaveType: v.type.code, startDate: v.startDate, endDate: v.endDate, dayPart: input.dayPart, days: v.calc.days, onBehalf: opts.onBehalf });

    let row = created;
    if (opts.autoApprove) {
      row = await this.approveRow(created, actor, opts.remark ?? 'Applied and approved by HR');
    } else {
      const approvers = (await this.employees.userIdsWithPermission(this.tenantId, 'hr:leave_manage')).filter((id) => id !== emp.id);
      await this.notifications.notify(approvers, {
        type: 'LEAVE_APPLIED',
        title: 'Leave request',
        body: `${emp.name} requested ${v.type.name} for ${fmtRange(v.startDate, v.endDate)}${dayPartLabel(input.dayPart)} (${v.calc.days} day${v.calc.days === 1 ? '' : 's'}).`,
        entityType: 'leave_request',
        entityId: created.id,
      });
      if (opts.onBehalf && emp.id !== actor.userId) {
        await this.notifications.notify([emp.id], {
          type: 'LEAVE_APPLIED',
          title: 'Leave applied for you',
          body: `HR applied ${v.type.name} for you on ${fmtRange(v.startDate, v.endDate)}${dayPartLabel(input.dayPart)}.`,
          entityType: 'leave_request',
          entityId: created.id,
        });
      }
    }
    return (await this.toDtos([row], actor.userId))[0]!;
  }

  // ── decisions ───────────────────────────────────────────────────────────
  private async mustFindRow(id: string, actorUserId: string, scoped: boolean): Promise<LeaveRow> {
    const row = await this.repo.findById(this.tenantId, id);
    if (!row) throw new NotFoundError('Leave request not found.');
    if (scoped) await this.access.mustFindEmployee(row.userId, actorUserId).catch(() => {
      throw new NotFoundError('Leave request not found.');
    });
    return row;
  }

  async approve(id: string, remark: string | undefined, actor: IamActor): Promise<LeaveRequestDto> {
    const row = await this.mustFindRow(id, actor.userId, true);
    if (row.userId === actor.userId) throw new ForbiddenError('You cannot decide your own leave request.');
    const approved = await this.approveRow(row, actor, remark);
    return (await this.toDtos([approved], actor.userId))[0]!;
  }

  private async approveRow(row: LeaveRow, actor: IamActor, remark: string | undefined): Promise<LeaveRow> {
    if (row.status !== 'PENDING') throw new ConflictError(ErrorCode.INVALID_STATE, `Only pending requests can be approved (this one is ${row.status.toLowerCase()}).`);
    const emp = await this.employees.findOne(this.tenantId, row.userId);
    if (!emp) throw new NotFoundError('Employee not found.');
    const ctx = (await this.attendance.calendar.contexts([emp])).get(emp.id)!;
    const start = fromDateCol(row.startDate);
    const end = fromDateCol(row.endDate);
    const holidays = await this.config.repo.listHolidays(this.tenantId, start, end);
    const calc = computeLeaveDays({ startDate: start, endDate: end, dayPart: row.dayPart, weeklyOff: ctx.weeklyOff, holidays: this.attendance.calendar.holidayMap(ctx, holidays) });
    if (calc.days <= 0) throw new AppError(ErrorCode.NO_WORKING_DAYS, 'The dates of this request are now all weekly offs or holidays. Reject or cancel it instead.', 422);

    if (row.leaveType.yearlyQuota !== null) {
      const bal = (await this.balancesFor(row.userId, row.leaveYear, [row.leaveTypeId])).find((b) => b.leaveType.id === row.leaveTypeId);
      // `pending` already contains this request at its stored day count
      const availableWithoutSelf = (bal?.available ?? 0) + Number(row.days);
      if (calc.days > availableWithoutSelf + 1e-9) {
        throw new AppError(ErrorCode.INSUFFICIENT_LEAVE_BALANCE, `Only ${availableWithoutSelf} day(s) of ${row.leaveType.name} are available for this employee.`, 422);
      }
    }
    const ok = await this.repo.transition(this.tenantId, row.id, ['PENDING'], { status: 'APPROVED', decidedBy: actor.userId, decidedAt: new Date(), decisionRemark: remark ?? null, days: calc.days });
    if (!ok) throw new ConflictError(ErrorCode.INVALID_STATE, 'This request was already decided.');
    await this.attendance.writeLeaveRows({ userId: row.userId, leaveRequestId: row.id, dates: calc.workingDates, dayPart: row.dayPart, ctx, approverUserId: actor.userId });
    await this.audit.record(actor, 'hr.leave_approved', 'hr_leave_request', row.id, { userId: row.userId, days: calc.days, remark: remark ?? null, daysRecounted: Number(row.days) !== calc.days });
    await this.notifications.notify([row.userId], {
      type: 'LEAVE_APPROVED',
      title: 'Leave approved',
      body: `Your ${row.leaveType.name} on ${fmtRange(start, end)}${dayPartLabel(row.dayPart)} was approved.${remark ? ` Remark: ${remark}` : ''}`,
      entityType: 'leave_request',
      entityId: row.id,
    });
    return (await this.repo.findById(this.tenantId, row.id))!;
  }

  async reject(id: string, remark: string, actor: IamActor): Promise<LeaveRequestDto> {
    const row = await this.mustFindRow(id, actor.userId, true);
    if (row.userId === actor.userId) throw new ForbiddenError('You cannot decide your own leave request.');
    if (row.status !== 'PENDING') throw new ConflictError(ErrorCode.INVALID_STATE, `Only pending requests can be rejected (this one is ${row.status.toLowerCase()}).`);
    const ok = await this.repo.transition(this.tenantId, id, ['PENDING'], { status: 'REJECTED', decidedBy: actor.userId, decidedAt: new Date(), decisionRemark: remark });
    if (!ok) throw new ConflictError(ErrorCode.INVALID_STATE, 'This request was already decided.');
    await this.audit.record(actor, 'hr.leave_rejected', 'hr_leave_request', id, { userId: row.userId, remark });
    await this.notifications.notify([row.userId], {
      type: 'LEAVE_REJECTED',
      title: 'Leave rejected',
      body: `Your ${row.leaveType.name} on ${fmtRange(fromDateCol(row.startDate), fromDateCol(row.endDate))}${dayPartLabel(row.dayPart)} was rejected. Remark: ${remark}`,
      entityType: 'leave_request',
      entityId: id,
    });
    return (await this.toDtos([(await this.repo.findById(this.tenantId, id))!], actor.userId))[0]!;
  }

  /** `self` = the employee cancelling their own request (PENDING, or APPROVED in the future); otherwise HR (remark required by the validator). */
  async cancel(id: string, remark: string | undefined, actor: IamActor, mode: 'self' | 'hr'): Promise<LeaveRequestDto> {
    const row = await this.mustFindRow(id, actor.userId, mode === 'hr');
    if (mode === 'self' && row.userId !== actor.userId) throw new NotFoundError('Leave request not found.');
    const today = businessDate();
    if (row.status === 'CANCELLED' || row.status === 'REJECTED') throw new ConflictError(ErrorCode.INVALID_STATE, `This request is already ${row.status.toLowerCase()}.`);
    if (mode === 'self' && row.status === 'APPROVED' && fromDateCol(row.startDate) <= today) {
      throw new ConflictError(ErrorCode.INVALID_STATE, 'An approved leave that has already started cannot be cancelled by the employee. Ask HR.');
    }
    const ok = await this.repo.transition(this.tenantId, id, ['PENDING', 'APPROVED'], { status: 'CANCELLED', cancelledAt: new Date(), ...(mode === 'hr' ? { decidedBy: actor.userId, decidedAt: new Date(), decisionRemark: remark ?? null } : {}) });
    if (!ok) throw new ConflictError(ErrorCode.INVALID_STATE, 'This request can no longer be cancelled.');
    let removed = 0;
    if (row.status === 'APPROVED') removed = await this.attendance.removeLeaveRows(id);
    await this.audit.record(actor, 'hr.leave_cancelled', 'hr_leave_request', id, { userId: row.userId, by: mode, remark: remark ?? null, wasStatus: row.status, attendanceRowsRemoved: removed });
    const range = fmtRange(fromDateCol(row.startDate), fromDateCol(row.endDate));
    if (mode === 'hr') {
      await this.notifications.notify([row.userId], {
        type: 'LEAVE_CANCELLED',
        title: 'Leave cancelled by HR',
        body: `Your ${row.leaveType.name} on ${range} was cancelled.${remark ? ` Remark: ${remark}` : ''}`,
        entityType: 'leave_request',
        entityId: id,
      });
    } else {
      const approvers = (await this.employees.userIdsWithPermission(this.tenantId, 'hr:leave_manage')).filter((u) => u !== row.userId);
      const name = (await this.employees.namesFor(this.tenantId, [row.userId])).get(row.userId) ?? 'An employee';
      await this.notifications.notify(approvers, { type: 'LEAVE_CANCELLED', title: 'Leave cancelled', body: `${name} cancelled their ${row.leaveType.name} on ${range}.`, entityType: 'leave_request', entityId: id });
    }
    return (await this.toDtos([(await this.repo.findById(this.tenantId, id))!], actor.userId))[0]!;
  }

  // ── reads ───────────────────────────────────────────────────────────────
  async listMine(userId: string, q: { status?: LeaveRow['status']; page: number; limit: number }): Promise<Paginated<LeaveRequestDto>> {
    await this.access.requireSelf(userId);
    const { items, total } = await this.repo.list(this.tenantId, { userId, status: q.status }, (q.page - 1) * q.limit, q.limit, false);
    return { items: await this.toDtos(items, userId), total, page: q.page, limit: q.limit, totalPages: Math.max(1, Math.ceil(total / q.limit)) };
  }

  async getMine(userId: string, id: string): Promise<LeaveRequestDto> {
    await this.access.requireSelf(userId);
    const row = await this.repo.findById(this.tenantId, id);
    if (!row || row.userId !== userId) throw new NotFoundError('Leave request not found.');
    return (await this.toDtos([row], userId))[0]!;
  }

  async list(q: { status?: LeaveRow['status']; userId?: string; leaveTypeId?: string; from?: string; to?: string; page: number; limit: number }, actorUserId: string) {
    const scope = await this.access.scope(actorUserId);
    let userIds: string[] | undefined;
    if (scope) userIds = (await this.employees.list(this.tenantId, { restrictToBranchIds: scope })).items.map((e) => e.id);
    if (q.userId && userIds && !userIds.includes(q.userId)) userIds = [];
    const filter = { status: q.status, userId: q.userId, userIds, leaveTypeId: q.leaveTypeId, from: q.from, to: q.to };
    const [{ items, total }, counts] = await Promise.all([
      this.repo.list(this.tenantId, filter, (q.page - 1) * q.limit, q.limit, true),
      this.repo.countsByStatus(this.tenantId, filter),
    ]);
    return { items: await this.toDtos(items, actorUserId), total, page: q.page, limit: q.limit, totalPages: Math.max(1, Math.ceil(total / q.limit)), counts };
  }

  async detail(id: string, actorUserId: string) {
    const row = await this.mustFindRow(id, actorUserId, true);
    const [dto] = await this.toDtos([row], actorUserId);
    const balance = (await this.balancesFor(row.userId, row.leaveYear, [row.leaveTypeId])).find((b) => b.leaveType.id === row.leaveTypeId) ?? null;
    const others = await this.repo.openOverlapping(this.tenantId, (await this.employees.list(this.tenantId, { restrictToBranchIds: await this.access.scope(actorUserId) })).items.map((e) => e.id), fromDateCol(row.startDate), fromDateCol(row.endDate), row.id);
    const refs = await this.employees.refsFor(this.tenantId, others.map((o) => o.userId));
    const conflicts = others
      .filter((o) => o.userId !== row.userId)
      .map((o) => ({ employee: refs.get(o.userId)!, leaveRequestId: o.id, startDate: fromDateCol(o.startDate), endDate: fromDateCol(o.endDate) }))
      .filter((c) => c.employee);
    return { ...dto!, balance, conflicts };
  }

  async upcoming(from: string, to: string, userIds?: string[]): Promise<LeaveRow[]> {
    return this.repo.upcomingApproved(this.tenantId, from, to, userIds);
  }

  async toDtos(rows: LeaveRow[], viewerUserId: string): Promise<LeaveRequestDto[]> {
    const refs = await this.employees.refsFor(this.tenantId, rows.map((r) => r.userId));
    const names = await this.employees.namesFor(this.tenantId, rows.flatMap((r) => [r.appliedBy, r.decidedBy]));
    const today = businessDate();
    return rows.map((r) => {
      const start = fromDateCol(r.startDate);
      return {
        id: r.id,
        employee: refs.get(r.userId) ?? { userId: r.userId, employeeId: '', name: 'Unknown', avatarUrl: null, role: 'STAFF' },
        leaveType: toLeaveTypeRef(r.leaveType),
        startDate: start,
        endDate: fromDateCol(r.endDate),
        dayPart: r.dayPart,
        days: Number(r.days),
        reason: r.reason,
        status: r.status,
        appliedOnBehalf: r.appliedOnBehalf,
        appliedBy: r.appliedBy ? { id: r.appliedBy, name: names.get(r.appliedBy) ?? 'Unknown' } : null,
        createdAt: r.createdAt.toISOString(),
        decidedBy: r.decidedBy ? { id: r.decidedBy, name: names.get(r.decidedBy) ?? 'Unknown' } : null,
        decidedAt: r.decidedAt?.toISOString() ?? null,
        decisionRemark: r.decisionRemark,
        cancelledAt: r.cancelledAt?.toISOString() ?? null,
        canCancel: r.userId === viewerUserId && (r.status === 'PENDING' || (r.status === 'APPROVED' && start > today)),
      };
    });
  }
}

export { toEmployeeRef };
