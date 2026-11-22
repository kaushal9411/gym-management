import { describe, expect, it } from 'vitest';

import { balanceFigures, carryForwardAmount, computeLeaveDays, leaveSpansOverlap } from './leave.util';

const sundayOff = new Set(['SUNDAY']);
const noHolidays = new Map<string, string>();

describe('computeLeaveDays', () => {
  it('counts working days only and reports what was excluded', () => {
    // Thu 26 Nov -> Mon 30 Nov 2026: Thu, Fri, Sat, (Sun off), Mon = 4
    const r = computeLeaveDays({ startDate: '2026-11-26', endDate: '2026-11-30', dayPart: 'FULL_DAY', weeklyOff: sundayOff, holidays: noHolidays });
    expect(r.days).toBe(4);
    expect(r.workingDates).toEqual(['2026-11-26', '2026-11-27', '2026-11-28', '2026-11-30']);
    expect(r.excluded).toEqual([{ date: '2026-11-29', reason: 'WEEKLY_OFF' }]);
  });

  it('excludes holidays and names them', () => {
    const r = computeLeaveDays({ startDate: '2026-11-23', endDate: '2026-11-25', dayPart: 'FULL_DAY', weeklyOff: sundayOff, holidays: new Map([['2026-11-24', 'Guru Nanak Jayanti']]) });
    expect(r.days).toBe(2);
    expect(r.excluded).toEqual([{ date: '2026-11-24', reason: 'HOLIDAY', name: 'Guru Nanak Jayanti' }]);
  });

  it('a single-day half day counts 0.5, either part', () => {
    for (const dayPart of ['HALF_DAY_MORNING', 'HALF_DAY_EVENING'] as const) {
      expect(computeLeaveDays({ startDate: '2026-11-23', endDate: '2026-11-23', dayPart, weeklyOff: sundayOff, holidays: noHolidays }).days).toBe(0.5);
    }
  });

  it('a half day on a weekly off or holiday counts 0 (nothing to take leave from)', () => {
    expect(computeLeaveDays({ startDate: '2026-11-22', endDate: '2026-11-22', dayPart: 'HALF_DAY_MORNING', weeklyOff: sundayOff, holidays: noHolidays }).days).toBe(0);
    expect(computeLeaveDays({ startDate: '2026-11-24', endDate: '2026-11-24', dayPart: 'FULL_DAY', weeklyOff: sundayOff, holidays: new Map([['2026-11-24', 'H']]) }).days).toBe(0);
  });

  it('supports multiple weekly offs', () => {
    const r = computeLeaveDays({ startDate: '2026-11-21', endDate: '2026-11-29', dayPart: 'FULL_DAY', weeklyOff: new Set(['SATURDAY', 'SUNDAY']), holidays: noHolidays });
    expect(r.days).toBe(5);
  });
});

describe('leaveSpansOverlap', () => {
  const full = (s: string, e: string) => ({ startDate: s, endDate: e, dayPart: 'FULL_DAY' as const });
  it('detects intersecting ranges, including touching ends', () => {
    expect(leaveSpansOverlap(full('2026-11-10', '2026-11-12'), full('2026-11-12', '2026-11-14'))).toBe(true);
    expect(leaveSpansOverlap(full('2026-11-10', '2026-11-12'), full('2026-11-13', '2026-11-14'))).toBe(false);
  });
  it('allows a morning and an evening half day on the same date', () => {
    const am = { startDate: '2026-11-23', endDate: '2026-11-23', dayPart: 'HALF_DAY_MORNING' as const };
    const pm = { startDate: '2026-11-23', endDate: '2026-11-23', dayPart: 'HALF_DAY_EVENING' as const };
    expect(leaveSpansOverlap(am, pm)).toBe(false);
    expect(leaveSpansOverlap(am, am)).toBe(true);
  });
  it('a half day clashes with any full-day span covering it', () => {
    const am = { startDate: '2026-11-23', endDate: '2026-11-23', dayPart: 'HALF_DAY_MORNING' as const };
    expect(leaveSpansOverlap(am, full('2026-11-20', '2026-11-25'))).toBe(true);
  });
});

describe('balances', () => {
  it('available = quota + carry + adjustment - used - pending', () => {
    expect(balanceFigures({ quota: 12, carriedForward: 2, adjustment: 1, used: 3, pending: 1.5 })).toEqual({ entitled: 15, used: 3, pending: 1.5, available: 10.5 });
  });
  it('unlimited types never run out', () => {
    expect(balanceFigures({ quota: null, carriedForward: 0, adjustment: 0, used: 20, pending: 2 })).toEqual({ entitled: null, used: 20, pending: 2, available: null });
  });
  it('carry-forward is the previous remainder capped by the type maximum', () => {
    expect(carryForwardAmount(9, 5)).toBe(5);
    expect(carryForwardAmount(3, 5)).toBe(3);
    expect(carryForwardAmount(9, null)).toBe(9);
    expect(carryForwardAmount(-2, 5)).toBe(0);
  });
});
