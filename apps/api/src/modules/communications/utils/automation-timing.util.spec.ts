import { describe, expect, it } from 'vitest';

import {
  daysBetween,
  isBirthdayWithin,
  matchesBirthday,
  pickAfterOffset,
  pickBeforeOffset,
  pickHoursBeforeOffset,
  utcDayStart,
} from './automation-timing.util';

describe('daysBetween / utcDayStart', () => {
  it('counts whole UTC calendar days regardless of time of day', () => {
    expect(daysBetween(new Date('2026-10-19T23:59:00Z'), new Date('2026-10-20T00:01:00Z'))).toBe(1);
    expect(daysBetween(new Date('2026-10-26T00:00:00Z'), new Date('2026-10-19T18:00:00Z'))).toBe(-7);
    expect(utcDayStart(new Date('2026-10-19T18:45:00Z')).toISOString()).toBe('2026-10-19T00:00:00.000Z');
  });
});

describe('pickBeforeOffset (expiring / due soon: 7, 3, 1)', () => {
  const offsets = [7, 3, 1];
  it('nothing is due while further out than the largest offset', () => {
    expect(pickBeforeOffset(8, offsets)).toBeNull();
    expect(pickBeforeOffset(30, offsets)).toBeNull();
  });
  it('fires the tightest offset that already applies, never several at once', () => {
    expect(pickBeforeOffset(7, offsets)).toBe(7);
    expect(pickBeforeOffset(5, offsets)).toBe(7); // first seen late: one "7" message, not 7+3
    expect(pickBeforeOffset(3, offsets)).toBe(3);
    expect(pickBeforeOffset(2, offsets)).toBe(3);
    expect(pickBeforeOffset(1, offsets)).toBe(1);
    expect(pickBeforeOffset(0, offsets)).toBe(1);
  });
  it('already past the date is not a reminder', () => {
    expect(pickBeforeOffset(-1, offsets)).toBeNull();
  });
  it('unsorted offsets behave the same', () => {
    expect(pickBeforeOffset(2, [1, 7, 3])).toBe(3);
  });
});

describe('pickAfterOffset (overdue: 1, 7, 14)', () => {
  const offsets = [1, 7, 14];
  it('nothing before the first offset', () => {
    expect(pickAfterOffset(0, offsets)).toBeNull();
  });
  it('fires the most advanced offset reached', () => {
    expect(pickAfterOffset(1, offsets)).toBe(1);
    expect(pickAfterOffset(6, offsets)).toBe(1);
    expect(pickAfterOffset(7, offsets)).toBe(7);
    expect(pickAfterOffset(13, offsets)).toBe(7);
    expect(pickAfterOffset(14, offsets)).toBe(14);
    expect(pickAfterOffset(20, offsets)).toBe(14);
  });
  it('stops after the catch-up window so very old history is never blasted', () => {
    expect(pickAfterOffset(28, offsets)).toBe(14); // 14 + 14 days
    expect(pickAfterOffset(29, offsets)).toBeNull();
    expect(pickAfterOffset(60, offsets, 14)).toBeNull();
  });
  it('empty offsets never fire', () => {
    expect(pickAfterOffset(5, [])).toBeNull();
  });
});

describe('pickHoursBeforeOffset (class reminders: 24h, 2h)', () => {
  const offsets = [24, 2];
  it('matches only inside the last hour of each countdown', () => {
    expect(pickHoursBeforeOffset(24, offsets)).toBe(24);
    expect(pickHoursBeforeOffset(23.2, offsets)).toBe(24);
    expect(pickHoursBeforeOffset(22.9, offsets)).toBeNull();
    expect(pickHoursBeforeOffset(25, offsets)).toBeNull();
    expect(pickHoursBeforeOffset(2, offsets)).toBe(2);
    expect(pickHoursBeforeOffset(1.01, offsets)).toBe(2);
    expect(pickHoursBeforeOffset(0.9, offsets)).toBeNull();
  });
  it('a class that already started is never reminded', () => {
    expect(pickHoursBeforeOffset(0, offsets)).toBeNull();
    expect(pickHoursBeforeOffset(-3, offsets)).toBeNull();
  });
});

describe('birthdays', () => {
  const today = new Date('2026-10-19T00:00:00Z');
  it('matches month/day regardless of birth year', () => {
    expect(matchesBirthday(new Date('1990-10-19T00:00:00Z'), today)).toBe(true);
    expect(matchesBirthday(new Date('1990-10-20T00:00:00Z'), today)).toBe(false);
  });
  it('a 29 Feb birthday is celebrated on 28 Feb in non-leap years only', () => {
    const dob = new Date('2000-02-29T00:00:00Z');
    expect(matchesBirthday(dob, new Date('2027-02-28T00:00:00Z'))).toBe(true);
    expect(matchesBirthday(dob, new Date('2028-02-28T00:00:00Z'))).toBe(false);
    expect(matchesBirthday(dob, new Date('2028-02-29T00:00:00Z'))).toBe(true);
  });
  it('"this week" is today through today+6', () => {
    expect(isBirthdayWithin(new Date('1991-10-25T00:00:00Z'), today, 7)).toBe(true);
    expect(isBirthdayWithin(new Date('1991-10-26T00:00:00Z'), today, 7)).toBe(false);
    expect(isBirthdayWithin(new Date('1991-10-18T00:00:00Z'), today, 7)).toBe(false);
  });
  it('works across a year end', () => {
    expect(isBirthdayWithin(new Date('1991-01-02T00:00:00Z'), new Date('2026-12-30T00:00:00Z'), 7)).toBe(true);
  });
});
