import { describe, expect, it } from 'vitest';

import { assembleLeadAnalytics, headlineBoundaries, last12Months, ratio, resolveLeadRanges, type LeadAnalyticsRaw } from './lead-analytics.util';

const NOW = new Date('2026-10-11T10:00:00Z');

describe('resolveLeadRanges (UTC)', () => {
  it('today / 7d / 30d / month / year', () => {
    expect(resolveLeadRanges('today', undefined, undefined, NOW).range).toEqual({ from: '2026-10-11', to: '2026-10-11' });
    expect(resolveLeadRanges('7d', undefined, undefined, NOW).range).toEqual({ from: '2026-10-05', to: '2026-10-11' });
    expect(resolveLeadRanges('30d', undefined, undefined, NOW).range).toEqual({ from: '2026-09-12', to: '2026-10-11' });
    expect(resolveLeadRanges('month', undefined, undefined, NOW).range).toEqual({ from: '2026-10-01', to: '2026-10-11' });
    expect(resolveLeadRanges('year', undefined, undefined, NOW).range).toEqual({ from: '2026-01-01', to: '2026-10-11' });
  });
  it('previous range is the preceding equal-length window', () => {
    expect(resolveLeadRanges('7d', undefined, undefined, NOW).previousRange).toEqual({ from: '2026-09-28', to: '2026-10-04' });
    expect(resolveLeadRanges('today', undefined, undefined, NOW).previousRange).toEqual({ from: '2026-10-10', to: '2026-10-10' });
    expect(resolveLeadRanges('custom', '2026-10-01', '2026-10-10', NOW).previousRange).toEqual({ from: '2026-09-21', to: '2026-09-30' });
  });
});

describe('helpers', () => {
  it('last12Months crosses year boundaries', () => {
    const m = last12Months(NOW);
    expect(m).toHaveLength(12);
    expect(m[0]).toBe('2025-11');
    expect(m[11]).toBe('2026-10');
  });
  it('headline boundaries', () => {
    const h = headlineBoundaries(new Date('2026-01-15T00:00:00Z'));
    expect(h.thisMonth.prevStart.toISOString()).toBe('2025-12-01T00:00:00.000Z');
    expect(h.today.prevStart.toISOString()).toBe('2026-01-14T00:00:00.000Z');
    expect(h.thisYear.prevStart.toISOString()).toBe('2025-01-01T00:00:00.000Z');
  });
  it('ratio guards zero and rounds to 4dp', () => {
    expect(ratio(1, 0)).toBe(0);
    expect(ratio(1, 3)).toBe(0.3333);
  });
});

function raw(over: Partial<LeadAnalyticsRaw> = {}): LeadAnalyticsRaw {
  const r = resolveLeadRanges('7d', undefined, undefined, NOW);
  return {
    range: r.range,
    previousRange: r.previousRange,
    createdDaily: [],
    convertedDaily: [],
    lostDaily: [],
    snapshot: { open: 0, dueToday: 0, overdue: 0 },
    headline: {
      today: { newLeads: 0, converted: 0, previousNewLeads: 0, previousConverted: 0 },
      thisMonth: { newLeads: 0, converted: 0, previousNewLeads: 0, previousConverted: 0 },
      thisYear: { newLeads: 0, converted: 0, previousNewLeads: 0, previousConverted: 0 },
    },
    monthly: [],
    funnelRows: [],
    funnelLost: 0,
    bySource: [],
    byStaff: [],
    byPlan: [],
    lostReasons: [],
    ageing: [],
    topBranches: [],
    now: NOW,
    ...over,
  };
}

describe('assembleLeadAnalytics', () => {
  it('returns zeros and zero-filled series for empty input', () => {
    const a = assembleLeadAnalytics(raw());
    expect(a.daily).toHaveLength(7);
    expect(a.daily.every((d) => d.newLeads === 0 && d.converted === 0 && d.lost === 0)).toBe(true);
    expect(a.monthly).toHaveLength(12);
    expect(a.kpis.conversionRate).toEqual({ value: 0, previous: 0 });
    expect(a.kpis.avgDaysToConvert).toEqual({ value: null, previous: null });
    expect(a.bySource).toHaveLength(7);
    expect(a.ageing.map((x) => x.bucket)).toEqual(['0-7', '8-14', '15-30', '31-60', '61+']);
    expect(a.funnel.stages.map((s) => s.count)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('computes KPIs for current vs previous range, conversion rate (cohort) and avgDaysToConvert', () => {
    const a = assembleLeadAnalytics(
      raw({
        createdDaily: [
          { date: '2026-10-06', count: 6, converted: 2 },
          { date: '2026-10-10', count: 2, converted: 0 },
          { date: '2026-09-30', count: 4, converted: 1 }, // previous range
        ],
        convertedDaily: [
          { date: '2026-10-08', count: 2, daysSum: 9 },
          { date: '2026-10-01', count: 1, daysSum: 2 }, // previous
          { date: '2026-08-01', count: 5, daysSum: 50 }, // outside both
        ],
        lostDaily: [{ date: '2026-10-09', count: 3 }],
        snapshot: { open: 11, dueToday: 2, overdue: 4 },
      }),
    );
    expect(a.kpis.newLeads).toEqual({ value: 8, previous: 4 });
    expect(a.kpis.converted).toEqual({ value: 2, previous: 1 });
    expect(a.kpis.lost).toEqual({ value: 3, previous: 0 });
    expect(a.kpis.conversionRate).toEqual({ value: 0.25, previous: 0.25 });
    expect(a.kpis.avgDaysToConvert).toEqual({ value: 4.5, previous: 2 });
    expect(a.kpis.open.value).toBe(11);
    expect(a.kpis.followUpsDueToday.value).toBe(2);
    expect(a.kpis.followUpsOverdue.value).toBe(4);
    const d = Object.fromEntries(a.daily.map((x) => [x.date, x]));
    expect(d['2026-10-06']!.newLeads).toBe(6);
    expect(d['2026-10-08']!.converted).toBe(2);
    expect(d['2026-10-09']!.lost).toBe(3);
    expect(a.daily[0]!.date).toBe('2026-10-05');
    expect(a.daily[6]!.date).toBe('2026-10-11');
  });

  it('builds the funnel with cumulative reach and stage-to-stage drop-off', () => {
    // furthest stage: 10 stayed NEW, 8 CONTACTED, 6 VISIT, 4 TRIAL, 2 NEGOTIATION, 3 CONVERTED  => total 33
    const a = assembleLeadAnalytics(
      raw({
        funnelRows: [
          { stage: 0, count: 10 },
          { stage: 1, count: 8 },
          { stage: 2, count: 6 },
          { stage: 3, count: 4 },
          { stage: 4, count: 2 },
          { stage: 5, count: 3 },
        ],
        funnelLost: 7,
      }),
    );
    expect(a.funnel.total).toBe(33);
    expect(a.funnel.stages.map((s) => [s.stage, s.count])).toEqual([
      ['NEW', 33],
      ['CONTACTED', 23],
      ['VISIT_SCHEDULED', 15],
      ['TRIAL_DONE', 9],
      ['NEGOTIATION', 5],
      ['CONVERTED', 3],
    ]);
    expect(a.funnel.stages[1]).toMatchObject({ dropOff: 10, dropOffRate: 0.303, pctOfTop: 0.697 });
    expect(a.funnel.stages[0]).toMatchObject({ dropOff: 0, dropOffRate: 0, pctOfTop: 1 });
    expect(a.funnel.stages[5]).toMatchObject({ dropOff: 2, dropOffRate: 0.4 });
    expect(a.funnel.lost).toBe(7);
  });

  it('groups by source / staff / plan with rates and sorting', () => {
    const a = assembleLeadAnalytics(
      raw({
        bySource: [
          { key: 'REFERRAL', leads: 4, converted: 2 },
          { key: 'WALK_IN', leads: 10, converted: 1 },
        ],
        byStaff: [
          { key: 'u1', name: 'Priya', leads: 3, converted: 3 },
          { key: null, name: null, leads: 5, converted: 0 },
        ],
        byPlan: [{ key: null, name: null, leads: 2, converted: 1 }],
        lostReasons: [
          { reason: 'NO_RESPONSE', count: 1 },
          { reason: 'PRICE_TOO_HIGH', count: 4 },
        ],
        ageing: [{ bucket: '15-30', count: 3 }],
        topBranches: Array.from({ length: 7 }, (_, i) => ({ key: `b${i}`, name: `B${i}`, leads: i + 1, converted: 0 })),
      }),
    );
    expect(a.bySource[0]).toEqual({ source: 'WALK_IN', leads: 10, converted: 1, conversionRate: 0.1 });
    expect(a.bySource[1]).toMatchObject({ source: 'REFERRAL', conversionRate: 0.5 });
    expect(a.bySource.at(-1)!.leads).toBe(0);
    expect(a.byStaff.map((s) => s.name)).toEqual(['Unassigned', 'Priya']);
    expect(a.byStaff[1]!.conversionRate).toBe(1);
    expect(a.byPlan[0]).toMatchObject({ planId: null, name: 'Not specified', conversionRate: 0.5 });
    expect(a.lostReasons).toEqual([
      { reason: 'PRICE_TOO_HIGH', count: 4 },
      { reason: 'NO_RESPONSE', count: 1 },
    ]);
    expect(a.ageing.find((x) => x.bucket === '15-30')!.count).toBe(3);
    expect(a.topBranches).toHaveLength(5);
    expect(a.topBranches[0]!.name).toBe('B6');
  });

  it('headline counters carry previous-period deltas; monthly zero-fills with cohort rate', () => {
    const a = assembleLeadAnalytics(
      raw({
        headline: {
          today: { newLeads: 3, converted: 1, previousNewLeads: 5, previousConverted: 0 },
          thisMonth: { newLeads: 20, converted: 4, previousNewLeads: 10, previousConverted: 4 },
          thisYear: { newLeads: 100, converted: 20, previousNewLeads: 0, previousConverted: 0 },
        },
        monthly: [{ month: '2026-09', newLeads: 8, converted: 2 }],
      }),
    );
    expect(a.headline.today).toMatchObject({ newLeadsDelta: -2, convertedDelta: 1 });
    expect(a.headline.thisMonth).toMatchObject({ newLeadsDelta: 10, convertedDelta: 0 });
    expect(a.monthly.find((m) => m.month === '2026-09')).toEqual({ month: '2026-09', newLeads: 8, converted: 2, conversionRate: 0.25 });
    expect(a.monthly.find((m) => m.month === '2026-10')).toEqual({ month: '2026-10', newLeads: 0, converted: 0, conversionRate: 0 });
  });
});
