import { AUTO_ABSENT_HINT, groupLeavesByDay, isAutoAbsent, todaySegments } from '@/features/hr/lib/derive';
import type { HrOverview, LeaveCalendarItem } from '@/features/hr/types';

const type = { id: 't1', name: 'Casual Leave', code: 'CASUAL', color: '#6366f1', isPaid: true };
const item = (over: Partial<LeaveCalendarItem>): LeaveCalendarItem => ({
  id: 'l1',
  userId: 'u1',
  employeeName: 'Vikram Coach',
  leaveType: type,
  startDate: '2026-11-25',
  endDate: '2026-11-26',
  dayPart: 'FULL_DAY',
  days: 2,
  status: 'APPROVED',
  ...over,
});

describe('groupLeavesByDay (team calendar)', () => {
  it('buckets a multi-day request on every day it covers', () => {
    const m = groupLeavesByDay([item({})], '2026-11-01', '2026-11-30');
    expect([...m.keys()]).toEqual(['2026-11-25', '2026-11-26']);
  });

  it('clips requests that start before / end after the window', () => {
    const m = groupLeavesByDay([item({ startDate: '2026-10-29', endDate: '2026-11-02' }), item({ id: 'l2', startDate: '2026-11-29', endDate: '2026-12-03' })], '2026-11-01', '2026-11-30');
    expect([...m.keys()].sort()).toEqual(['2026-11-01', '2026-11-02', '2026-11-29', '2026-11-30']);
  });

  it('ignores requests entirely outside the window and handles empty input', () => {
    expect(groupLeavesByDay([item({ startDate: '2026-12-10', endDate: '2026-12-11' })], '2026-11-01', '2026-11-30').size).toBe(0);
    expect(groupLeavesByDay([], '2026-11-01', '2026-11-30').size).toBe(0);
  });

  it('keeps several people on the same day and a half-day request on its single date', () => {
    const m = groupLeavesByDay([item({}), item({ id: 'l2', userId: 'u2', employeeName: 'Asha', startDate: '2026-11-26', endDate: '2026-11-26', dayPart: 'HALF_DAY_MORNING', days: 0.5, status: 'PENDING' })], '2026-11-01', '2026-11-30');
    expect(m.get('2026-11-26')!.map((x) => x.id)).toEqual(['l1', 'l2']);
    expect(m.get('2026-11-25')).toHaveLength(1);
  });
});

describe('isAutoAbsent', () => {
  it('is true only for an ABSENT day with no stored row', () => {
    expect(isAutoAbsent({ status: 'ABSENT', recorded: false })).toBe(true);
    expect(isAutoAbsent({ status: 'ABSENT', recorded: true })).toBe(false);
    expect(isAutoAbsent({ status: 'NOT_MARKED', recorded: false })).toBe(false);
    expect(isAutoAbsent(undefined)).toBe(false);
    expect(AUTO_ABSENT_HINT).toBe('No check-in recorded');
  });
});

describe('todaySegments', () => {
  const today: HrOverview['today'] = { present: 2, late: 1, halfDay: 1, onLeave: 1, absent: 2, weeklyOff: 0, holiday: 1, notMarked: 3, yetToCheckIn: 3, checkedInNow: 3 };

  it('adds up to the headcount and exposes Absent and Yet to check in separately', () => {
    const segs = todaySegments(today);
    expect(segs.reduce((s, x) => s + x.value, 0)).toBe(11);
    expect(segs.find((s) => s.label === 'Absent')!.value).toBe(2);
    expect(segs.find((s) => s.label === 'Yet to check in')!.value).toBe(3);
  });

  it('falls back to notMarked when an older API omits yetToCheckIn', () => {
    const { yetToCheckIn: _omit, ...rest } = today;
    void _omit;
    expect(todaySegments(rest as HrOverview['today']).find((s) => s.tone === 'none')!.value).toBe(3);
  });
});
