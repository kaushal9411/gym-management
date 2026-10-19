import { describe, expect, it } from 'vitest';

import { dayOfRecordedAt, resolveMemberMeasurementDay } from '../utils/member-measurement.util';

import { memberCreateMeasurementSchema, memberUpdateMeasurementSchema } from './member-portal.validators';

describe('memberCreateMeasurementSchema', () => {
  it('accepts a quick weight log', () => {
    expect(memberCreateMeasurementSchema.safeParse({ weightKg: 72.4 }).success).toBe(true);
  });

  it('accepts a full check-in with a date and notes', () => {
    const r = memberCreateMeasurementSchema.safeParse({
      recordedAt: '2026-10-18T00:00:00.000Z',
      weightKg: 72,
      heightCm: 175,
      bodyFatPercent: 18.5,
      chestCm: 100,
      waistCm: 82,
      hipsCm: 95,
      bicepsCm: 33,
      thighsCm: 55,
      notes: 'Morning, fasted',
    });
    expect(r.success).toBe(true);
  });

  it('requires at least one numeric value (notes/date alone is not enough)', () => {
    expect(memberCreateMeasurementSchema.safeParse({}).success).toBe(false);
    expect(memberCreateMeasurementSchema.safeParse({ notes: 'hi', recordedAt: '2026-10-18' }).success).toBe(false);
  });

  it.each([
    ['weightKg', 0],
    ['weightKg', 501],
    ['heightCm', 301],
    ['bodyFatPercent', 81],
    ['bodyFatPercent', -1],
    ['chestCm', 301],
    ['waistCm', 0],
    ['hipsCm', 301],
    ['bicepsCm', 151],
    ['thighsCm', 201],
  ])('rejects %s = %s (same bounds as the staff validators)', (field, value) => {
    const r = memberCreateMeasurementSchema.safeParse({ weightKg: 70, [field]: value });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.path).toContain(field);
  });

  it('accepts body fat of exactly 0', () => {
    expect(memberCreateMeasurementSchema.safeParse({ bodyFatPercent: 0 }).success).toBe(true);
  });

  it('rejects unknown keys so a client cannot set source / recordedBy / memberId', () => {
    expect(memberCreateMeasurementSchema.safeParse({ weightKg: 70, source: 'STAFF' }).success).toBe(false);
    expect(memberCreateMeasurementSchema.safeParse({ weightKg: 70, recordedBy: 'x' }).success).toBe(false);
    expect(memberCreateMeasurementSchema.safeParse({ weightKg: 70, memberId: 'x' }).success).toBe(false);
  });

  it('rejects an unparseable date and over-long notes', () => {
    expect(memberCreateMeasurementSchema.safeParse({ weightKg: 70, recordedAt: 'yesterday' }).success).toBe(false);
    expect(memberCreateMeasurementSchema.safeParse({ weightKg: 70, notes: 'x'.repeat(1001) }).success).toBe(false);
  });
});

describe('memberUpdateMeasurementSchema', () => {
  it('accepts any subset', () => {
    expect(memberUpdateMeasurementSchema.safeParse({ waistCm: 80 }).success).toBe(true);
    expect(memberUpdateMeasurementSchema.safeParse({ notes: 'edited' }).success).toBe(true);
  });

  it('rejects an empty body, out-of-range values and unknown keys', () => {
    expect(memberUpdateMeasurementSchema.safeParse({}).success).toBe(false);
    expect(memberUpdateMeasurementSchema.safeParse({ weightKg: 900 }).success).toBe(false);
    expect(memberUpdateMeasurementSchema.safeParse({ source: 'MEMBER' }).success).toBe(false);
  });
});

describe('dayOfRecordedAt / resolveMemberMeasurementDay', () => {
  it('reads the leading date of a UTC-midnight timestamp (so west-of-UTC clients keep their day)', () => {
    expect(dayOfRecordedAt('2026-10-18T00:00:00.000Z')).toBe('2026-10-18');
    expect(dayOfRecordedAt('2026-10-18')).toBe('2026-10-18');
  });

  it('rejects impossible calendar dates', () => {
    expect(dayOfRecordedAt('2026-02-31')).toBeNull();
    expect(dayOfRecordedAt('nope')).toBeNull();
  });

  it('defaults to today, rejects tomorrow, accepts exactly 365 days back and rejects 366', () => {
    const today = '2026-10-19';
    expect(resolveMemberMeasurementDay(undefined, today).day).toBe(today);
    expect(() => resolveMemberMeasurementDay('2026-10-20', today)).toThrow(/future/i);
    expect(resolveMemberMeasurementDay('2025-10-19', today).day).toBe('2025-10-19');
    expect(() => resolveMemberMeasurementDay('2025-10-18', today)).toThrow(/365/);
  });

  it('stores UTC midnight', () => {
    expect(resolveMemberMeasurementDay('2026-10-18T05:30:00+05:30', '2026-10-19').date.toISOString()).toBe('2026-10-18T00:00:00.000Z');
  });
});
