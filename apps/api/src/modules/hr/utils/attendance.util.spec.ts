import { describe, expect, it } from 'vitest';

import { checkInStatus, computedStatus, evaluateCheckOut, lateMinutesFor, summarizeDays } from './attendance.util';
import { istInstant } from './hr-dates.util';

const shift = { startTime: '06:00', endTime: '21:00', graceMinutes: 10 };
const policy = { halfDayThresholdHours: 4, standardDayHours: 8 };

describe('lateness against shift + grace (IST)', () => {
  it('is on time up to the grace minute and late after it', () => {
    expect(lateMinutesFor(istInstant('2026-11-23', '06:10'), shift)).toBe(0);
    expect(lateMinutesFor(istInstant('2026-11-23', '06:11'), shift)).toBe(1);
    expect(lateMinutesFor(istInstant('2026-11-23', '09:00'), shift)).toBe(170);
  });
  it('nobody is late without a shift', () => {
    expect(lateMinutesFor(istInstant('2026-11-23', '23:00'), null)).toBe(0);
  });
  it('maps minutes to PRESENT / LATE', () => {
    expect(checkInStatus(0)).toBe('PRESENT');
    expect(checkInStatus(5)).toBe('LATE');
  });
});

describe('check-out evaluation', () => {
  const inAt = istInstant('2026-11-23', '06:00');
  it('a full day is PRESENT with overtime beyond the standard hours', () => {
    const r = evaluateCheckOut(inAt, istInstant('2026-11-23', '15:00'), 0, policy);
    expect(r).toEqual({ workedMinutes: 540, status: 'PRESENT', overtimeMinutes: 60 });
  });
  it('under the half-day threshold becomes HALF_DAY', () => {
    expect(evaluateCheckOut(inAt, istInstant('2026-11-23', '09:59'), 0, policy).status).toBe('HALF_DAY');
    expect(evaluateCheckOut(inAt, istInstant('2026-11-23', '10:00'), 0, policy).status).toBe('PRESENT');
  });
  it('keeps LATE when the day was long enough', () => {
    expect(evaluateCheckOut(istInstant('2026-11-23', '07:00'), istInstant('2026-11-23', '16:00'), 50, policy).status).toBe('LATE');
  });
  it('zero-length shifts do not go negative', () => {
    expect(evaluateCheckOut(inAt, inAt, 0, policy).workedMinutes).toBe(0);
  });
});

describe('computed day status (absent is computed on read)', () => {
  const base = { today: '2026-11-22', joiningDate: '2026-11-05', weeklyOff: new Set(['SUNDAY']), holidayName: null };
  it('before joining => NOT_JOINED', () => expect(computedStatus({ ...base, date: '2026-11-04' })).toBe('NOT_JOINED'));
  it('weekly off wins over absent', () => expect(computedStatus({ ...base, date: '2026-11-08' })).toBe('WEEKLY_OFF'));
  it('holiday', () => expect(computedStatus({ ...base, date: '2026-11-10', holidayName: 'Diwali' })).toBe('HOLIDAY'));
  it('a past working day with no row is ABSENT', () => expect(computedStatus({ ...base, date: '2026-11-10' })).toBe('ABSENT'));
  it('today and the future with no row are NOT_MARKED, never ABSENT', () => {
    expect(computedStatus({ ...base, today: '2026-11-23', date: '2026-11-23' })).toBe('NOT_MARKED');
    expect(computedStatus({ ...base, date: '2026-11-25' })).toBe('NOT_MARKED');
  });
});

describe('summarizeDays', () => {
  it('counts statuses, late days and minutes', () => {
    const s = summarizeDays([
      { status: 'PRESENT', workedMinutes: 480 },
      { status: 'LATE', workedMinutes: 450, overtimeMinutes: 10 },
      { status: 'HALF_DAY' },
      { status: 'ABSENT' },
      { status: 'NOT_JOINED' },
      { status: 'WEEKLY_OFF' },
    ]);
    expect(s).toMatchObject({ present: 1, late: 1, lateCount: 1, halfDay: 1, absent: 1, weeklyOff: 1, workedMinutes: 930, overtimeMinutes: 10 });
  });
});
