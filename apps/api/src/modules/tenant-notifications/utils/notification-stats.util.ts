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

export const NOTIFICATION_CATEGORIES = [
  'ANNOUNCEMENT',
  'SYSTEM',
  'SUBSCRIPTION',
  'GENERAL',
  'MEMBER',
  'MEMBERSHIP',
  'PAYMENT',
  'ATTENDANCE',
  'WORKOUT',
  'DIET',
  'STAFF',
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export interface DayCategoryRow {
  date: string;
  category: string;
  total: number;
  read: number;
}

export interface NotificationStatsRaw {
  range: DateRange;
  previousRange: DateRange;
  /** Grouped by (UTC day, category) across previousRange.from..range.to. */
  dayCategory: DayCategoryRow[];
  /** Rows created inside `range`, grouped by UTC hour (sparse is fine). */
  hourly: Array<{ hour: number; count: number }>;
  /** Current unread count over the whole feed (ignores the range). */
  unreadNow: number;
}

export interface NotificationStatsDto {
  range: DateRange;
  previousRange: DateRange;
  kpis: {
    total: { value: number; previous: number };
    unread: { value: number };
    read: { value: number; previous: number };
    readRate: { value: number; previous: number };
  };
  daily: Array<{ date: string; total: number; read: number; previousTotal: number }>;
  categories: Array<{ category: string; count: number; unread: number; previousCount: number }>;
  hourly: Array<{ hour: number; count: number }>;
}

const ratio = (num: number, den: number): number => (den > 0 ? num / den : 0);

/** Pure assembly of the grouped aggregates into the response contract — no I/O, unit-testable. */
export function assembleNotificationStats(raw: NotificationStatsRaw): NotificationStatsDto {
  const { range, previousRange } = raw;
  const inRange = (d: string, r: DateRange) => d >= r.from && d <= r.to;

  const byDay = new Map<string, { total: number; read: number }>();
  const cats = new Map<string, { count: number; unread: number; previousCount: number }>();
  const cur = { total: 0, read: 0 };
  const prev = { total: 0, read: 0 };

  for (const row of raw.dayCategory) {
    const isCur = inRange(row.date, range);
    const isPrev = !isCur && inRange(row.date, previousRange);
    if (!isCur && !isPrev) continue;
    const bucket = isCur ? cur : prev;
    bucket.total += row.total;
    bucket.read += row.read;
    const d = byDay.get(row.date) ?? { total: 0, read: 0 };
    d.total += row.total;
    d.read += row.read;
    byDay.set(row.date, d);
    const c = cats.get(row.category) ?? { count: 0, unread: 0, previousCount: 0 };
    if (isCur) {
      c.count += row.total;
      c.unread += row.total - row.read;
    } else {
      c.previousCount += row.total;
    }
    cats.set(row.category, c);
  }

  const length = daysInclusive(range.from, range.to);
  const daily = Array.from({ length }, (_, i) => {
    const date = addDaysStr(range.from, i);
    const e = byDay.get(date);
    return {
      date,
      total: e?.total ?? 0,
      read: e?.read ?? 0,
      previousTotal: byDay.get(addDaysStr(previousRange.from, i))?.total ?? 0,
    };
  });

  const hours = new Map(raw.hourly.map((h) => [h.hour, h.count]));

  return {
    range,
    previousRange,
    kpis: {
      total: { value: cur.total, previous: prev.total },
      unread: { value: raw.unreadNow },
      read: { value: cur.read, previous: prev.read },
      readRate: { value: ratio(cur.read, cur.total), previous: ratio(prev.read, prev.total) },
    },
    daily,
    categories: [...cats.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort(
        (a, b) =>
          b.count - a.count ||
          b.previousCount - a.previousCount ||
          a.category.localeCompare(b.category),
      ),
    hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, count: hours.get(hour) ?? 0 })),
  };
}
