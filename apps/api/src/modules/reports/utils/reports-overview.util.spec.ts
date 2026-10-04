import { describe, expect, it } from 'vitest';

import { overviewQuerySchema } from '../validators/reports.validators';

import {
  assembleOverview,
  bucketExpiring,
  bucketHours,
  bucketWeekdays,
  expiringBucketIndex,
  isChurnedInRange,
  progressBucketIndex,
  resolveRanges,
  type OverviewRaw,
} from './reports-overview.util';

describe('previous-range alignment (reused finance resolveRanges)', () => {
  it('defaults to month-to-date with an equal-length preceding range', () => {
    const r = resolveRanges(undefined, undefined, new Date('2026-10-03T10:00:00Z'));
    expect(r.range).toEqual({ from: '2026-10-01', to: '2026-10-03' });
    expect(r.previousRange).toEqual({ from: '2026-09-28', to: '2026-09-30' });
  });
});

describe('overviewQuerySchema', () => {
  it('rejects an inverted range', () => {
    expect(
      overviewQuerySchema.safeParse({ dateFrom: '2026-10-05', dateTo: '2026-10-01' }).success,
    ).toBe(false);
  });
  it('rejects ranges over 366 days', () => {
    expect(
      overviewQuerySchema.safeParse({ dateFrom: '2024-01-01', dateTo: '2026-01-01' }).success,
    ).toBe(false);
  });
  it('accepts an empty query and a valid range', () => {
    expect(overviewQuerySchema.safeParse({}).success).toBe(true);
    expect(
      overviewQuerySchema.safeParse({ dateFrom: '2026-10-01', dateTo: '2026-10-03' }).success,
    ).toBe(true);
  });
});

describe('bucketWeekdays', () => {
  it('always returns 7 rows and splits current vs previous by UTC weekday', () => {
    // 2026-10-04 is a Sunday, 2026-09-27 is a Sunday, 2026-10-05 a Monday.
    const rows = bucketWeekdays(
      [
        { date: '2026-10-04', count: 3 },
        { date: '2026-10-05', count: 2 },
        { date: '2026-09-27', count: 4 },
      ],
      { from: '2026-10-04', to: '2026-10-05' },
      { from: '2026-09-27', to: '2026-09-28' },
    );
    expect(rows).toHaveLength(7);
    expect(rows[0]).toEqual({ weekday: 0, count: 3, previousCount: 4 });
    expect(rows[1]).toEqual({ weekday: 1, count: 2, previousCount: 0 });
  });
});

describe('bucketHours', () => {
  it('always returns 24 rows and ignores invalid hours', () => {
    const rows = bucketHours([
      { hour: 6, count: 5 },
      { hour: 6, count: 1 },
      { hour: 30, count: 9 },
    ]);
    expect(rows).toHaveLength(24);
    expect(rows[6]).toEqual({ hour: 6, count: 6 });
    expect(rows.reduce((s, r) => s + r.count, 0)).toBe(6);
  });
});

describe('expiring buckets', () => {
  it('maps days-remaining to the three windows', () => {
    expect([0, 7, 8, 14, 15, 30].map(expiringBucketIndex)).toEqual([0, 0, 1, 1, 2, 2]);
    expect(expiringBucketIndex(-1)).toBeNull();
    expect(expiringBucketIndex(31)).toBeNull();
  });
  it('buckets end dates relative to today with exact labels', () => {
    const out = bucketExpiring(
      [
        { date: '2026-10-04', count: 1 },
        { date: '2026-10-12', count: 2 },
        { date: '2026-10-20', count: 3 },
        { date: '2026-11-20', count: 9 },
      ],
      '2026-10-04',
    );
    expect(out).toEqual([
      { label: '0-7d', count: 1 },
      { label: '8-14d', count: 2 },
      { label: '15-30d', count: 3 },
    ]);
  });
});

describe('progressBucketIndex', () => {
  it('uses 0-25 / 26-50 / 51-75 / 76-100 boundaries', () => {
    expect([0, 25, 26, 50, 51, 75, 76, 100].map(progressBucketIndex)).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3,
    ]);
  });
});

describe('isChurnedInRange', () => {
  const range = { from: '2026-10-01', to: '2026-10-10' };
  it('counts EXPIRED by endDate and CANCELLED by cancel (update) date', () => {
    expect(
      isChurnedInRange(
        { status: 'EXPIRED', endDate: '2026-10-05', updatedAt: '2026-12-01T00:00:00Z' },
        range,
      ),
    ).toBe(true);
    expect(
      isChurnedInRange(
        { status: 'EXPIRED', endDate: '2026-09-30', updatedAt: '2026-10-05T00:00:00Z' },
        range,
      ),
    ).toBe(false);
    expect(
      isChurnedInRange(
        { status: 'CANCELLED', endDate: '2027-01-01', updatedAt: '2026-10-10T23:59:59Z' },
        range,
      ),
    ).toBe(true);
    expect(
      isChurnedInRange(
        { status: 'CANCELLED', endDate: '2026-10-05', updatedAt: '2026-10-11T00:00:00Z' },
        range,
      ),
    ).toBe(false);
  });
  it('ignores ACTIVE / SUPERSEDED memberships', () => {
    expect(
      isChurnedInRange(
        { status: 'ACTIVE', endDate: '2026-10-05', updatedAt: '2026-10-05T00:00:00Z' },
        range,
      ),
    ).toBe(false);
    expect(
      isChurnedInRange(
        { status: 'SUPERSEDED', endDate: '2026-10-05', updatedAt: '2026-10-05T00:00:00Z' },
        range,
      ),
    ).toBe(false);
  });
});

describe('assembleOverview', () => {
  const raw: OverviewRaw = {
    range: { from: '2026-10-01', to: '2026-10-03' },
    previousRange: { from: '2026-09-28', to: '2026-09-30' },
    today: '2026-10-03',
    revenueByDay: [
      { date: '2026-10-01', amount: 1000 },
      { date: '2026-09-29', amount: 400 },
    ],
    expensesByDay: [{ date: '2026-10-02', amount: 250.5 }],
    attendanceByDay: [
      { date: '2026-10-01', count: 6 },
      { date: '2026-10-03', count: 3 },
      { date: '2026-09-28', count: 5 },
    ],
    newMembersByDay: [{ date: '2026-10-02', count: 2 }],
    activeMembers: 40,
    expiringByEndDate: [{ date: '2026-10-05', count: 4 }],
    churned: { value: 1, previous: 2 },
    memberStatus: [{ status: 'ACTIVE', count: 40 }],
    plans: Array.from({ length: 8 }, (_, i) => ({
      planName: `P${i}`,
      activeCount: i,
      revenue: i * 10,
    })),
    methods: [{ method: 'CASH', amount: 1000, count: 2 }],
    branches: [
      {
        branchId: 'a',
        name: 'A',
        revenue: 10,
        previousRevenue: 0,
        newMembers: 1,
        checkIns: 1,
        activeMembers: 1,
      },
      {
        branchId: 'b',
        name: 'B',
        revenue: 500,
        previousRevenue: 5,
        newMembers: 0,
        checkIns: 2,
        activeMembers: 3,
      },
    ],
    hourly: [{ hour: 7, count: 9 }],
    topTrainers: Array.from({ length: 7 }, (_, i) => ({
      trainerId: `t${i}`,
      name: `T${i}`,
      assignedMembers: i,
    })),
  };
  const out = assembleOverview(raw);

  it('computes KPIs with previous values and money strings', () => {
    expect(out.kpis.revenue).toEqual({ value: '1000.00', previous: '400.00' });
    expect(out.kpis.netProfit).toEqual({ value: '749.50', previous: '400.00' });
    expect(out.kpis.checkIns).toEqual({ value: 9, previous: 5 });
    expect(out.kpis.avgDailyCheckIns).toEqual({ value: 3, previous: 1.67 });
    expect(out.kpis.expiringIn30d.value).toBe(4);
  });

  it('zero-fills one daily row per day with prev* aligned by index', () => {
    expect(out.daily.map((d) => d.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(out.daily[0]).toMatchObject({
      revenue: '1000.00',
      prevCheckIns: 5,
      prevRevenue: '0.00',
    });
    expect(out.daily[1]).toMatchObject({
      expenses: '250.50',
      newMembers: 2,
      prevRevenue: '400.00',
    });
  });

  it('has fixed-size distributions, all statuses, top-N limits and sorted branches', () => {
    expect(out.weekdayAttendance).toHaveLength(7);
    expect(out.hourlyAttendance).toHaveLength(24);
    expect(out.memberStatus.map((s) => s.status)).toEqual(['ACTIVE', 'INACTIVE', 'FROZEN']);
    expect(out.planDistribution).toHaveLength(6);
    expect(out.planDistribution[0]?.planName).toBe('P7');
    expect(out.topTrainers).toHaveLength(5);
    expect(out.branches.map((b) => b.branchId)).toEqual(['b', 'a']);
    expect(out.expiringBuckets.map((b) => b.label)).toEqual(['0-7d', '8-14d', '15-30d']);
  });
});
