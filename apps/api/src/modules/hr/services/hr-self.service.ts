import { businessDate } from '../../../core/utils/business-time';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import type { HolidayDto, LeaveTypeDto } from '../dto/hr.dto';
import { summarizeDays } from '../utils/attendance.util';
import { addDays, currentMonth, leaveYearBounds, leaveYearLabel, weekdayOf } from '../utils/hr-dates.util';

import { HrAttendanceService } from './hr-attendance.service';
import { toShiftRef } from './hr-calendar.service';
import { toHolidayDto } from './hr-config.service';
import { HrLeaveService } from './hr-leave.service';
import { HrNotificationService } from './hr-notification.service';
import { HrPayrollService } from './hr-payroll.service';

/** Composes the `/hr/me/*` read models (always the caller's own data). */
export class HrSelfService {
  readonly attendance: HrAttendanceService;
  readonly leaves: HrLeaveService;
  readonly payroll: HrPayrollService;
  readonly notifications: HrNotificationService;

  constructor(private readonly tenantId: string) {
    getTenantScopedClient(tenantId); // eager tenant validation of the id shape
    this.attendance = new HrAttendanceService(tenantId);
    this.leaves = new HrLeaveService(tenantId);
    this.payroll = new HrPayrollService(tenantId);
    this.notifications = new HrNotificationService(tenantId);
  }

  async summary(userId: string) {
    const emp = await this.attendance.access.requireSelf(userId);
    const policy = await this.attendance.config.getPolicyRow();
    const ctx = (await this.attendance.calendar.contexts([emp], policy)).get(userId)!;
    const today = businessDate();
    const month = currentMonth();
    const [monthView, balances, pendingRows, upcomingRows, holidayRows, latestPayslip, unread] = await Promise.all([
      this.attendance.monthFor(ctx, month),
      this.leaves.balancesFor(userId),
      this.leaves.repo.list(this.tenantId, { userId, status: 'PENDING' }, 0, 20, false),
      this.leaves.upcoming(today, addDays(today, 365), [userId]),
      this.attendance.config.repo.listHolidays(this.tenantId, today, addDays(today, 60)),
      this.payroll.latestVisibleFor(userId),
      this.notifications.unreadCount(userId),
    ]);
    const todayDay = monthView.days.find((d) => d.date === today)!;
    const holidayMap = this.attendance.calendar.holidayMap(ctx, holidayRows);
    const weeklyOffToday = ctx.weeklyOff.has(weekdayOf(today));
    const hasIn = Boolean(todayDay.checkInAt);
    const hasOut = Boolean(todayDay.checkOutAt);
    const blockedByLeave = todayDay.status === 'ON_LEAVE';
    const markedByHr = todayDay.recorded && !hasIn && todayDay.leaveRequestId === null && !['ABSENT', 'WEEKLY_OFF', 'HOLIDAY'].includes(todayDay.status);
    return {
      employee: { userId, employeeId: ctx.employeeCode, name: ctx.name, avatarUrl: ctx.avatarUrl, role: ctx.role, joiningDate: ctx.joiningDate, shift: ctx.shift ? toShiftRef(ctx.shift) : null, weeklyOff: [...ctx.weeklyOff] },
      today: {
        date: today,
        attendance: todayDay,
        isWeeklyOff: weeklyOffToday,
        holidayName: holidayMap.get(today) ?? null,
        canCheckIn: !hasIn && !blockedByLeave && !markedByHr,
        canCheckOut: hasIn && !hasOut,
      },
      month: { month, stats: summarizeDays(monthView.days) },
      leaveBalances: balances,
      pendingLeaves: await this.leaves.toDtos(pendingRows.items, userId),
      upcomingLeaves: (await this.leaves.toDtos(upcomingRows, userId)).slice(0, 5),
      upcomingHolidays: holidayRows.filter((h) => h.branchId === null || ctx.branchIds.includes(h.branchId)).map(toHolidayDto),
      latestPayslip,
      unreadNotifications: unread,
    };
  }

  async leaveTypes(userId: string): Promise<LeaveTypeDto[]> {
    await this.attendance.access.requireSelf(userId);
    return this.attendance.config.listLeaveTypes(false);
  }

  async leaveBalances(userId: string, leaveYear?: number) {
    await this.attendance.access.requireSelf(userId);
    const policy = await this.attendance.config.getPolicyRow();
    const year = leaveYear ?? (await this.leaves.currentLeaveYear(policy));
    const bounds = leaveYearBounds(year, policy.leaveYearStartMonth);
    return {
      leaveYear: year,
      leaveYearLabel: leaveYearLabel(year, policy.leaveYearStartMonth),
      periodStart: bounds.start,
      periodEnd: bounds.end,
      balances: await this.leaves.balancesFor(userId, year),
    };
  }

  async holidays(userId: string, year?: number): Promise<HolidayDto[]> {
    const emp = await this.attendance.access.requireSelf(userId);
    const ctx = (await this.attendance.calendar.contexts([emp])).get(userId)!;
    const all = await this.attendance.config.repo.listHolidays(this.tenantId, `${year ?? Number(businessDate().slice(0, 4))}-01-01`, `${year ?? Number(businessDate().slice(0, 4))}-12-31`);
    return all.filter((h) => h.branchId === null || ctx.branchIds.includes(h.branchId)).map(toHolidayDto);
  }
}
