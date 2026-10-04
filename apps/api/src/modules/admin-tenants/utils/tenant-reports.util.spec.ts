import { describe, expect, it } from 'vitest';

import { buildUsageRow, describeAdminAction, monthlyRecurring } from './tenant-detail.util';
import {
  adoptionShare,
  buildHeatmap,
  buildMethodShares,
  buildRetentionCohorts,
  churnRiskLabel,
  dayKeys,
  monthKeys,
  projectMonthsTo80,
  resolveReportRange,
  toMoney,
  weekKeys,
  zeroFillMonths,
} from './tenant-reports.util';

const NOW = new Date('2026-10-04T12:00:00Z');

describe('ranges and series', () => {
  it('resolves equal-length previous range', () => {
    const r = resolveReportRange('30d', NOW);
    expect(r.to.getTime() - r.from.getTime()).toBe(30 * 86_400_000);
    expect(r.prevTo).toEqual(r.from);
    expect(r.from.getTime() - r.prevFrom.getTime()).toBe(30 * 86_400_000);
    expect(resolveReportRange('12m', NOW).days).toBe(365);
  });
  it('monthKeys spans year boundaries', () => {
    expect(monthKeys(new Date('2026-02-10T00:00:00Z'), 4)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });
  it('zeroFillMonths fills gaps', () => {
    const rows = zeroFillMonths(['2026-08', '2026-09'], [{ month: '2026-09', n: 3 }], (month) => ({
      month,
      n: 0,
    }));
    expect(rows).toEqual([
      { month: '2026-08', n: 0 },
      { month: '2026-09', n: 3 },
    ]);
  });
  it('weekKeys are Mondays; dayKeys end today', () => {
    const w = weekKeys(NOW, 3); // 2026-10-04 is a Sunday -> Monday 2026-09-28
    expect(w).toEqual(['2026-09-14', '2026-09-21', '2026-09-28']);
    const d = dayKeys(NOW, 3);
    expect(d).toEqual(['2026-10-02', '2026-10-03', '2026-10-04']);
  });
  it('toMoney', () => {
    expect(toMoney('12.5')).toBe('12.50');
    expect(toMoney(null)).toBe('0.00');
  });
});

describe('heatmap, adoption, methods', () => {
  it('heatmap is dense 168 cells and ignores out-of-range rows', () => {
    const h = buildHeatmap([
      { weekday: 0, hour: 17, count: 4 },
      { weekday: 0, hour: 17, count: 1 },
      { weekday: 9, hour: 1, count: 5 },
    ]);
    expect(h).toHaveLength(168);
    expect(h.find((c) => c.weekday === 0 && c.hour === 17)!.count).toBe(5);
    expect(h.reduce((s, c) => s + c.count, 0)).toBe(5);
  });
  it('adoption share', () => {
    expect(adoptionShare(59, 118)).toBe(50);
    expect(adoptionShare(5, 0)).toBe(0);
    expect(adoptionShare(500, 100)).toBe(100);
  });
  it('method shares', () => {
    expect(
      buildMethodShares([
        { method: 'UPI', amount: 75 },
        { method: 'CARD', amount: 25 },
      ]),
    ).toEqual([
      { method: 'UPI', share: 75 },
      { method: 'CARD', share: 25 },
    ]);
    expect(buildMethodShares([])).toEqual([]);
  });
});

describe('retention cohorts', () => {
  it('M0 = 100, later months %, future months null', () => {
    const out = buildRetentionCohorts(
      ['2026-08', '2026-09'],
      [
        { cohort: '2026-08', k: 0, size: 10, active: 10 },
        { cohort: '2026-08', k: 1, size: 10, active: 8 },
        { cohort: '2026-08', k: 2, size: 10, active: 5 },
        { cohort: '2026-09', k: 0, size: 4, active: 4 },
        { cohort: '2026-09', k: 1, size: 4, active: 3 },
      ],
    );
    expect(out[0]!.values).toEqual([100, 80, 50, null, null, null]);
    expect(out[1]!.values).toEqual([100, 75, null, null, null, null]);
  });
  it('empty cohort stays null', () => {
    expect(buildRetentionCohorts(['2026-05'], [])[0]!.values.every((v) => v === null)).toBe(true);
  });
});

describe('projection', () => {
  it('extrapolates the average gain', () => {
    expect(projectMonthsTo80([100, 140, 180, 220], 500)).toBe(5); // target 400, +40/mo -> (400-220)/40 = 4.5 -> 5
  });
  it('0 when already past 80%, null when flat or no limit', () => {
    expect(projectMonthsTo80([390, 410], 500)).toBe(0);
    expect(projectMonthsTo80([100, 100, 100], 500)).toBeNull();
    expect(projectMonthsTo80([100, 200], null)).toBeNull();
    expect(projectMonthsTo80([50], 500)).toBeNull();
  });
  it('churn label thresholds', () => {
    expect(churnRiskLabel(80)).toBe('Low');
    expect(churnRiskLabel(60)).toBe('Medium');
    expect(churnRiskLabel(10)).toBe('High');
  });
});

describe('usage + timeline', () => {
  it('usage pct', () => {
    expect(buildUsageRow('members', 'Members', 142, 500, false).pct).toBe(28);
    expect(buildUsageRow('storage', 'Storage', null, 10, false).pct).toBeNull();
    expect(buildUsageRow('x', 'X', 5, 0, false).pct).toBeNull();
  });
  it('MRR only for ACTIVE, yearly /12', () => {
    expect(
      monthlyRecurring({
        status: 'ACTIVE',
        billingCycle: 'YEARLY',
        priceMonthly: 100,
        priceYearly: 1200,
      }),
    ).toBe(100);
    expect(
      monthlyRecurring({
        status: 'TRIALING',
        billingCycle: 'MONTHLY',
        priceMonthly: 100,
        priceYearly: 1200,
      }),
    ).toBeNull();
    expect(monthlyRecurring(null)).toBeNull();
  });
  it('describes audit actions', () => {
    expect(describeAdminAction('admin.tenant_module_toggled').family).toBe('modules');
    expect(describeAdminAction('admin.payment_verified')).toEqual({
      text: 'payment verified',
      family: 'billing',
    });
  });
});
