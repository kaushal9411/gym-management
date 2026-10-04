import {
  addDaysStr,
  daysInclusive,
  type DateRange,
} from '../../finance/utils/payments-analytics.util';

export {
  addDaysStr,
  resolveRanges,
  type DateRange,
} from '../../finance/utils/payments-analytics.util';

export const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export interface TicketStatsRaw {
  range: DateRange;
  previousRange: DateRange;
  /** Tickets grouped by (UTC createdAt day, priority) across previousRange.from..range.to. */
  dayPriority: Array<{ date: string; priority: string; count: number }>;
  /** Current counts by status (sparse). */
  statusCounts: Array<{ status: string; count: number }>;
  /** createdAt of the oldest OPEN/IN_PROGRESS ticket, null when none. */
  oldestUnresolvedAt: Date | null;
}

export interface TicketStatsDto {
  range: DateRange;
  previousRange: DateRange;
  kpis: {
    created: { value: number; previous: number };
    open: { value: number };
    inProgress: { value: number };
    resolved: { value: number };
    closed: { value: number };
    unresolved: { value: number };
    oldestOpenDays: { value: number } | null;
  };
  daily: Array<{ date: string; created: number; previousCreated: number }>;
  byStatus: Array<{ status: string; count: number }>;
  byPriority: Array<{ priority: string; count: number; previousCount: number }>;
}

/** Whole days between a ticket's createdAt and now (never negative). */
export function wholeDaysSince(from: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / 86_400_000));
}

/** Pure assembly of grouped aggregates into the response contract — no I/O, unit-testable. */
export function assembleTicketStats(raw: TicketStatsRaw, now: Date = new Date()): TicketStatsDto {
  const { range, previousRange } = raw;
  const inRange = (d: string, r: DateRange) => d >= r.from && d <= r.to;

  const byDay = new Map<string, number>();
  const pri = new Map<string, { count: number; previousCount: number }>(
    TICKET_PRIORITIES.map((p) => [p, { count: 0, previousCount: 0 }]),
  );
  let cur = 0;
  let prev = 0;
  for (const row of raw.dayPriority) {
    const isCur = inRange(row.date, range);
    const isPrev = !isCur && inRange(row.date, previousRange);
    if (!isCur && !isPrev) continue;
    byDay.set(row.date, (byDay.get(row.date) ?? 0) + row.count);
    const p = pri.get(row.priority) ?? { count: 0, previousCount: 0 };
    if (isCur) {
      cur += row.count;
      p.count += row.count;
    } else {
      prev += row.count;
      p.previousCount += row.count;
    }
    pri.set(row.priority, p);
  }

  const statuses = new Map(raw.statusCounts.map((s) => [s.status, s.count]));
  const byStatus = TICKET_STATUSES.map((status) => ({ status, count: statuses.get(status) ?? 0 }));
  const open = statuses.get('OPEN') ?? 0;
  const inProgress = statuses.get('IN_PROGRESS') ?? 0;

  const length = daysInclusive(range.from, range.to);
  const daily = Array.from({ length }, (_, i) => ({
    date: addDaysStr(range.from, i),
    created: byDay.get(addDaysStr(range.from, i)) ?? 0,
    previousCreated: byDay.get(addDaysStr(previousRange.from, i)) ?? 0,
  }));

  return {
    range,
    previousRange,
    kpis: {
      created: { value: cur, previous: prev },
      open: { value: open },
      inProgress: { value: inProgress },
      resolved: { value: statuses.get('RESOLVED') ?? 0 },
      closed: { value: statuses.get('CLOSED') ?? 0 },
      unresolved: { value: open + inProgress },
      oldestOpenDays: raw.oldestUnresolvedAt
        ? { value: wholeDaysSince(raw.oldestUnresolvedAt, now) }
        : null,
    },
    daily,
    byStatus,
    byPriority: [...pri.entries()].map(([priority, v]) => ({ priority, ...v })),
  };
}

/** `counts` for the list endpoint: tenant-wide, ignoring the status filter. */
export function assembleTicketCounts(statusCounts: Array<{ status: string; count: number }>) {
  const m = new Map(statusCounts.map((s) => [s.status, s.count]));
  const open = m.get('OPEN') ?? 0;
  const inProgress = m.get('IN_PROGRESS') ?? 0;
  const resolved = m.get('RESOLVED') ?? 0;
  const closed = m.get('CLOSED') ?? 0;
  return { all: open + inProgress + resolved + closed, open, inProgress, resolved, closed };
}
