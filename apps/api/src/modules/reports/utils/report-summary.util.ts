import { REPORT_TYPES } from '../dto/reports.dto';

import {
  addDaysStr,
  bucketExpiring,
  daysInclusive,
  money,
  PROGRESS_BUCKET_LABELS,
  progressBucketIndex,
  type DateRange,
  type DayCount,
} from './reports-overview.util';

/** The 11 tabular report types that have a summary (the first 11 entries of REPORT_TYPES). */
export const SUMMARY_REPORT_TYPES = REPORT_TYPES.slice(0, 11) as unknown as readonly [
  SummaryReportType,
  ...SummaryReportType[],
];
export type SummaryReportType =
  | 'membership'
  | 'attendance'
  | 'revenue'
  | 'expenses'
  | 'payments'
  | 'staff'
  | 'trainer-performance'
  | 'member-progress'
  | 'branch-performance'
  | 'expiring-memberships'
  | 'active-vs-inactive';

export type SummaryFormat = 'number' | 'money' | 'percent' | 'text';
export interface SummaryKpi {
  key: string;
  label: string;
  value: string | number;
  format: SummaryFormat;
  previous?: string | number;
}
export interface SummaryItem {
  label: string;
  value: number;
  previous?: number;
}
export interface SummaryBreakdown {
  key: string;
  title: string;
  kind: 'donut' | 'bar';
  items: SummaryItem[];
}
export interface SummarySeries {
  title: string;
  points: Array<{ date: string; value: number; previous?: number }>;
}
export interface ReportSummaryBody {
  kpis: SummaryKpi[];
  breakdowns: SummaryBreakdown[];
  series: SummarySeries | null;
}
export interface ReportSummaryDto extends ReportSummaryBody {
  range: DateRange;
  previousRange: DateRange;
}

const ratio = (n: number, d: number): number => (d > 0 ? n / d : 0);
const round2 = (n: number): number => Math.round(n * 100) / 100;
const items = (rows: Array<{ label: string; value: number }>): SummaryItem[] =>
  rows.filter((r) => r.value > 0);
const sum = (rows: Array<{ value: number }>): number => rows.reduce((s, r) => s + r.value, 0);

/** Zero-filled daily series over `range`, `previous` aligned by index to `previousRange` (same shape as the overview's daily rows). */
export function buildDailySeries(
  title: string,
  range: DateRange,
  previousRange: DateRange,
  byDay: Map<string, number>,
): SummarySeries {
  const length = daysInclusive(range.from, range.to);
  return {
    title,
    points: Array.from({ length }, (_, i) => ({
      date: addDaysStr(range.from, i),
      value: byDay.get(addDaysStr(range.from, i)) ?? 0,
      previous: byDay.get(addDaysStr(previousRange.from, i)) ?? 0,
    })),
  };
}

export const toDayMap = (rows: Array<{ date: string; value: number }>): Map<string, number> =>
  new Map(rows.map((r) => [r.date, r.value]));

export interface LabelValue {
  label: string;
  value: number;
}

export function membershipSummary(d: {
  byStatus: LabelValue[];
  byPlan: LabelValue[];
}): ReportSummaryBody {
  return {
    kpis: [{ key: 'total', label: 'Total members', value: sum(d.byStatus), format: 'number' }],
    breakdowns: [
      { key: 'by-status', title: 'Members by status', kind: 'donut', items: items(d.byStatus) },
      { key: 'by-plan', title: 'Active memberships by plan', kind: 'bar', items: items(d.byPlan) },
    ],
    series: null,
  };
}

export interface RangeTotals {
  total: number;
  previousTotal: number;
}

export function attendanceSummary(d: {
  range: DateRange;
  previousRange: DateRange;
  checkIns: RangeTotals;
  unique: RangeTotals;
  byMethod: LabelValue[];
  byDay: Map<string, number>;
}): ReportSummaryBody {
  const days = daysInclusive(d.range.from, d.range.to);
  return {
    kpis: [
      {
        key: 'check-ins',
        label: 'Total check-ins',
        value: d.checkIns.total,
        previous: d.checkIns.previousTotal,
        format: 'number',
      },
      {
        key: 'unique-members',
        label: 'Unique members',
        value: d.unique.total,
        previous: d.unique.previousTotal,
        format: 'number',
      },
      {
        key: 'avg-per-day',
        label: 'Avg check-ins / day',
        value: round2(d.checkIns.total / days),
        previous: round2(d.checkIns.previousTotal / days),
        format: 'number',
      },
    ],
    breakdowns: [
      { key: 'by-method', title: 'Check-ins by method', kind: 'donut', items: items(d.byMethod) },
    ],
    series: buildDailySeries('Daily check-ins', d.range, d.previousRange, d.byDay),
  };
}

export function revenueSummary(d: {
  range: DateRange;
  previousRange: DateRange;
  amount: RangeTotals;
  count: RangeTotals;
  byMethod: LabelValue[];
  byDay: Map<string, number>;
}): ReportSummaryBody {
  return {
    kpis: [
      {
        key: 'total',
        label: 'Total revenue',
        value: money(d.amount.total),
        previous: money(d.amount.previousTotal),
        format: 'money',
      },
      {
        key: 'payments',
        label: 'Payments',
        value: d.count.total,
        previous: d.count.previousTotal,
        format: 'number',
      },
      {
        key: 'average',
        label: 'Average payment',
        value: money(ratio(d.amount.total, d.count.total)),
        previous: money(ratio(d.amount.previousTotal, d.count.previousTotal)),
        format: 'money',
      },
    ],
    breakdowns: [
      { key: 'by-method', title: 'Revenue by method', kind: 'donut', items: items(d.byMethod) },
    ],
    series: buildDailySeries('Daily revenue', d.range, d.previousRange, d.byDay),
  };
}

export function expensesSummary(d: {
  range: DateRange;
  previousRange: DateRange;
  amount: RangeTotals;
  count: RangeTotals;
  byCategory: LabelValue[];
  byDay: Map<string, number>;
}): ReportSummaryBody {
  return {
    kpis: [
      {
        key: 'total',
        label: 'Total expenses',
        value: money(d.amount.total),
        previous: money(d.amount.previousTotal),
        format: 'money',
      },
      {
        key: 'count',
        label: 'Expense entries',
        value: d.count.total,
        previous: d.count.previousTotal,
        format: 'number',
      },
      {
        key: 'average',
        label: 'Average expense',
        value: money(ratio(d.amount.total, d.count.total)),
        previous: money(ratio(d.amount.previousTotal, d.count.previousTotal)),
        format: 'money',
      },
    ],
    breakdowns: [
      {
        key: 'by-category',
        title: 'Expenses by category',
        kind: 'bar',
        items: items(d.byCategory),
      },
    ],
    series: buildDailySeries('Daily expenses', d.range, d.previousRange, d.byDay),
  };
}

export function paymentsSummary(d: {
  range: DateRange;
  previousRange: DateRange;
  collected: RangeTotals;
  attempts: RangeTotals;
  successful: RangeTotals;
  byStatus: LabelValue[];
  byMethod: LabelValue[];
  byDay: Map<string, number>;
}): ReportSummaryBody {
  return {
    kpis: [
      {
        key: 'collected',
        label: 'Total collected',
        value: money(d.collected.total),
        previous: money(d.collected.previousTotal),
        format: 'money',
      },
      {
        key: 'count',
        label: 'Payments',
        value: d.attempts.total,
        previous: d.attempts.previousTotal,
        format: 'number',
      },
      {
        key: 'success-rate',
        label: 'Success rate',
        value: ratio(d.successful.total, d.attempts.total),
        previous: ratio(d.successful.previousTotal, d.attempts.previousTotal),
        format: 'percent',
      },
    ],
    breakdowns: [
      { key: 'by-status', title: 'Payments by status', kind: 'donut', items: items(d.byStatus) },
      { key: 'by-method', title: 'Collected by method', kind: 'donut', items: items(d.byMethod) },
    ],
    series: buildDailySeries('Daily collected', d.range, d.previousRange, d.byDay),
  };
}

export function staffSummary(d: {
  byRole: LabelValue[];
  byStatus: LabelValue[];
}): ReportSummaryBody {
  return {
    kpis: [{ key: 'total', label: 'Total staff', value: sum(d.byStatus), format: 'number' }],
    breakdowns: [
      { key: 'by-role', title: 'Staff by role', kind: 'bar', items: items(d.byRole) },
      { key: 'by-status', title: 'Staff by status', kind: 'donut', items: items(d.byStatus) },
    ],
    series: null,
  };
}

export function trainerPerformanceSummary(
  trainers: Array<{ name: string; assignedMembers: number }>,
): ReportSummaryBody {
  const total = trainers.reduce((s, t) => s + t.assignedMembers, 0);
  return {
    kpis: [
      { key: 'trainers', label: 'Trainers', value: trainers.length, format: 'number' },
      { key: 'assigned', label: 'Assigned members', value: total, format: 'number' },
      {
        key: 'avg',
        label: 'Avg members / trainer',
        value: round2(ratio(total, trainers.length)),
        format: 'number',
      },
    ],
    breakdowns: [
      {
        key: 'assigned-per-trainer',
        title: 'Assigned members per trainer',
        kind: 'bar',
        items: trainers.map((t) => ({ label: t.name, value: t.assignedMembers })),
      },
    ],
    series: null,
  };
}

/** Percentages are 0-100 or null when the member has no active plan of that kind. Buckets count members by workout progress. */
export function memberProgressSummary(
  rows: Array<{ workoutPercent: number | null; dietPercent: number | null }>,
): ReportSummaryBody {
  const avg = (vals: Array<number | null>) => {
    const real = vals.filter((v): v is number => v !== null);
    return round2(
      ratio(
        real.reduce((s, v) => s + v, 0),
        real.length,
      ),
    );
  };
  const buckets = PROGRESS_BUCKET_LABELS.map((label) => ({ label, value: 0 }));
  for (const r of rows) {
    const bucket =
      r.workoutPercent === null ? undefined : buckets[progressBucketIndex(r.workoutPercent)];
    if (bucket) bucket.value += 1;
  }
  return {
    kpis: [
      { key: 'members', label: 'Members', value: rows.length, format: 'number' },
      {
        key: 'avg-workout',
        label: 'Avg workout progress',
        value: avg(rows.map((r) => r.workoutPercent)),
        format: 'percent',
      },
      {
        key: 'avg-diet',
        label: 'Avg diet progress',
        value: avg(rows.map((r) => r.dietPercent)),
        format: 'percent',
      },
    ],
    breakdowns: [
      {
        key: 'workout-buckets',
        title: 'Members by workout progress %',
        kind: 'bar',
        items: buckets,
      },
    ],
    series: null,
  };
}

export function branchPerformanceSummary(
  branches: Array<{ branch: string; totalMembers: number; monthlyRevenue: string }>,
): ReportSummaryBody {
  const revenue = branches.reduce((s, b) => s + Number(b.monthlyRevenue), 0);
  return {
    kpis: [
      { key: 'branches', label: 'Branches', value: branches.length, format: 'number' },
      { key: 'revenue', label: 'Total revenue', value: money(revenue), format: 'money' },
      {
        key: 'members',
        label: 'Total members',
        value: branches.reduce((s, b) => s + b.totalMembers, 0),
        format: 'number',
      },
    ],
    breakdowns: [
      {
        key: 'revenue-per-branch',
        title: 'Revenue per branch',
        kind: 'bar',
        items: branches.map((b) => ({ label: b.branch, value: Number(b.monthlyRevenue) })),
      },
    ],
    series: null,
  };
}

export function expiringMembershipsSummary(d: {
  today: string;
  byEndDate: DayCount[];
  byPlan: LabelValue[];
}): ReportSummaryBody {
  const buckets = bucketExpiring(d.byEndDate, d.today);
  return {
    kpis: [
      {
        key: 'total',
        label: 'Expiring in 30 days',
        value: sum(buckets.map((b) => ({ value: b.count }))),
        format: 'number',
      },
    ],
    breakdowns: [
      {
        key: 'by-window',
        title: 'Expiring by window',
        kind: 'bar',
        items: buckets.map((b) => ({ label: b.label, value: b.count })),
      },
      { key: 'by-plan', title: 'Expiring by plan', kind: 'bar', items: items(d.byPlan) },
    ],
    series: null,
  };
}

export function activeVsInactiveSummary(
  rows: Array<{ status: string; count: number }>,
): ReportSummaryBody {
  const list = rows.map((r) => ({ label: r.status, value: r.count }));
  return {
    kpis: [{ key: 'total', label: 'Total members', value: sum(list), format: 'number' }],
    breakdowns: [{ key: 'by-status', title: 'Members by status', kind: 'donut', items: list }],
    series: null,
  };
}
