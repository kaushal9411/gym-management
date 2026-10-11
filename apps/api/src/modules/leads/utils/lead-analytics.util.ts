import { addDaysStr, daysInclusive, type DateRange } from '../../finance/utils/payments-analytics.util';
import type { LeadAnalyticsDto } from '../dto/lead.dto';
import { LEAD_LOST_REASONS, LEAD_SOURCES } from '../validators/lead.validators';

import { FUNNEL_STAGES } from './lead-rules.util';

export type LeadRangeKey = 'today' | '7d' | '30d' | 'month' | 'year' | 'custom';

export const AGEING_BUCKETS = ['0-7', '8-14', '15-30', '31-60', '61+'] as const;

/** Resolves a named range (UTC days) and the preceding range of identical length. */
export function resolveLeadRanges(
  key: LeadRangeKey,
  dateFrom?: string,
  dateTo?: string,
  now: Date = new Date(),
): { range: DateRange; previousRange: DateRange; today: string } {
  const today = now.toISOString().slice(0, 10);
  let from = today;
  let to = today;
  switch (key) {
    case '7d':
      from = addDaysStr(today, -6);
      break;
    case '30d':
      from = addDaysStr(today, -29);
      break;
    case 'month':
      from = `${today.slice(0, 7)}-01`;
      break;
    case 'year':
      from = `${today.slice(0, 4)}-01-01`;
      break;
    case 'custom':
      from = dateFrom ?? today;
      to = dateTo ?? today;
      break;
    default:
      break;
  }
  const length = daysInclusive(from, to);
  const prevTo = addDaysStr(from, -1);
  return { range: { from, to }, previousRange: { from: addDaysStr(prevTo, -(length - 1)), to: prevTo }, today };
}

/** The 12 calendar months ending with the month of `now` (oldest first), as `YYYY-MM`. */
export function last12Months(now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

/** UTC boundaries for the today / this-month / this-year headline counters and the period before each. */
export function headlineBoundaries(now: Date = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const at = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm, dd));
  return {
    today: { start: at(y, m, d), end: at(y, m, d + 1), prevStart: at(y, m, d - 1), prevEnd: at(y, m, d) },
    thisMonth: { start: at(y, m, 1), end: at(y, m + 1, 1), prevStart: at(y, m - 1, 1), prevEnd: at(y, m, 1) },
    thisYear: { start: at(y, 0, 1), end: at(y + 1, 0, 1), prevStart: at(y - 1, 0, 1), prevEnd: at(y, 0, 1) },
  };
}

export const ratio = (num: number, den: number): number => (den > 0 ? Math.round((num / den) * 10_000) / 10_000 : 0);
const round1 = (n: number): number => Math.round(n * 10) / 10;

export interface LeadAnalyticsRaw {
  range: DateRange;
  previousRange: DateRange;
  /** created_at by UTC day across previousRange.from..range.to; `converted` = of those created that day, currently CONVERTED. */
  createdDaily: Array<{ date: string; count: number; converted: number }>;
  /** converted_at by UTC day; `daysSum` = Σ (converted_at − created_at) in days. */
  convertedDaily: Array<{ date: string; count: number; daysSum: number }>;
  lostDaily: Array<{ date: string; count: number }>;
  snapshot: { open: number; dueToday: number; overdue: number };
  headline: Record<'today' | 'thisMonth' | 'thisYear', { newLeads: number; converted: number; previousNewLeads: number; previousConverted: number }>;
  /** Cohort per creation month, any months in the trailing 12. */
  monthly: Array<{ month: string; newLeads: number; converted: number }>;
  /** Cohort created in range: count of leads whose furthest stage index (0..5) is `stage`. */
  funnelRows: Array<{ stage: number; count: number }>;
  funnelLost: number;
  bySource: Array<{ key: string; leads: number; converted: number }>;
  byStaff: Array<{ key: string | null; name: string | null; leads: number; converted: number }>;
  byPlan: Array<{ key: string | null; name: string | null; leads: number; converted: number }>;
  lostReasons: Array<{ reason: string; count: number }>;
  ageing: Array<{ bucket: string; count: number }>;
  topBranches: Array<{ key: string; name: string; leads: number; converted: number }>;
  /** Used for monthly zero-fill; defaults to now. */
  now?: Date;
}

const inRange = (d: string, r: DateRange): boolean => d >= r.from && d <= r.to;

/** Pure assembly of the grouped aggregates into the response contract — no I/O. */
export function assembleLeadAnalytics(raw: LeadAnalyticsRaw): LeadAnalyticsDto {
  const { range, previousRange } = raw;

  const cur = { created: 0, cohortConverted: 0, converted: 0, daysSum: 0, lost: 0 };
  const prev = { created: 0, cohortConverted: 0, converted: 0, daysSum: 0, lost: 0 };
  const bucketOf = (d: string) => (inRange(d, range) ? cur : inRange(d, previousRange) ? prev : null);
  for (const r of raw.createdDaily) {
    const b = bucketOf(r.date);
    if (!b) continue;
    b.created += r.count;
    b.cohortConverted += r.converted;
  }
  for (const r of raw.convertedDaily) {
    const b = bucketOf(r.date);
    if (!b) continue;
    b.converted += r.count;
    b.daysSum += r.daysSum;
  }
  for (const r of raw.lostDaily) {
    const b = bucketOf(r.date);
    if (b) b.lost += r.count;
  }

  const createdBy = new Map(raw.createdDaily.map((r) => [r.date, r.count]));
  const convertedBy = new Map(raw.convertedDaily.map((r) => [r.date, r.count]));
  const lostBy = new Map(raw.lostDaily.map((r) => [r.date, r.count]));
  const length = daysInclusive(range.from, range.to);
  const daily: LeadAnalyticsDto['daily'] = [];
  for (let i = 0; i < length; i += 1) {
    const date = addDaysStr(range.from, i);
    daily.push({ date, newLeads: createdBy.get(date) ?? 0, converted: convertedBy.get(date) ?? 0, lost: lostBy.get(date) ?? 0 });
  }

  const monthBy = new Map(raw.monthly.map((m) => [m.month, m]));
  const monthly = last12Months(raw.now).map((month) => {
    const m = monthBy.get(month);
    const newLeads = m?.newLeads ?? 0;
    const converted = m?.converted ?? 0;
    return { month, newLeads, converted, conversionRate: ratio(converted, newLeads) };
  });

  // Funnel: a lead "reached" stage i when its furthest stage index is >= i.
  const furthest = new Map(raw.funnelRows.map((r) => [r.stage, r.count]));
  const total = raw.funnelRows.reduce((s, r) => s + r.count, 0);
  const stages: LeadAnalyticsDto['funnel']['stages'] = [];
  let reachedAtOrBeyond = total;
  FUNNEL_STAGES.forEach((stage, i) => {
    if (i > 0) reachedAtOrBeyond -= furthest.get(i - 1) ?? 0;
    const previousCount = i === 0 ? reachedAtOrBeyond : stages[i - 1]!.count;
    const dropOff = i === 0 ? 0 : previousCount - reachedAtOrBeyond;
    stages.push({
      stage,
      count: reachedAtOrBeyond,
      pctOfTop: ratio(reachedAtOrBeyond, total),
      dropOff,
      dropOffRate: i === 0 ? 0 : ratio(dropOff, previousCount),
    });
  });

  const withRate = <T extends { leads: number; converted: number }>(rows: T[]) => rows.map((r) => ({ ...r, conversionRate: ratio(r.converted, r.leads) }));
  const sourceBy = new Map(raw.bySource.map((s) => [s.key, s]));
  const bySource = withRate(
    LEAD_SOURCES.map((source) => ({ source, leads: sourceBy.get(source)?.leads ?? 0, converted: sourceBy.get(source)?.converted ?? 0 })),
  ).sort((a, b) => b.leads - a.leads || a.source.localeCompare(b.source));

  const lostBy2 = new Map(raw.lostReasons.map((r) => [r.reason, r.count]));
  const ageingBy = new Map(raw.ageing.map((a) => [a.bucket, a.count]));

  return {
    range,
    previousRange,
    kpis: {
      newLeads: { value: cur.created, previous: prev.created },
      converted: { value: cur.converted, previous: prev.converted },
      lost: { value: cur.lost, previous: prev.lost },
      open: { value: raw.snapshot.open, previous: null },
      conversionRate: { value: ratio(cur.cohortConverted, cur.created), previous: ratio(prev.cohortConverted, prev.created) },
      avgDaysToConvert: {
        value: cur.converted > 0 ? round1(cur.daysSum / cur.converted) : null,
        previous: prev.converted > 0 ? round1(prev.daysSum / prev.converted) : null,
      },
      followUpsDueToday: { value: raw.snapshot.dueToday, previous: null },
      followUpsOverdue: { value: raw.snapshot.overdue, previous: null },
    },
    headline: Object.fromEntries(
      (['today', 'thisMonth', 'thisYear'] as const).map((k) => {
        const h = raw.headline[k];
        return [k, { ...h, newLeadsDelta: h.newLeads - h.previousNewLeads, convertedDelta: h.converted - h.previousConverted }];
      }),
    ) as LeadAnalyticsDto['headline'],
    daily,
    monthly,
    funnel: { stages, lost: raw.funnelLost, total },
    bySource,
    byStaff: withRate(raw.byStaff.map((s) => ({ userId: s.key, name: s.name ?? 'Unassigned', leads: s.leads, converted: s.converted }))).sort(
      (a, b) => b.leads - a.leads || a.name.localeCompare(b.name),
    ),
    byPlan: withRate(raw.byPlan.map((p) => ({ planId: p.key, name: p.name ?? 'Not specified', leads: p.leads, converted: p.converted }))).sort(
      (a, b) => b.leads - a.leads || a.name.localeCompare(b.name),
    ),
    lostReasons: [...LEAD_LOST_REASONS]
      .map((reason) => ({ reason: reason as string, count: lostBy2.get(reason) ?? 0 }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
    ageing: AGEING_BUCKETS.map((bucket) => ({ bucket: bucket as string, count: ageingBy.get(bucket) ?? 0 })),
    topBranches: withRate(raw.topBranches.map((b) => ({ branchId: b.key, name: b.name, leads: b.leads, converted: b.converted })))
      .sort((a, b) => b.leads - a.leads || a.name.localeCompare(b.name))
      .slice(0, 5),
  };
}
