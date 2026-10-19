import { describe, expect, it } from 'vitest';

import {
  memberWorkoutCompleteSchema,
  memberWorkoutDayParamSchema,
  memberWorkoutHistoryQuerySchema,
  memberWorkoutLogSchema,
  memberWorkoutLogUpdateSchema,
} from './member-workout-log.validators';

const EX = '11111111-1111-4111-8111-111111111111';

describe('memberWorkoutLogSchema', () => {
  it('accepts a bare Done / Skip tap', () => {
    expect(memberWorkoutLogSchema.safeParse({ exerciseId: EX, status: 'COMPLETED' }).success).toBe(true);
    expect(memberWorkoutLogSchema.safeParse({ exerciseId: EX, status: 'SKIPPED' }).success).toBe(true);
  });

  it('accepts details, a date and a note on a completed exercise', () => {
    const r = memberWorkoutLogSchema.safeParse({
      exerciseId: EX,
      date: '2026-10-19',
      status: 'COMPLETED',
      setsDone: 4,
      repsDone: 10,
      weightKg: 42.5,
      durationMin: 12,
      notes: '  felt strong ',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.notes).toBe('felt strong');
  });

  it('is strict: no source / memberId / unknown keys', () => {
    expect(memberWorkoutLogSchema.safeParse({ exerciseId: EX, status: 'COMPLETED', memberId: EX }).success).toBe(false);
    expect(memberWorkoutLogSchema.safeParse({ exerciseId: EX, status: 'COMPLETED', source: 'STAFF' }).success).toBe(false);
  });

  it('requires a uuid exercise and a valid status; PENDING is not loggable', () => {
    expect(memberWorkoutLogSchema.safeParse({ exerciseId: 'x', status: 'COMPLETED' }).success).toBe(false);
    expect(memberWorkoutLogSchema.safeParse({ exerciseId: EX, status: 'PENDING' }).success).toBe(false);
    expect(memberWorkoutLogSchema.safeParse({ exerciseId: EX }).success).toBe(false);
  });

  it.each([
    ['setsDone', 0],
    ['setsDone', 101],
    ['setsDone', 2.5],
    ['repsDone', 0],
    ['repsDone', 1001],
    ['weightKg', 0],
    ['weightKg', -5],
    ['weightKg', 1001],
    ['durationMin', 0],
    ['durationMin', 601],
  ])('rejects %s = %s', (key, value) => {
    expect(memberWorkoutLogSchema.safeParse({ exerciseId: EX, status: 'COMPLETED', [key]: value }).success).toBe(false);
  });

  it('rejects details on a skipped exercise but allows a note', () => {
    expect(memberWorkoutLogSchema.safeParse({ exerciseId: EX, status: 'SKIPPED', weightKg: 10 }).success).toBe(false);
    expect(memberWorkoutLogSchema.safeParse({ exerciseId: EX, status: 'SKIPPED', setsDone: null, notes: 'knee pain' }).success).toBe(true);
  });

  it('rejects malformed dates and over-long notes', () => {
    expect(memberWorkoutLogSchema.safeParse({ exerciseId: EX, status: 'COMPLETED', date: '19/10/2026' }).success).toBe(false);
    expect(memberWorkoutLogSchema.safeParse({ exerciseId: EX, status: 'COMPLETED', notes: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('memberWorkoutLogUpdateSchema', () => {
  it('accepts any subset, including null to clear', () => {
    expect(memberWorkoutLogUpdateSchema.safeParse({ weightKg: 50 }).success).toBe(true);
    expect(memberWorkoutLogUpdateSchema.safeParse({ weightKg: null, notes: null }).success).toBe(true);
    expect(memberWorkoutLogUpdateSchema.safeParse({ status: 'SKIPPED' }).success).toBe(true);
  });

  it('rejects an empty body, date / exercise changes, unknown keys', () => {
    expect(memberWorkoutLogUpdateSchema.safeParse({}).success).toBe(false);
    expect(memberWorkoutLogUpdateSchema.safeParse({ date: '2026-10-19' }).success).toBe(false);
    expect(memberWorkoutLogUpdateSchema.safeParse({ exerciseId: EX }).success).toBe(false);
  });

  it('rejects SKIPPED together with details', () => {
    expect(memberWorkoutLogUpdateSchema.safeParse({ status: 'SKIPPED', repsDone: 8 }).success).toBe(false);
  });
});

describe('memberWorkoutCompleteSchema', () => {
  it('accepts an empty body (plain Complete workout)', () => {
    expect(memberWorkoutCompleteSchema.safeParse({}).success).toBe(true);
  });

  it('accepts duration, effort 1-5, note and a date', () => {
    expect(memberWorkoutCompleteSchema.safeParse({ date: '2026-10-19', durationMin: 55, effort: 5, notes: 'good' }).success).toBe(true);
  });

  it.each([[{ effort: 0 }], [{ effort: 6 }], [{ effort: 2.5 }], [{ durationMin: 0 }], [{ durationMin: 601 }], [{ foo: 1 }]])('rejects %j', (body) => {
    expect(memberWorkoutCompleteSchema.safeParse(body).success).toBe(false);
  });
});

describe('query / params', () => {
  it('history days defaults to 60 and is capped at 120', () => {
    expect(memberWorkoutHistoryQuerySchema.parse({}).days).toBe(60);
    expect(memberWorkoutHistoryQuerySchema.parse({ days: '30' }).days).toBe(30);
    expect(memberWorkoutHistoryQuerySchema.safeParse({ days: '121' }).success).toBe(false);
    expect(memberWorkoutHistoryQuerySchema.safeParse({ days: '0' }).success).toBe(false);
  });

  it('day param must be YYYY-MM-DD', () => {
    expect(memberWorkoutDayParamSchema.safeParse({ date: '2026-10-19' }).success).toBe(true);
    expect(memberWorkoutDayParamSchema.safeParse({ date: 'today' }).success).toBe(false);
  });
});
