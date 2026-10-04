import { describe, expect, it } from 'vitest';

import {
  assembleTicketCounts,
  assembleTicketStats,
  resolveRanges,
  wholeDaysSince,
  type TicketStatsRaw,
} from './ticket-stats.util';

const { range, previousRange } = resolveRanges('2026-10-01', '2026-10-03');

const raw: TicketStatsRaw = {
  range,
  previousRange,
  dayPriority: [
    { date: '2026-10-01', priority: 'HIGH', count: 2 },
    { date: '2026-10-03', priority: 'LOW', count: 1 },
    { date: '2026-09-29', priority: 'URGENT', count: 4 },
    { date: '2026-07-01', priority: 'LOW', count: 9 },
  ],
  statusCounts: [
    { status: 'OPEN', count: 3 },
    { status: 'IN_PROGRESS', count: 2 },
    { status: 'CLOSED', count: 7 },
  ],
  oldestUnresolvedAt: new Date('2026-09-20T12:00:00.000Z'),
};

describe('assembleTicketStats', () => {
  const now = new Date('2026-10-04T11:00:00.000Z');
  const dto = assembleTicketStats(raw, now);

  it('computes created for current and previous range, ignoring out-of-span rows', () => {
    expect(dto.kpis.created).toEqual({ value: 3, previous: 4 });
  });

  it('zero-fills daily and aligns previous by index', () => {
    expect(dto.daily).toEqual(
      [
        { date: '2026-10-01', created: 2, previousCreated: 0 },
        { date: '2026-10-02', created: 0, previousCreated: 0 },
        { date: '2026-10-03', created: 1, previousCreated: 0 },
      ].map((d, i) => (i === 1 ? { ...d, previousCreated: 4 } : d)),
    );
  });

  it('always lists all four statuses and priorities', () => {
    expect(dto.byStatus).toEqual([
      { status: 'OPEN', count: 3 },
      { status: 'IN_PROGRESS', count: 2 },
      { status: 'RESOLVED', count: 0 },
      { status: 'CLOSED', count: 7 },
    ]);
    expect(dto.byPriority).toEqual([
      { priority: 'LOW', count: 1, previousCount: 0 },
      { priority: 'MEDIUM', count: 0, previousCount: 0 },
      { priority: 'HIGH', count: 2, previousCount: 0 },
      { priority: 'URGENT', count: 0, previousCount: 4 },
    ]);
  });

  it('sums unresolved and computes oldestOpenDays', () => {
    expect(dto.kpis.unresolved).toEqual({ value: 5 });
    expect(dto.kpis.resolved).toEqual({ value: 0 });
    expect(dto.kpis.oldestOpenDays).toEqual({ value: 13 });
  });

  it('returns null oldestOpenDays when nothing is unresolved', () => {
    const empty = assembleTicketStats(
      { ...raw, statusCounts: [], dayPriority: [], oldestUnresolvedAt: null },
      now,
    );
    expect(empty.kpis.oldestOpenDays).toBeNull();
    expect(empty.kpis.unresolved).toEqual({ value: 0 });
    expect(empty.kpis.created).toEqual({ value: 0, previous: 0 });
  });
});

describe('wholeDaysSince', () => {
  it('floors and never goes negative', () => {
    expect(wholeDaysSince(new Date('2026-10-03T12:00:00Z'), new Date('2026-10-04T11:00:00Z'))).toBe(
      0,
    );
    expect(wholeDaysSince(new Date('2026-10-05T00:00:00Z'), new Date('2026-10-04T00:00:00Z'))).toBe(
      0,
    );
  });
});

describe('assembleTicketCounts', () => {
  it('fills missing statuses and sums all', () => {
    expect(
      assembleTicketCounts([
        { status: 'OPEN', count: 2 },
        { status: 'RESOLVED', count: 1 },
      ]),
    ).toEqual({
      all: 3,
      open: 2,
      inProgress: 0,
      resolved: 1,
      closed: 0,
    });
  });
});
