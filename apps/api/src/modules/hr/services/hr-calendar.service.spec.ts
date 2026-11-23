import { describe, expect, it } from 'vitest';

import { summarizeDays } from '../utils/attendance.util';

import { bucketsOf } from './hr-attendance.service';
import { HrCalendarService, type EmployeeCtx } from './hr-calendar.service';

// Monday 2026-11-23, IST. 21:00 IST = 15:30Z.
const TODAY = '2026-11-23';
const at = (hm: string) => {
  const [h, m] = hm.split(':').map(Number) as [number, number];
  return new Date(Date.UTC(2026, 10, 23, h, m) - 330 * 60_000);
};
const shift = { id: 's1', name: 'General', startTime: '06:00', endTime: '21:00', graceMinutes: 10 };
const ctx = (over: Partial<EmployeeCtx> = {}): EmployeeCtx =>
  ({
    userId: 'u1',
    employeeCode: 'EMP-0001',
    name: 'Vikram Coach',
    avatarUrl: null,
    role: 'TRAINER',
    joiningDate: '2026-11-01',
    weeklyOff: new Set(['SUNDAY']),
    branchIds: [],
    branches: [],
    shift,
    assignedShiftId: null,
    salaryType: 'MONTHLY',
    salaryAmount: null,
    ...over,
  }) as EmployeeCtx;

const cal = new HrCalendarService('tenant-1', {} as never);
const day = (c: EmployeeCtx, now: Date, over: { row?: unknown; holidays?: Map<string, string> } = {}) =>
  cal.dayDto({ date: TODAY, ctx: c, row: (over.row ?? null) as never, holidays: over.holidays ?? new Map(), today: TODAY, now, names: new Map() });

const rowOf = (status: string, extra: Record<string, unknown> = {}) => ({
  id: 'r1',
  userId: 'u1',
  status,
  checkInAt: null,
  checkOutAt: null,
  workedMinutes: null,
  lateMinutes: 0,
  overtimeMinutes: 0,
  source: 'SYSTEM',
  markedBy: null,
  remark: null,
  leaveRequestId: null,
  leaveRequest: null,
  shiftName: null,
  shiftStart: null,
  shiftEnd: null,
  ...extra,
});

describe('dayDto: today is derived ABSENT only after the shift end (shared by overview + roster + month views)', () => {
  it('before shift end => NOT_MARKED, after => ABSENT, still unrecorded', () => {
    expect(day(ctx(), at('20:59')).status).toBe('NOT_MARKED');
    const after = day(ctx(), at('21:01'));
    expect(after.status).toBe('ABSENT');
    expect(after.recorded).toBe(false);
  });

  it('exactly at the shift end is not yet absent', () => {
    expect(day(ctx(), at('21:00')).status).toBe('NOT_MARKED');
  });

  it("uses the employee's own shift end (an early shift ends earlier)", () => {
    const early = ctx({ shift: { ...shift, endTime: '14:00' } as never });
    expect(day(early, at('14:30')).status).toBe('ABSENT');
    expect(day(ctx(), at('14:30')).status).toBe('NOT_MARKED');
  });

  it('no shift at all => never absent today', () => {
    expect(day(ctx({ shift: null }), at('23:30')).status).toBe('NOT_MARKED');
  });

  it('weekly off / holiday are never absent', () => {
    expect(day(ctx({ weeklyOff: new Set(['MONDAY']) }), at('22:00')).status).toBe('WEEKLY_OFF');
    expect(day(ctx(), at('22:00'), { holidays: new Map([[TODAY, 'Diwali']]) }).status).toBe('HOLIDAY');
  });

  it('joined today still counts as expected; joins tomorrow does not', () => {
    expect(day(ctx({ joiningDate: TODAY }), at('22:00')).status).toBe('ABSENT');
    expect(day(ctx({ joiningDate: '2026-11-24' }), at('22:00')).status).toBe('NOT_JOINED');
  });

  it('a recorded row always wins (half-day leave stays HALF_DAY, leave ON_LEAVE, a punch PRESENT)', () => {
    expect(day(ctx(), at('22:00'), { row: rowOf('HALF_DAY', { leaveRequestId: 'l1' }) }).status).toBe('HALF_DAY');
    expect(day(ctx(), at('22:00'), { row: rowOf('ON_LEAVE', { leaveRequestId: 'l1' }) }).status).toBe('ON_LEAVE');
    expect(day(ctx(), at('22:00'), { row: rowOf('PRESENT', { source: 'SELF', checkInAt: at('06:05') }) }).status).toBe('PRESENT');
  });
});

describe('overview buckets add up', () => {
  it('splits expected-but-missing people into absent (after shift end) and notMarked / yetToCheckIn (before)', () => {
    const early = { ...shift, endTime: '14:00' } as never;
    const emps: Array<{ c: EmployeeCtx; row?: unknown }> = [
      { c: ctx({ userId: 'a' }), row: rowOf('PRESENT') },
      { c: ctx({ userId: 'b' }), row: rowOf('LATE') },
      { c: ctx({ userId: 'c' }), row: rowOf('ON_LEAVE', { leaveRequestId: 'l' }) },
      { c: ctx({ userId: 'd', shift: early }) }, // shift ended 14:00 -> absent at 15:00
      { c: ctx({ userId: 'e' }) }, // shift ends 21:00 -> yet to check in
      { c: ctx({ userId: 'f', shift: null }) }, // no shift -> yet to check in
    ];
    const now = at('15:00');
    const b = bucketsOf(summarizeDays(emps.map((e) => day(e.c, now, { row: e.row }))));
    expect(b).toMatchObject({ present: 1, late: 1, onLeave: 1, absent: 1, notMarked: 2 });
    expect(Object.values(b).reduce((a, n) => a + n, 0)).toBe(emps.length);
  });
});
