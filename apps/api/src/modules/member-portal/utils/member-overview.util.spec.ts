import { describe, expect, it } from 'vitest';

import {
  computeStreaks,
  fillDailySeries,
  fillWeekdayCounts,
  flattenBusinessHours,
  membershipCountdown,
  monthComparisonWindows,
  pickSocialLinks,
  progressPercent,
  sumVisits,
  weekStartMonday,
} from './member-overview.util';

describe('computeStreaks', () => {
  it('returns zeros with no visits', () => {
    expect(computeStreaks([], '2026-10-04')).toEqual({ current: 0, best: 0 });
  });
  it('counts a run ending today', () => {
    expect(computeStreaks(['2026-10-02', '2026-10-03', '2026-10-04'], '2026-10-04')).toEqual({
      current: 3,
      best: 3,
    });
  });
  it('keeps the streak alive when the last visit was yesterday', () => {
    expect(computeStreaks(['2026-10-02', '2026-10-03'], '2026-10-04').current).toBe(2);
  });
  it('resets when the last visit was 2+ days ago, but keeps best', () => {
    expect(
      computeStreaks(['2026-09-01', '2026-09-02', '2026-09-03', '2026-10-02'], '2026-10-04'),
    ).toEqual({ current: 0, best: 3 });
  });
  it('dedupes same-day visits, ignores order and crosses month boundaries', () => {
    expect(
      computeStreaks(['2026-10-01', '2026-09-30', '2026-10-01', '2026-09-29'], '2026-10-01'),
    ).toEqual({ current: 3, best: 3 });
  });
});

describe('fillDailySeries', () => {
  it('returns 84 zero-filled rows oldest to today', () => {
    const out = fillDailySeries(
      [
        { date: '2026-10-04', visits: 2 },
        { date: '2026-07-13', visits: 1 },
        { date: '2026-07-12', visits: 9 },
      ],
      '2026-10-04',
    );
    expect(out).toHaveLength(84);
    expect(out[0]).toEqual({ date: '2026-07-13', visits: 1 });
    expect(out[83]).toEqual({ date: '2026-10-04', visits: 2 });
    expect(out.reduce((s, r) => s + r.visits, 0)).toBe(3);
  });
});

describe('fillWeekdayCounts', () => {
  it('always returns 7 rows, 0 = Sunday', () => {
    const out = fillWeekdayCounts([
      { date: '2026-10-04', visits: 2 },
      { date: '2026-10-05', visits: 1 },
    ]);
    expect(out).toHaveLength(7);
    expect(out[0]).toEqual({ weekday: 0, count: 2 }); // 2026-10-04 is a Sunday
    expect(out[1]).toEqual({ weekday: 1, count: 1 });
    expect(out[6]).toEqual({ weekday: 6, count: 0 });
  });
  it('honours the window', () => {
    expect(
      fillWeekdayCounts([{ date: '2026-01-04', visits: 5 }], {
        from: '2026-10-01',
        to: '2026-10-31',
      })[0]!.count,
    ).toBe(0);
  });
});

describe('monthComparisonWindows', () => {
  it('compares month-to-date with the same day count of the previous month', () => {
    expect(monthComparisonWindows('2026-10-04')).toEqual({
      current: { from: '2026-10-01', to: '2026-10-04' },
      previous: { from: '2026-09-01', to: '2026-09-04' },
    });
  });
  it('clamps to the previous month length and crosses the year', () => {
    expect(monthComparisonWindows('2026-03-31').previous).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(monthComparisonWindows('2026-01-15').previous).toEqual({
      from: '2025-12-01',
      to: '2025-12-15',
    });
  });
  it('sumVisits is inclusive', () => {
    expect(
      sumVisits(
        [
          { date: '2026-10-01', visits: 1 },
          { date: '2026-10-04', visits: 2 },
          { date: '2026-10-05', visits: 4 },
        ],
        { from: '2026-10-01', to: '2026-10-04' },
      ),
    ).toBe(3);
  });
});

describe('membershipCountdown', () => {
  it('counts whole days left', () => {
    expect(membershipCountdown('2026-10-14', '2026-10-04')).toEqual({
      daysLeft: 10,
      expired: false,
    });
  });
  it('ending today is 0 days left but not expired', () => {
    expect(membershipCountdown('2026-10-04', '2026-10-04')).toEqual({
      daysLeft: 0,
      expired: false,
    });
  });
  it('clamps past end dates to 0 and flags expired', () => {
    expect(membershipCountdown('2026-10-01', '2026-10-04')).toEqual({ daysLeft: 0, expired: true });
  });
});

describe('progressPercent / weekStartMonday', () => {
  it('rounds and guards zero totals', () => {
    expect(progressPercent(1, 3)).toBe(33);
    expect(progressPercent(3, 3)).toBe(100);
    expect(progressPercent(0, 0)).toBe(0);
  });
  it('finds Monday of the week (Sunday belongs to the previous Monday)', () => {
    expect(weekStartMonday('2026-10-04')).toBe('2026-09-28');
    expect(weekStartMonday('2026-10-05')).toBe('2026-10-05');
    expect(weekStartMonday('2026-10-07')).toBe('2026-10-05');
  });
});

describe('public gym helpers', () => {
  it('flattens business hours Monday..Sunday and skips unset days', () => {
    const out = flattenBusinessHours({
      sunday: { closed: true },
      monday: { open: '06:00', close: '22:00', closed: false },
    });
    expect(out).toEqual([
      { day: 'monday', open: '06:00', close: '22:00', closed: false },
      { day: 'sunday', open: null, close: null, closed: true },
    ]);
    expect(flattenBusinessHours(null)).toBeNull();
    expect(flattenBusinessHours({})).toBeNull();
  });
  it('whitelists social links', () => {
    expect(
      pickSocialLinks({ facebook: 'https://f.com/x', secretToken: 'abc', instagram: '' }),
    ).toEqual({ facebook: 'https://f.com/x' });
    expect(pickSocialLinks(null)).toBeNull();
  });
});
