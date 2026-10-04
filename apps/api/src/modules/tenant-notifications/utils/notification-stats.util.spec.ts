import { describe, expect, it } from 'vitest';

import {
  assembleNotificationStats,
  resolveRanges,
  type NotificationStatsRaw,
} from './notification-stats.util';

const { range, previousRange } = resolveRanges('2026-10-01', '2026-10-03');

const raw: NotificationStatsRaw = {
  range,
  previousRange,
  dayCategory: [
    { date: '2026-10-01', category: 'PAYMENT', total: 4, read: 3 },
    { date: '2026-10-01', category: 'MEMBER', total: 1, read: 0 },
    { date: '2026-10-03', category: 'PAYMENT', total: 3, read: 1 },
    { date: '2026-09-28', category: 'PAYMENT', total: 2, read: 2 },
    { date: '2026-09-29', category: 'STAFF', total: 5, read: 0 },
    { date: '2026-08-01', category: 'SYSTEM', total: 9, read: 9 }, // outside both ranges
  ],
  hourly: [
    { hour: 9, count: 5 },
    { hour: 23, count: 3 },
  ],
  unreadNow: 7,
};

describe('assembleNotificationStats', () => {
  const dto = assembleNotificationStats(raw);

  it('computes kpis for current and previous ranges and ignores out-of-range rows', () => {
    expect(dto.kpis.total).toEqual({ value: 8, previous: 7 });
    expect(dto.kpis.read).toEqual({ value: 4, previous: 2 });
    expect(dto.kpis.unread).toEqual({ value: 7 });
  });

  it('computes readRate as a 0..1 ratio and 0 when there is nothing', () => {
    expect(dto.kpis.readRate.value).toBeCloseTo(0.5);
    expect(dto.kpis.readRate.previous).toBeCloseTo(2 / 7);
    const empty = assembleNotificationStats({ ...raw, dayCategory: [], hourly: [] });
    expect(empty.kpis.readRate).toEqual({ value: 0, previous: 0 });
  });

  it('zero-fills daily and aligns previousTotal by index', () => {
    expect(dto.daily).toEqual([
      { date: '2026-10-01', total: 5, read: 3, previousTotal: 2 },
      { date: '2026-10-02', total: 0, read: 0, previousTotal: 5 },
      { date: '2026-10-03', total: 3, read: 1, previousTotal: 0 },
    ]);
  });

  it('merges categories across both ranges, sorted by count desc', () => {
    expect(dto.categories).toEqual([
      { category: 'PAYMENT', count: 7, unread: 3, previousCount: 2 },
      { category: 'MEMBER', count: 1, unread: 1, previousCount: 0 },
      { category: 'STAFF', count: 0, unread: 0, previousCount: 5 },
    ]);
  });

  it('always returns 24 hourly rows', () => {
    expect(dto.hourly).toHaveLength(24);
    expect(dto.hourly[9]).toEqual({ hour: 9, count: 5 });
    expect(dto.hourly[23]).toEqual({ hour: 23, count: 3 });
    expect(dto.hourly[0]).toEqual({ hour: 0, count: 0 });
  });
});
