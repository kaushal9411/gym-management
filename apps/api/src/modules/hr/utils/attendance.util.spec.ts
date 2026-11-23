import { describe, expect, it } from 'vitest';

import { checkInStatus, computedStatus, evaluateCheckOut, isPastShiftEnd, lateMinutesFor, summarizeDays } from './attendance.util';
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

describe('today is absent only AFTER the shift end', () => {
  // Monday 2026-11-23; IST 21:00 === 15:30Z
  const day = '2026-11-23';
  const base = { date: day, today: day, joiningDate: '2026-11-05', weeklyOff: new Set(['SUNDAY']), holidayName: null as string | null, shiftEndTime: '21:00' as string | null | undefined };
  const ist = (hm: string, sec = 0, ms = 0) => {
    const [h, m] = hm.split(':').map(Number) as [number, number];
    return new Date(Date.UTC(2026, 10, 23, h, m, sec, ms) - 330 * 60_000);
  };
  it('before the shift end => NOT_MARKED (yet to check in)', () => {
    expect(computedStatus({ ...base, now: ist('09:00') })).toBe('NOT_MARKED');
    expect(computedStatus({ ...base, now: ist('20:59', 59, 999) })).toBe('NOT_MARKED');
  });
  it('exactly at the shift end is NOT yet past; one millisecond later it is ABSENT', () => {
    expect(computedStatus({ ...base, now: ist('21:00') })).toBe('NOT_MARKED');
    expect(computedStatus({ ...base, now: ist('21:00', 0, 1) })).toBe('ABSENT');
    expect(isPastShiftEnd(ist('21:01'), day, '21:00')).toBe(true);
    expect(isPastShiftEnd(ist('21:00'), day, '21:00')).toBe(false);
  });
  it('no shift => never absent today', () => {
    expect(computedStatus({ ...base, shiftEndTime: null, now: ist('23:59') })).toBe('NOT_MARKED');
    expect(computedStatus({ ...base, shiftEndTime: undefined, now: ist('23:59') })).toBe('NOT_MARKED');
  });
  it('no clock given (legacy callers) => NOT_MARKED', () => {
    expect(computedStatus({ ...base })).toBe('NOT_MARKED');
  });
  it('weekly off and holiday win over absent after the shift end', () => {
    expect(computedStatus({ ...base, date: '2026-11-22', today: '2026-11-22', now: new Date('2026-11-22T20:00:00Z') })).toBe('WEEKLY_OFF');
    expect(computedStatus({ ...base, holidayName: 'Diwali', now: ist('23:00') })).toBe('HOLIDAY');
  });
  it('joining today is expected to work (absent after shift end); joining tomorrow is NOT_JOINED', () => {
    expect(computedStatus({ ...base, joiningDate: day, now: ist('21:30') })).toBe('ABSENT');
    expect(computedStatus({ ...base, joiningDate: '2026-11-24', now: ist('21:30') })).toBe('NOT_JOINED');
  });
  it('future days stay NOT_MARKED regardless of the clock', () => {
    expect(computedStatus({ ...base, date: '2026-11-24', now: ist('23:00') })).toBe('NOT_MARKED');
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
