import { businessDate } from '../../../core/utils/business-time';
import type { AttendanceDayDto, EmployeeRefDto, LeaveTypeRefDto, ShiftRefDto } from '../dto/hr.dto';
import type { AttendanceRow } from '../repositories/hr-attendance.repository';
import type { HolidayRow, PolicyRow, ShiftRow } from '../repositories/hr-config.repository';
import { primaryRole, type EmployeeRow } from '../repositories/hr-employee.repository';
import { computedStatus, type DayStatus } from '../utils/attendance.util';
import { fromDateCol, istTimeOf, parseWeekdayList } from '../utils/hr-dates.util';
import type { DayPart } from '../utils/leave.util';

import type { HrConfigService } from './hr-config.service';

/** Everything about one employee that "which day is what" decisions need. */
export interface EmployeeCtx {
  userId: string;
  employeeCode: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  joiningDate: string;
  weeklyOff: Set<string>;
  branchIds: string[];
  branches: Array<{ id: string; name: string }>;
  /** Assigned shift, else the tenant default shift (may be null when none exists). */
  shift: ShiftRow | null;
  assignedShiftId: string | null;
  salaryType: string;
  salaryAmount: number | null;
}

export const toLeaveTypeRef = (t: { id: string; name: string; code: string; color: string; isPaid: boolean }): LeaveTypeRefDto => ({
  id: t.id,
  name: t.name,
  code: t.code,
  color: t.color,
  isPaid: t.isPaid,
});

export const toShiftRef = (s: ShiftRow): ShiftRefDto => ({ id: s.id, name: s.name, startTime: s.startTime, endTime: s.endTime, graceMinutes: s.graceMinutes });

export const toEmployeeRef = (c: Pick<EmployeeCtx, 'userId' | 'employeeCode' | 'name' | 'avatarUrl' | 'role'>): EmployeeRefDto => ({
  userId: c.userId,
  employeeId: c.employeeCode,
  name: c.name,
  avatarUrl: c.avatarUrl,
  role: c.role,
});

/** Builds per-employee calendar contexts (weekly off, branches, effective shift) and AttendanceDay DTOs. */
export class HrCalendarService {
  constructor(
    private readonly tenantId: string,
    private readonly config: HrConfigService,
  ) {}

  async contexts(employees: EmployeeRow[], policy?: PolicyRow): Promise<Map<string, EmployeeCtx>> {
    const pol = policy ?? (await this.config.getPolicyRow());
    const defaultShift = await this.config.repo.findDefaultShift(this.tenantId);
    const map = new Map<string, EmployeeCtx>();
    for (const e of employees) {
      const sp = e.staffProfile;
      const shift = sp.hrShift ?? defaultShift;
      const own = parseWeekdayList(sp.weeklyOff);
      const fromShift = shift ? parseWeekdayList(shift.weeklyOffDays) : [];
      const weeklyOff = new Set(own.length ? own : fromShift.length ? fromShift : parseWeekdayList(pol.defaultWeeklyOff));
      map.set(e.id, {
        userId: e.id,
        employeeCode: sp.employeeId,
        name: e.name,
        avatarUrl: e.avatarUrl,
        role: primaryRole(e),
        joiningDate: fromDateCol(sp.joiningDate),
        weeklyOff,
        branchIds: e.userBranches.map((b) => b.branchId),
        branches: e.userBranches.map((b) => ({ id: b.branch.id, name: b.branch.name })),
        shift,
        assignedShiftId: sp.shiftId,
        salaryType: sp.salaryType,
        salaryAmount: sp.salaryAmount === null ? null : Number(sp.salaryAmount),
      });
    }
    return map;
  }

  /** date -> holiday name for one employee (global holidays + the employee's branches). */
  holidayMap(ctx: Pick<EmployeeCtx, 'branchIds'>, holidays: HolidayRow[]): Map<string, string> {
    const m = new Map<string, string>();
    for (const h of holidays) {
      if (h.branchId === null || ctx.branchIds.includes(h.branchId)) {
        const d = fromDateCol(h.date);
        if (!m.has(d) || h.branchId === null) m.set(d, h.name);
      }
    }
    return m;
  }

  /**
   * One AttendanceDay. `row` null => computed status (ABSENT is computed on
   * read, never stored).
   */
  dayDto(args: {
    date: string;
    ctx: EmployeeCtx;
    row: AttendanceRow | null;
    holidays: Map<string, string>;
    today?: string;
    /** Clock used to derive TODAY's absence after shift end (default: the real now). */
    now?: Date;
    names: Map<string, string>;
  }): AttendanceDayDto {
    const { date, ctx, row, holidays, names } = args;
    const now = args.now ?? new Date();
    const today = args.today ?? businessDate(now);
    const holidayName = holidays.get(date) ?? null;
    const shiftSnap = row?.shiftName ? { name: row.shiftName, startTime: row.shiftStart ?? '', endTime: row.shiftEnd ?? '' } : ctx.shift ? { name: ctx.shift.name, startTime: ctx.shift.startTime, endTime: ctx.shift.endTime } : null;
    if (!row) {
      const status: DayStatus = computedStatus({ date, today, joiningDate: ctx.joiningDate, weeklyOff: ctx.weeklyOff, holidayName, shiftEndTime: ctx.shift?.endTime ?? null, now });
      return {
        date,
        userId: ctx.userId,
        status,
        recorded: false,
        id: null,
        checkInAt: null,
        checkOutAt: null,
        checkInTime: null,
        checkOutTime: null,
        workedMinutes: null,
        lateMinutes: 0,
        overtimeMinutes: 0,
        source: null,
        remark: null,
        markedBy: null,
        leaveRequestId: null,
        leaveType: null,
        leaveDayPart: null,
        holidayName,
        shift: shiftSnap,
      };
    }
    return {
      date,
      userId: ctx.userId,
      status: row.status,
      recorded: true,
      id: row.id,
      checkInAt: row.checkInAt?.toISOString() ?? null,
      checkOutAt: row.checkOutAt?.toISOString() ?? null,
      checkInTime: row.checkInAt ? istTimeOf(row.checkInAt) : null,
      checkOutTime: row.checkOutAt ? istTimeOf(row.checkOutAt) : null,
      workedMinutes: row.workedMinutes,
      lateMinutes: row.lateMinutes,
      overtimeMinutes: row.overtimeMinutes,
      source: row.source,
      remark: row.remark,
      markedBy: row.markedBy ? { id: row.markedBy, name: names.get(row.markedBy) ?? 'Unknown' } : null,
      leaveRequestId: row.leaveRequestId,
      leaveType: row.leaveRequest ? toLeaveTypeRef(row.leaveRequest.leaveType) : null,
      leaveDayPart: (row.leaveRequest?.dayPart as DayPart | undefined) ?? null,
      holidayName,
      shift: shiftSnap,
    };
  }
}
