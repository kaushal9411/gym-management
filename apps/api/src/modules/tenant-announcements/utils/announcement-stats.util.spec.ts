import { describe, expect, it } from 'vitest';

import {
  assembleAnnouncementStats,
  expiringSoonWindow,
  resolveRanges,
  type AnnouncementStatsRaw,
} from './announcement-stats.util';

const { range, previousRange } = resolveRanges('2026-10-01', '2026-10-03');

const raw: AnnouncementStatsRaw = {
  range,
  previousRange,
  dayAudience: [
    { date: '2026-10-01', audience: 'ALL', count: 2 },
    { date: '2026-10-03', audience: 'MEMBERS', count: 1 },
    { date: '2026-09-29', audience: 'STAFF', count: 4 },
    { date: '2026-07-01', audience: 'ALL', count: 9 },
  ],
  statusCounts: [
    { status: 'DRAFT', count: 3 },
    { status: 'PUBLISHED', count: 6 },
  ],
  expiringSoon: 2,
  byBranch: [{ branchId: 'b1', name: 'Main', count: 2 }],
  upcoming: [],
  expiring: [],
  recent: [{ id: 'a1', title: 'Hi', audience: 'ALL', publishedAt: '2026-10-03T00:00:00.000Z' }],
};

describe('assembleAnnouncementStats', () => {
  const dto = assembleAnnouncementStats(raw);

  it('computes published kpi for current and previous range', () => {
    expect(dto.kpis.published).toEqual({ value: 3, previous: 4 });
    expect(dto.kpis.drafts).toEqual({ value: 3 });
    expect(dto.kpis.scheduled).toEqual({ value: 0 });
    expect(dto.kpis.expired).toEqual({ value: 0 });
    expect(dto.kpis.expiringSoon).toEqual({ value: 2 });
  });

  it('zero-fills daily and aligns previous by index', () => {
    expect(dto.daily).toEqual([
      { date: '2026-10-01', published: 2, previousPublished: 0 },
      { date: '2026-10-02', published: 0, previousPublished: 4 },
      { date: '2026-10-03', published: 1, previousPublished: 0 },
    ]);
  });

  it('always lists all four statuses and all three audiences', () => {
    expect(dto.byStatus).toEqual([
      { status: 'DRAFT', count: 3 },
      { status: 'SCHEDULED', count: 0 },
      { status: 'PUBLISHED', count: 6 },
      { status: 'EXPIRED', count: 0 },
    ]);
    expect(dto.byAudience).toEqual([
      { audience: 'ALL', count: 2, previousCount: 0 },
      { audience: 'MEMBERS', count: 1, previousCount: 0 },
      { audience: 'STAFF', count: 0, previousCount: 4 },
    ]);
  });

  it('returns null delivered/read on recent rows (no reliable link)', () => {
    expect(dto.recent[0]).toMatchObject({ delivered: null, read: null });
  });
});

describe('expiringSoonWindow', () => {
  it('spans exactly 7 days from now', () => {
    const now = new Date('2026-10-04T12:00:00Z');
    const w = expiringSoonWindow(now);
    expect(w.from).toEqual(now);
    expect(w.to.toISOString()).toBe('2026-10-11T12:00:00.000Z');
  });
});
