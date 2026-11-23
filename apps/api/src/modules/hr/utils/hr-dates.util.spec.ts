import { describe, expect, it } from 'vitest';

import {
  addDays,
  addMonths,
  daysInMonth,
  eachDate,
  formatDateRange,
  formatHumanDate,
  istInstant,
  istMinuteOfDay,
  istTimeOf,
  leaveYearBounds,
  leaveYearLabel,
  leaveYearOf,
  monthEnd,
  monthLabel,
  parseWeekdayList,
  round2,
  weekdayOf,
} from './hr-dates.util';

describe('hr dates (IST business dates)', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('lists inclusive date ranges', () => {
    expect(eachDate('2026-11-28', '2026-12-01')).toEqual(['2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01']);
    expect(eachDate('2026-11-05', '2026-11-04')).toEqual([]);
  });

  it('knows weekdays', () => {
    expect(weekdayOf('2026-11-22')).toBe('SUNDAY');
    expect(weekdayOf('2026-11-23')).toBe('MONDAY');
  });

  it('computes month sizes, including February', () => {
    expect(daysInMonth('2026-11')).toBe(30);
    expect(daysInMonth('2026-12')).toBe(31);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(monthEnd('2026-02')).toBe('2026-02-28');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(monthLabel('2026-11')).toBe('Nov 2026');
  });

  it('converts between instants and IST wall clock', () => {
    const i = istInstant('2026-11-22', '06:30');
    expect(i.toISOString()).toBe('2026-11-22T01:00:00.000Z');
    expect(istTimeOf(i)).toBe('06:30');
    expect(istMinuteOfDay(new Date('2026-11-22T18:29:00Z'))).toBe(23 * 60 + 59);
    expect(istMinuteOfDay(new Date('2026-11-22T18:30:00Z'))).toBe(0);
  });

  it('leave year runs 1 Apr - 31 Mar by default and is configurable', () => {
    expect(leaveYearOf('2026-03-31', 4)).toBe(2025);
    expect(leaveYearOf('2026-04-01', 4)).toBe(2026);
    expect(leaveYearOf('2026-11-22', 4)).toBe(2026);
    expect(leaveYearBounds(2026, 4)).toEqual({ start: '2026-04-01', end: '2027-03-31' });
    expect(leaveYearLabel(2026, 4)).toBe('2026-27');
    expect(leaveYearOf('2026-06-30', 1)).toBe(2026);
    expect(leaveYearBounds(2026, 1)).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(leaveYearLabel(2026, 1)).toBe('2026');
  });

  it('parses weekday lists defensively', () => {
    expect(parseWeekdayList('sunday, MONDAY,nope')).toEqual(['SUNDAY', 'MONDAY']);
    expect(parseWeekdayList(null)).toEqual([]);
  });

  it('rounds money to 2 decimals', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(780 * 1.5)).toBe(1170);
  });
});

describe('human date formatting for notification texts', () => {
  it('formats a single date as "26 Nov 2026" (no leading zero)', () => {
    expect(formatHumanDate('2026-11-26')).toBe('26 Nov 2026');
    expect(formatHumanDate('2026-01-05')).toBe('5 Jan 2026');
  });

  it('formats ranges compactly', () => {
    expect(formatDateRange('2026-11-26', '2026-11-26')).toBe('26 Nov 2026');
    expect(formatDateRange('2026-11-26', '2026-11-28')).toBe('26–28 Nov 2026');
    expect(formatDateRange('2026-11-26', '2026-12-02')).toBe('26 Nov – 2 Dec 2026');
    expect(formatDateRange('2026-12-28', '2027-01-02')).toBe('28 Dec 2026 – 2 Jan 2027');
  });
});
