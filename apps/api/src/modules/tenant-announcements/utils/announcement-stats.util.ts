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

export const ANNOUNCEMENT_STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'EXPIRED'] as const;
export const ANNOUNCEMENT_AUDIENCES = ['ALL', 'MEMBERS', 'STAFF'] as const;
export const EXPIRING_SOON_DAYS = 7;
export const STATS_LIST_SIZE = 5;

export interface AnnouncementStatsRaw {
  range: DateRange;
  previousRange: DateRange;
  /** Published announcements grouped by (UTC publishedAt day, audience) across previousRange.from..range.to. */
  dayAudience: Array<{ date: string; audience: string; count: number }>;
  /** Current counts by status (sparse). */
  statusCounts: Array<{ status: string; count: number }>;
  expiringSoon: number;
  byBranch: Array<{ branchId: string; name: string; count: number }>;
  upcoming: Array<{ id: string; title: string; audience: string; publishAt: string | null }>;
  expiring: Array<{ id: string; title: string; audience: string; expiresAt: string | null }>;
  recent: Array<{ id: string; title: string; audience: string; publishedAt: string | null }>;
}

export interface AnnouncementStatsDto {
  range: DateRange;
  previousRange: DateRange;
  kpis: {
    published: { value: number; previous: number };
    drafts: { value: number };
    scheduled: { value: number };
    expired: { value: number };
    expiringSoon: { value: number };
  };
  daily: Array<{ date: string; published: number; previousPublished: number }>;
  byStatus: Array<{ status: string; count: number }>;
  byAudience: Array<{ audience: string; count: number; previousCount: number }>;
  byBranch: Array<{ branchId: string; name: string; count: number }>;
  upcoming: AnnouncementStatsRaw['upcoming'];
  expiring: AnnouncementStatsRaw['expiring'];
  /** delivered/read are null: member notifications carry no link back to the announcement that produced them. */
  recent: Array<
    AnnouncementStatsRaw['recent'][number] & { delivered: number | null; read: number | null }
  >;
}

/** [now, now + 7 days] window used for `expiringSoon`. */
export function expiringSoonWindow(now: Date = new Date()): { from: Date; to: Date } {
  return { from: now, to: new Date(now.getTime() + EXPIRING_SOON_DAYS * 86_400_000) };
}

/** Pure assembly of the grouped aggregates into the response contract — no I/O, unit-testable. */
export function assembleAnnouncementStats(raw: AnnouncementStatsRaw): AnnouncementStatsDto {
  const { range, previousRange } = raw;
  const inRange = (d: string, r: DateRange) => d >= r.from && d <= r.to;

  const byDay = new Map<string, number>();
  const aud = new Map<string, { count: number; previousCount: number }>(
    ANNOUNCEMENT_AUDIENCES.map((a) => [a, { count: 0, previousCount: 0 }]),
  );
  let cur = 0;
  let prev = 0;
  for (const row of raw.dayAudience) {
    const isCur = inRange(row.date, range);
    const isPrev = !isCur && inRange(row.date, previousRange);
    if (!isCur && !isPrev) continue;
    byDay.set(row.date, (byDay.get(row.date) ?? 0) + row.count);
    const a = aud.get(row.audience) ?? { count: 0, previousCount: 0 };
    if (isCur) {
      cur += row.count;
      a.count += row.count;
    } else {
      prev += row.count;
      a.previousCount += row.count;
    }
    aud.set(row.audience, a);
  }

  const statuses = new Map(raw.statusCounts.map((s) => [s.status, s.count]));
  const byStatus = ANNOUNCEMENT_STATUSES.map((status) => ({
    status,
    count: statuses.get(status) ?? 0,
  }));

  const length = daysInclusive(range.from, range.to);
  const daily = Array.from({ length }, (_, i) => ({
    date: addDaysStr(range.from, i),
    published: byDay.get(addDaysStr(range.from, i)) ?? 0,
    previousPublished: byDay.get(addDaysStr(previousRange.from, i)) ?? 0,
  }));

  return {
    range,
    previousRange,
    kpis: {
      published: { value: cur, previous: prev },
      drafts: { value: statuses.get('DRAFT') ?? 0 },
      scheduled: { value: statuses.get('SCHEDULED') ?? 0 },
      expired: { value: statuses.get('EXPIRED') ?? 0 },
      expiringSoon: { value: raw.expiringSoon },
    },
    daily,
    byStatus,
    byAudience: [...aud.entries()].map(([audience, v]) => ({ audience, ...v })),
    byBranch: raw.byBranch,
    upcoming: raw.upcoming,
    expiring: raw.expiring,
    recent: raw.recent.map((r) => ({ ...r, delivered: null, read: null })),
  };
}
