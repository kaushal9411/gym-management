import { ConflictError, NotFoundError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { businessDate } from '../../../core/utils/business-time';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { RoleRepository } from '../../authentication/repositories/role.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import type { AttendanceDayDto, PayStructureDto, ShiftRefDto } from '../dto/hr.dto';
import type { EmployeeRow } from '../repositories/hr-employee.repository';
import { summarizeDays } from '../utils/attendance.util';
import { addDays, currentMonth, serializeWeekdayList } from '../utils/hr-dates.util';

import { bucketsOf, HrAttendanceService } from './hr-attendance.service';
import { HrAudit } from './hr-audit.service';
import { toShiftRef, type EmployeeCtx } from './hr-calendar.service';
import { toHolidayDto } from './hr-config.service';
import { HrLeaveService } from './hr-leave.service';
import { HrPayrollService } from './hr-payroll.service';

export interface EmployeeItemDto {
  userId: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  accountStatus: string;
  workStatus: string;
  employmentType: string;
  joiningDate: string;
  branches: Array<{ id: string; name: string }>;
  shift: ShiftRefDto | null;
  weeklyOff: string[];
  today: { status: string; checkInTime: string | null; checkOutTime: string | null };
  leaveBalances: Array<{ leaveTypeId: string; code: string; name: string; available: number | null }>;
  pendingLeaves: number;
}

/** Overview, employee list/detail, work setup (shift + weekly off) and pay structure. */
export class HrEmployeeService {
  readonly attendance: HrAttendanceService;
  readonly leaves: HrLeaveService;
  readonly payroll: HrPayrollService;
  private readonly audit: HrAudit;
  private readonly roles: RoleRepository;

  constructor(private readonly tenantId: string) {
    const db = getTenantScopedClient(tenantId);
    this.attendance = new HrAttendanceService(tenantId);
    this.leaves = new HrLeaveService(tenantId);
    this.payroll = new HrPayrollService(tenantId);
    this.audit = new HrAudit(tenantId, db);
    this.roles = new RoleRepository(db);
  }

  private get access() {
    return this.attendance.access;
  }

  private async can(userId: string, key: string): Promise<boolean> {
    return (await this.roles.getPermissionKeysForUser(this.tenantId, userId)).includes(key);
  }

  // ── overview ────────────────────────────────────────────────────────────
  async overview(actorUserId: string) {
    const today = businessDate();
    const [canLeave, canPayroll] = await Promise.all([this.can(actorUserId, 'hr:leave_manage'), this.can(actorUserId, 'hr:payroll_manage')]);
    const { items } = await this.access.employees.list(this.tenantId, { restrictToBranchIds: await this.access.scope(actorUserId) });
    const ids = items.map((e) => e.id);
    const ctxs = await this.attendance.calendar.contexts(items);
    const trendDates = this.attendance.last7(today);
    const [rows, holidays, upcomingHolidays] = await Promise.all([
      this.attendance.repo.rowsForRange(this.tenantId, trendDates[0]!, today, ids),
      this.attendance.config.repo.listHolidays(this.tenantId, trendDates[0]!, today),
      this.attendance.config.repo.listHolidays(this.tenantId, today, addDays(today, 30)),
    ]);
    const rowKey = (userId: string, date: string) => `${userId}|${date}`;
    const rowBy = new Map(rows.map((r) => [rowKey(r.userId, r.date.toISOString().slice(0, 10)), r]));
    const perDay = (date: string): AttendanceDayDto[] =>
      items.map((e) => {
        const ctx = ctxs.get(e.id)!;
        return this.attendance.calendar.dayDto({ date, ctx, row: rowBy.get(rowKey(e.id, date)) ?? null, holidays: this.attendance.calendar.holidayMap(ctx, holidays), names: new Map(), today });
      });
    const trend = trendDates.map((date) => {
      const b = bucketsOf(summarizeDays(perDay(date)));
      return { date, present: b.present, late: b.late, halfDay: b.halfDay, onLeave: b.onLeave, absent: b.absent };
    });
    const todayBuckets = bucketsOf(summarizeDays(perDay(today)));
    const checkedInNow = rows.filter((r) => r.date.toISOString().slice(0, 10) === today && r.checkInAt && !r.checkOutAt).length;

    const upcomingRows = canLeave ? await this.leaves.upcoming(today, addDays(today, 14), ids) : [];
    const upcomingLeaves = (await this.leaves.toDtos(upcomingRows, actorUserId)).map((l) => ({ id: l.id, employee: l.employee, leaveType: l.leaveType, startDate: l.startDate, endDate: l.endDate, dayPart: l.dayPart, days: l.days }));
    return {
      date: today,
      headcount: items.length,
      today: { ...todayBuckets, yetToCheckIn: todayBuckets.notMarked, checkedInNow },
      pendingLeaves: await this.leaves.repo.countPending(this.tenantId, ids),
      payroll: canPayroll ? await this.payroll.statusFor(currentMonth()) : null,
      upcomingLeaves,
      trend,
      upcomingHolidays: upcomingHolidays.map(toHolidayDto),
    };
  }

  // ── employees ───────────────────────────────────────────────────────────
  async list(q: { search?: string; status?: EmployeeRow['status']; branchId?: string; page: number; limit: number }, actorUserId: string) {
    const { items, total } = await this.access.employees.list(
      this.tenantId,
      { search: q.search, status: q.status, branchId: q.branchId, restrictToBranchIds: await this.access.scope(actorUserId) },
      (q.page - 1) * q.limit,
      q.limit,
    );
    const dtos = await this.itemDtos(items);
    return { items: dtos, total, page: q.page, limit: q.limit, totalPages: Math.max(1, Math.ceil(total / q.limit)) };
  }

  async itemDtos(items: EmployeeRow[]): Promise<EmployeeItemDto[]> {
    const ids = items.map((e) => e.id);
    const today = businessDate();
    const [ctxs, dayView, balances, pending] = await Promise.all([
      this.attendance.calendar.contexts(items),
      this.attendance.dayViewFor(items, today),
      this.leaves.balancesForUsers(ids, await this.leaves.currentLeaveYear()),
      this.leaves.repo.pendingCountsByUser(this.tenantId, ids),
    ]);
    const dayBy = new Map(dayView.map((d) => [d.employee.userId, d.attendance]));
    return items.map((e) => {
      const ctx = ctxs.get(e.id)!;
      const day = dayBy.get(e.id)!;
      return {
        userId: e.id,
        employeeId: ctx.employeeCode,
        name: e.name,
        email: e.email,
        phone: e.phone,
        avatarUrl: e.avatarUrl,
        role: ctx.role,
        accountStatus: e.status,
        workStatus: e.staffProfile.workStatus,
        employmentType: e.staffProfile.employmentType,
        joiningDate: ctx.joiningDate,
        branches: ctx.branches,
        shift: ctx.shift ? toShiftRef(ctx.shift) : null,
        weeklyOff: [...ctx.weeklyOff],
        today: { status: day.status, checkInTime: day.checkInTime, checkOutTime: day.checkOutTime },
        leaveBalances: (balances.get(e.id) ?? []).map((b) => ({ leaveTypeId: b.leaveType.id, code: b.leaveType.code, name: b.leaveType.name, available: b.available })),
        pendingLeaves: pending.get(e.id) ?? 0,
      };
    });
  }

  async detail(userId: string, month: string | undefined, actorUserId: string) {
    const emp = await this.access.mustFindEmployee(userId, actorUserId);
    const [canLeave, canPayroll] = await Promise.all([this.can(actorUserId, 'hr:leave_manage'), this.can(actorUserId, 'hr:payroll_manage')]);
    const ctx = (await this.attendance.calendar.contexts([emp])).get(userId)!;
    const [item] = await this.itemDtos([emp]);
    const [attendance, balances, leaves, payStructure, payslips] = await Promise.all([
      this.attendance.monthFor(ctx, month ?? currentMonth()),
      this.leaves.balancesFor(userId),
      canLeave ? this.leaves.repo.list(this.tenantId, { userId }, 0, 50, false).then((r) => this.leaves.toDtos(r.items, actorUserId)) : Promise.resolve([]),
      canPayroll ? this.payStructure(emp, ctx) : Promise.resolve(null),
      canPayroll ? this.payroll.summariesForUsers(userId, 12) : Promise.resolve([]),
    ]);
    return { employee: item, attendance, leaves, balances, payStructure, payslips };
  }

  // ── work setup ──────────────────────────────────────────────────────────
  async setWorkSetup(userId: string, input: { shiftId?: string | null; weeklyOff?: string[] | null }, actor: IamActor): Promise<{ shift: ShiftRefDto | null; weeklyOff: string[] }> {
    const emp = await this.access.mustFindEmployee(userId, actor.userId);
    const before = (await this.attendance.calendar.contexts([emp])).get(userId)!;
    const repo = this.access.employees;
    if (input.shiftId !== undefined) {
      if (input.shiftId === null) await repo.setShift(userId, null, null);
      else {
        const shift = await this.attendance.config.mustFindShift(input.shiftId);
        if (!shift.isActive) throw new ConflictError(ErrorCode.INVALID_STATE, 'This shift is not active.');
        await repo.setShift(userId, shift.id, shift.name);
      }
    }
    if (input.weeklyOff !== undefined) await repo.setWeeklyOff(userId, input.weeklyOff === null || input.weeklyOff.length === 0 ? null : serializeWeekdayList(input.weeklyOff));
    const fresh = await this.access.employees.findOne(this.tenantId, userId);
    if (!fresh) throw new NotFoundError('Employee not found.');
    const after = (await this.attendance.calendar.contexts([fresh])).get(userId)!;
    await this.audit.record(actor, 'hr.work_setup_updated', 'hr_work_setup', userId, { before: { shift: before.shift?.name ?? null, weeklyOff: [...before.weeklyOff] }, after: { shift: after.shift?.name ?? null, weeklyOff: [...after.weeklyOff] } });
    return { shift: after.shift ? toShiftRef(after.shift) : null, weeklyOff: [...after.weeklyOff] };
  }

  // ── pay structure ───────────────────────────────────────────────────────
  async payStructure(emp: EmployeeRow, ctx: EmployeeCtx): Promise<PayStructureDto> {
    const components = await this.access.employees.listComponents(this.tenantId, [emp.id]);
    const allowances = components.filter((c) => c.isActive && c.type === 'ALLOWANCE').reduce((a, c) => a + Number(c.amount), 0);
    const deductions = components.filter((c) => c.isActive && c.type === 'DEDUCTION').reduce((a, c) => a + Number(c.amount), 0);
    return {
      userId: emp.id,
      salaryType: ctx.salaryType,
      baseSalary: ctx.salaryAmount,
      components: components.map((c) => ({ id: c.id, name: c.name, type: c.type, amount: Number(c.amount), isActive: c.isActive })),
      monthlyGross: Math.round(((ctx.salaryAmount ?? 0) + allowances) * 100) / 100,
      fixedDeductions: Math.round(deductions * 100) / 100,
    };
  }

  async getPayStructure(userId: string, actorUserId: string): Promise<PayStructureDto> {
    const emp = await this.access.mustFindEmployee(userId, actorUserId);
    const ctx = (await this.attendance.calendar.contexts([emp])).get(userId)!;
    return this.payStructure(emp, ctx);
  }

  async setPayStructure(userId: string, input: { baseSalary?: number; components: Array<{ name: string; type: 'ALLOWANCE' | 'DEDUCTION'; amount: number; isActive: boolean }> }, actor: IamActor): Promise<PayStructureDto> {
    const emp = await this.access.mustFindEmployee(userId, actor.userId);
    const ctxBefore = (await this.attendance.calendar.contexts([emp])).get(userId)!;
    const before = await this.payStructure(emp, ctxBefore);
    if (input.baseSalary !== undefined) await this.access.employees.setSalary(userId, input.baseSalary);
    await this.access.employees.replaceComponents(this.tenantId, userId, input.components);
    const fresh = (await this.access.employees.findOne(this.tenantId, userId))!;
    const ctx = (await this.attendance.calendar.contexts([fresh])).get(userId)!;
    const after = await this.payStructure(fresh, ctx);
    await this.audit.record(actor, 'hr.pay_structure_updated', 'hr_pay_structure', userId, { before: { baseSalary: before.baseSalary, components: before.components.length, monthlyGross: before.monthlyGross }, after: { baseSalary: after.baseSalary, components: after.components.length, monthlyGross: after.monthlyGross } });
    return after;
  }

}
