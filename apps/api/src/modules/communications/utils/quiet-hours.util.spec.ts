import { describe, expect, it } from 'vitest';

import { isQuietTime, quietHoldUntil } from './quiet-hours.util';
import { wallTimeToUtc, zonedDay, zonedParts } from './zoned-time.util';

describe('zoned time helpers', () => {
  it('reads wall-clock parts in the zone', () => {
    // 2026-10-19 16:30 UTC = 22:00 in Kolkata (+05:30)
    expect(zonedParts(new Date('2026-10-19T16:30:00Z'), 'Asia/Kolkata')).toMatchObject({ year: 2026, month: 10, day: 19, hour: 22, minute: 0 });
  });

  it('converts a wall time back to the UTC instant', () => {
    expect(wallTimeToUtc(2026, 10, 20, 8, 0, 'Asia/Kolkata').toISOString()).toBe('2026-10-20T02:30:00.000Z');
    expect(wallTimeToUtc(2026, 10, 20, 8, 0, 'Asia/Kathmandu').toISOString()).toBe('2026-10-20T02:15:00.000Z');
  });

  it('falls back to UTC for an invalid zone', () => {
    expect(zonedParts(new Date('2026-10-19T10:00:00Z'), 'Not/AZone').hour).toBe(10);
  });

  it('zonedDay gives the local calendar date', () => {
    expect(zonedDay(new Date('2026-10-19T20:00:00Z'), 'Asia/Kolkata')).toBe('2026-10-20');
  });
});

describe('quiet hours (21:00 - 08:00 member-local)', () => {
  it('daytime is not quiet, and nothing is held', () => {
    const noonIst = new Date('2026-10-19T06:30:00Z'); // 12:00 IST
    expect(isQuietTime(noonIst, 'Asia/Kolkata')).toBe(false);
    expect(quietHoldUntil(noonIst, 'Asia/Kolkata')).toBeNull();
  });

  it('boundaries: 21:00 is quiet, 20:59 is not, 08:00 is not, 07:59 is quiet', () => {
    expect(isQuietTime(new Date('2026-10-19T15:30:00Z'), 'Asia/Kolkata')).toBe(true); // 21:00 IST
    expect(isQuietTime(new Date('2026-10-19T15:29:00Z'), 'Asia/Kolkata')).toBe(false); // 20:59 IST
    expect(isQuietTime(new Date('2026-10-19T02:30:00Z'), 'Asia/Kolkata')).toBe(false); // 08:00 IST
    expect(isQuietTime(new Date('2026-10-19T02:29:00Z'), 'Asia/Kolkata')).toBe(true); // 07:59 IST
  });

  it('after 21:00 holds until 08:00 the NEXT local morning', () => {
    const at = new Date('2026-10-19T16:30:00Z'); // 22:00 IST on the 19th
    expect(quietHoldUntil(at, 'Asia/Kolkata')?.toISOString()).toBe('2026-10-20T02:30:00.000Z'); // 08:00 IST on the 20th
  });

  it('before 08:00 holds until 08:00 the SAME local morning', () => {
    const at = new Date('2026-10-19T22:00:00Z'); // 03:30 IST on the 20th
    expect(quietHoldUntil(at, 'Asia/Kolkata')?.toISOString()).toBe('2026-10-20T02:30:00.000Z');
  });

  it("uses each member's own timezone: same instant, different verdict", () => {
    const at = new Date('2026-10-19T16:30:00Z'); // 22:00 IST but 12:30 in New York
    expect(isQuietTime(at, 'Asia/Kolkata')).toBe(true);
    expect(isQuietTime(at, 'America/New_York')).toBe(false);
  });

  it('is correct across a DST change (New York falls back on 2026-11-01)', () => {
    // 2026-10-31 23:00 EDT (UTC-4) -> release 2026-11-01 08:00 EST (UTC-5) = 13:00 UTC
    const at = new Date('2026-11-01T03:00:00Z');
    expect(quietHoldUntil(at, 'America/New_York')?.toISOString()).toBe('2026-11-01T13:00:00.000Z');
  });

  it('crosses a month end', () => {
    const at = new Date('2026-10-31T17:00:00Z'); // 22:30 IST on 31 Oct
    expect(quietHoldUntil(at, 'Asia/Kolkata')?.toISOString()).toBe('2026-11-01T02:30:00.000Z');
  });
});
