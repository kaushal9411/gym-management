import { describe, expect, it } from 'vitest';

import {
  reportSummaryParamSchema,
  reportSummaryQuerySchema,
} from '../validators/reports.validators';

import {
  activeVsInactiveSummary,
  attendanceSummary,
  branchPerformanceSummary,
  buildDailySeries,
  expensesSummary,
  expiringMembershipsSummary,
  memberProgressSummary,
  membershipSummary,
  paymentsSummary,
  revenueSummary,
  staffSummary,
  SUMMARY_REPORT_TYPES,
  trainerPerformanceSummary,
} from './report-summary.util';

const range = { from: '2026-10-01', to: '2026-10-03' };
const previousRange = { from: '2026-09-28', to: '2026-09-30' };
const byDay = new Map([
  ['2026-10-01', 5],
  ['2026-09-29', 2],
]);
const totals = { total: 10, previousTotal: 4 };

describe('summary param/query validation', () => {
  it('covers exactly the 11 tabular types and rejects analytics/unknown types', () => {
    expect(SUMMARY_REPORT_TYPES).toHaveLength(11);
    expect(reportSummaryParamSchema.safeParse({ reportType: 'revenue' }).success).toBe(true);
    expect(reportSummaryParamSchema.safeParse({ reportType: 'analytics-retention' }).success).toBe(
      false,
    );
    expect(reportSummaryParamSchema.safeParse({ reportType: 'nope' }).success).toBe(false);
  });
  it('rejects inverted ranges', () => {
    expect(
      reportSummaryQuerySchema.safeParse({ dateFrom: '2026-10-05', dateTo: '2026-10-01' }).success,
    ).toBe(false);
  });
});

describe('buildDailySeries', () => {
  it('zero-fills and aligns previous by index', () => {
    const s = buildDailySeries('t', range, previousRange, byDay);
    expect(s.points).toEqual([
      { date: '2026-10-01', value: 5, previous: 0 },
      { date: '2026-10-02', value: 0, previous: 2 },
      { date: '2026-10-03', value: 0, previous: 0 },
    ]);
  });
});

describe('per-type summary shapes', () => {
  it('membership', () => {
    const s = membershipSummary({
      byStatus: [
        { label: 'ACTIVE', value: 3 },
        { label: 'FROZEN', value: 1 },
      ],
      byPlan: [{ label: 'Gold', value: 2 }],
    });
    expect(s.kpis[0]).toMatchObject({ key: 'total', value: 4, format: 'number' });
    expect(s.breakdowns.map((b) => b.kind)).toEqual(['donut', 'bar']);
    expect(s.series).toBeNull();
  });
  it('attendance', () => {
    const s = attendanceSummary({
      range,
      previousRange,
      checkIns: totals,
      unique: { total: 4, previousTotal: 2 },
      byMethod: [{ label: 'QR', value: 7 }],
      byDay,
    });
    expect(s.kpis.map((k) => k.key)).toEqual(['check-ins', 'unique-members', 'avg-per-day']);
    expect(s.kpis[2]).toMatchObject({ value: 3.33, previous: 1.33 });
    expect(s.series?.points).toHaveLength(3);
  });
  it('revenue', () => {
    const s = revenueSummary({
      range,
      previousRange,
      amount: { total: 1000, previousTotal: 0 },
      count: totals,
      byMethod: [{ label: 'CASH', value: 1000 }],
      byDay,
    });
    expect(s.kpis[0]).toMatchObject({ value: '1000.00', previous: '0.00', format: 'money' });
    expect(s.kpis[2]).toMatchObject({ value: '100.00', previous: '0.00' });
  });
  it('expenses', () => {
    const s = expensesSummary({
      range,
      previousRange,
      amount: { total: 90, previousTotal: 30 },
      count: { total: 3, previousTotal: 1 },
      byCategory: [{ label: 'RENT', value: 90 }],
      byDay,
    });
    expect(s.breakdowns[0]).toMatchObject({ kind: 'bar' });
    expect(s.kpis[2]?.value).toBe('30.00');
  });
  it('payments computes success rate and drops zero items', () => {
    const s = paymentsSummary({
      range,
      previousRange,
      collected: { total: 500, previousTotal: 0 },
      attempts: { total: 4, previousTotal: 0 },
      successful: { total: 3, previousTotal: 0 },
      byStatus: [
        { label: 'SUCCESS', value: 3 },
        { label: 'FAILED', value: 1 },
        { label: 'PENDING', value: 0 },
      ],
      byMethod: [{ label: 'UPI', value: 500 }],
      byDay,
    });
    expect(s.kpis[2]).toMatchObject({ value: 0.75, previous: 0, format: 'percent' });
    expect(s.breakdowns[0]?.items).toHaveLength(2);
    expect(s.breakdowns.map((b) => b.kind)).toEqual(['donut', 'donut']);
  });
  it('staff', () => {
    const s = staffSummary({
      byRole: [{ label: 'TRAINER', value: 2 }],
      byStatus: [{ label: 'ACTIVE', value: 2 }],
    });
    expect(s.kpis[0]?.value).toBe(2);
    expect(s.breakdowns.map((b) => b.kind)).toEqual(['bar', 'donut']);
  });
  it('trainer-performance', () => {
    const s = trainerPerformanceSummary([
      { name: 'A', assignedMembers: 4 },
      { name: 'B', assignedMembers: 1 },
    ]);
    expect(s.kpis.map((k) => k.value)).toEqual([2, 5, 2.5]);
    expect(trainerPerformanceSummary([]).kpis[2]?.value).toBe(0);
  });
  it('member-progress buckets and averages', () => {
    const s = memberProgressSummary([
      { workoutPercent: 10, dietPercent: 100 },
      { workoutPercent: 60, dietPercent: null },
      { workoutPercent: null, dietPercent: 0 },
      { workoutPercent: 100, dietPercent: 0 },
    ]);
    expect(s.breakdowns[0]?.items).toEqual([
      { label: '0-25', value: 1 },
      { label: '26-50', value: 0 },
      { label: '51-75', value: 1 },
      { label: '76-100', value: 1 },
    ]);
    expect(s.kpis[1]?.value).toBe(56.67);
    expect(s.kpis[2]?.value).toBe(33.33);
  });
  it('branch-performance', () => {
    const s = branchPerformanceSummary([
      { branch: 'A', totalMembers: 3, monthlyRevenue: '10.50' },
      { branch: 'B', totalMembers: 2, monthlyRevenue: '4.50' },
    ]);
    expect(s.kpis.map((k) => k.value)).toEqual([2, '15.00', 5]);
  });
  it('expiring-memberships', () => {
    const s = expiringMembershipsSummary({
      today: '2026-10-04',
      byEndDate: [
        { date: '2026-10-06', count: 2 },
        { date: '2026-10-25', count: 1 },
      ],
      byPlan: [{ label: 'Gold', value: 3 }],
    });
    expect(s.kpis[0]?.value).toBe(3);
    expect(s.breakdowns[0]?.items.map((i) => i.value)).toEqual([2, 0, 1]);
  });
  it('active-vs-inactive', () => {
    const s = activeVsInactiveSummary([
      { status: 'ACTIVE', count: 5 },
      { status: 'INACTIVE', count: 2 },
    ]);
    expect(s.kpis[0]?.value).toBe(7);
    expect(s.breakdowns[0]?.kind).toBe('donut');
  });
});
