import { describe, expect, it } from 'vitest';

import { createBodyMeasurementSchema, idParamSchema, memberIdParamSchema, updateBodyMeasurementSchema } from './measurement.validators';

describe('measurement validators', () => {
  describe('createBodyMeasurementSchema', () => {
    it('accepts an empty payload (every field optional)', () => {
      expect(createBodyMeasurementSchema.safeParse({}).success).toBe(true);
    });

    it('accepts a full payload', () => {
      const result = createBodyMeasurementSchema.safeParse({
        recordedAt: '2026-09-01T00:00:00.000Z',
        weightKg: 78.5,
        heightCm: 178,
        bodyFatPercent: 18.2,
        chestCm: 102,
        waistCm: 84,
        hipsCm: 98,
        bicepsCm: 36,
        thighsCm: 58,
        notes: 'Post-summer check-in',
      });
      expect(result.success).toBe(true);
    });

    it('rejects a non-positive weight', () => {
      expect(createBodyMeasurementSchema.safeParse({ weightKg: 0 }).success).toBe(false);
      expect(createBodyMeasurementSchema.safeParse({ weightKg: -5 }).success).toBe(false);
    });

    it('rejects an obviously wrong weight (typo guard)', () => {
      expect(createBodyMeasurementSchema.safeParse({ weightKg: 1750 }).success).toBe(false);
    });

    it('rejects a body-fat percentage over 80', () => {
      expect(createBodyMeasurementSchema.safeParse({ bodyFatPercent: 95 }).success).toBe(false);
    });

    it('rejects notes over 1000 chars', () => {
      expect(createBodyMeasurementSchema.safeParse({ notes: 'a'.repeat(1001) }).success).toBe(false);
    });
  });

  describe('updateBodyMeasurementSchema', () => {
    it('accepts an empty payload (partial update)', () => {
      expect(updateBodyMeasurementSchema.safeParse({}).success).toBe(true);
    });

    it('accepts a single-field update', () => {
      expect(updateBodyMeasurementSchema.safeParse({ waistCm: 82 }).success).toBe(true);
    });
  });

  describe('param schemas', () => {
    it('idParamSchema requires a UUID', () => {
      expect(idParamSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
      expect(idParamSchema.safeParse({ id: '11111111-1111-1111-1111-111111111111' }).success).toBe(true);
    });

    it('memberIdParamSchema requires a UUID', () => {
      expect(memberIdParamSchema.safeParse({ memberId: 'not-a-uuid' }).success).toBe(false);
    });
  });
});
