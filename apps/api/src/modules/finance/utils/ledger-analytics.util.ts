import type { LedgerAnalyticsDto } from '../dto/finance.dto';

import { addDaysStr, daysInclusive, money, type DateRange } from './payments-analytics.util';

export type LedgerKind = 'income' | 'expense';

export interface LedgerEntryRaw {
  id: string;
  description: string | null;
  category: string;
  amount: number;
  date: string;
}

export interface LedgerRaw {
  kind: LedgerKind;
  range: DateRange;
  previousRange: DateRange;
  /** Grouped by day across previousRange.from..range.to. */
  dayRows: Array<{ date: string; amount: number; count: number }>;
  categoriesCurrent: Array<{ category: string; amount: number; count: number }>;
  categoriesPrevious: Array<{ category: string; amount: number; count: number }>;
  branches: Array<{ branchId: string; name: string; total: number; previousTotal: number }>;
  /** Largest entries in range, amount desc (top 5). */
  topEntries: LedgerEntryRaw[];
  /** Total of the OPPOSITE ledger (expenses for income, income for expenses) — only used for netProfit. */
  otherTotal: { current: number; previous: number };
}

/** Union of categories seen in either range, with zeros for the missing side, sorted by current amount desc (ties: previous desc, then name). */
export function mergeCategories(current: LedgerRaw['categoriesCurrent'], previous: LedgerRaw['categoriesPrevious']): LedgerAnalyticsDto['categories'] {
  const merged = new Map<string, { amount: number; count: number; previousAmount: number }>();
  for (const c of current) merged.set(c.category, { amount: c.amount, count: c.count, previousAmount: 0 });
  for (const p of previous) {
    const e = merged.get(p.category) ?? { amount: 0, count: 0, previousAmount: 0 };
    e.previousAmount = p.amount;
    merged.set(p.category, e);
  }
  return [...merged.entries()]
    .sort((a, b) => b[1].amount - a[1].amount || b[1].previousAmount - a[1].previousAmount || a[0].localeCompare(b[0]))
    .map(([category, e]) => ({
      category,
      amount: money(e.amount),
      count: e.count,
      previousAmount: money(e.previousAmount),
    }));
}

/** netProfit = income − expenses; `own` is this ledger's total, `other` the opposite ledger's. */
export function netProfitOf(kind: LedgerKind, own: number, other: number): number {
  return kind === 'income' ? own - other : other - own;
}

const ratio = (num: number, den: number): number => (den > 0 ? num / den : 0);

/** Pure assembly of the grouped aggregates into the response contract — no I/O, unit-testable. */
export function assembleLedgerAnalytics(raw: LedgerRaw): LedgerAnalyticsDto {
  const { range, previousRange } = raw;
  const inRange = (d: string, r: DateRange) => d >= r.from && d <= r.to;
  const byDay = new Map(raw.dayRows.map((r) => [r.date, r]));

  const cur = { total: 0, count: 0 };
  const prev = { total: 0, count: 0 };
  for (const r of raw.dayRows) {
    const b = inRange(r.date, range) ? cur : inRange(r.date, previousRange) ? prev : null;
    if (!b) continue;
    b.total += r.amount;
    b.count += r.count;
  }

  const length = daysInclusive(range.from, range.to);
  const daily: LedgerAnalyticsDto['daily'] = [];
  for (let i = 0; i < length; i += 1) {
    const date = addDaysStr(range.from, i);
    const prevDate = addDaysStr(previousRange.from, i);
    daily.push({
      date,
      total: money(byDay.get(date)?.amount ?? 0),
      count: byDay.get(date)?.count ?? 0,
      previousTotal: money(byDay.get(prevDate)?.amount ?? 0),
    });
  }

  const top = raw.topEntries[0];
  return {
    range,
    previousRange,
    kpis: {
      total: { value: money(cur.total), previous: money(prev.total) },
      count: { value: cur.count, previous: prev.count },
      average: {
        value: money(ratio(cur.total, cur.count)),
        previous: money(ratio(prev.total, prev.count)),
      },
      largest: top
        ? {
            value: money(top.amount),
            description: top.description,
            category: top.category,
            date: top.date,
          }
        : null,
      netProfit: {
        value: money(netProfitOf(raw.kind, cur.total, raw.otherTotal.current)),
        previous: money(netProfitOf(raw.kind, prev.total, raw.otherTotal.previous)),
      },
    },
    daily,
    categories: mergeCategories(raw.categoriesCurrent, raw.categoriesPrevious),
    branches: [...raw.branches]
      .sort((a, b) => b.total - a.total)
      .map((b) => ({
        branchId: b.branchId,
        name: b.name,
        total: money(b.total),
        previousTotal: money(b.previousTotal),
      })),
    topEntries: raw.topEntries.map((e) => ({
      id: e.id,
      description: e.description,
      category: e.category,
      amount: money(e.amount),
      date: e.date,
    })),
  };
}
