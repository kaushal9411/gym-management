import { describe, expect, it } from 'vitest';

import {
  bulkMemberActionSchema,
  createMemberSchema,
  createMembershipPlanSchema,
  extendMembershipSchema,
  updateMemberSchema,
  updateMembershipPlanSchema,
  uploadMemberDocumentSchema,
} from './member.validators';

describe('member validators', () => {
  describe('createMemberSchema', () => {
    const base = {
      firstName: 'Jamie',
      lastName: 'Rivera',
      branchId: '11111111-1111-1111-1111-111111111111',
    };

    it('accepts a minimal valid payload', () => {
      expect(createMemberSchema.safeParse(base).success).toBe(true);
    });

    it('rejects a missing branch', () => {
      const { branchId: _omit, ...rest } = base;
      expect(createMemberSchema.safeParse(rest).success).toBe(false);
    });

    it('rejects a member ID with disallowed characters', () => {
      expect(createMemberSchema.safeParse({ ...base, memberId: 'MEM #1' }).success).toBe(false);
    });

    it('accepts a member ID with letters, numbers, and hyphens', () => {
      expect(createMemberSchema.safeParse({ ...base, memberId: 'MEM-0007' }).success).toBe(true);
    });

    it('rejects an invalid email', () => {
      expect(createMemberSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false);
    });

    it('rejects an out-of-range height/weight', () => {
      expect(createMemberSchema.safeParse({ ...base, height: 500 }).success).toBe(false);
      expect(createMemberSchema.safeParse({ ...base, weight: -1 }).success).toBe(false);
    });

    it('accepts a valid blood group', () => {
      expect(createMemberSchema.safeParse({ ...base, bloodGroup: 'O_POSITIVE' }).success).toBe(true);
    });

    it('rejects an unknown blood group', () => {
      expect(createMemberSchema.safeParse({ ...base, bloodGroup: 'O+' }).success).toBe(false);
    });
  });

  describe('updateMemberSchema', () => {
    it('rejects an empty body (nothing to update)', () => {
      expect(updateMemberSchema.safeParse({}).success).toBe(false);
    });

    it('allows explicit null to clear a nullable field', () => {
      expect(updateMemberSchema.safeParse({ email: null }).success).toBe(true);
    });

    it('accepts a single-field partial update', () => {
      expect(updateMemberSchema.safeParse({ fitnessGoals: 'Lose 5kg' }).success).toBe(true);
    });
  });

  describe('uploadMemberDocumentSchema', () => {
    const validDataUrl = 'data:application/pdf;base64,JVBERi0xLjQK';

    it('accepts a valid document payload', () => {
      const result = uploadMemberDocumentSchema.safeParse({
        type: 'IDENTITY_PROOF',
        fileName: 'passport.pdf',
        fileDataUrl: validDataUrl,
      });
      expect(result.success).toBe(true);
    });

    it('rejects a non data-URL value', () => {
      const result = uploadMemberDocumentSchema.safeParse({
        type: 'IDENTITY_PROOF',
        fileName: 'passport.pdf',
        fileDataUrl: 'not-a-data-url',
      });
      expect(result.success).toBe(false);
    });

    it('rejects an unknown document type', () => {
      const result = uploadMemberDocumentSchema.safeParse({
        type: 'PASSPORT',
        fileName: 'passport.pdf',
        fileDataUrl: validDataUrl,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('bulkMemberActionSchema', () => {
    it('rejects an empty memberIds array', () => {
      expect(bulkMemberActionSchema.safeParse({ memberIds: [] }).success).toBe(false);
    });

    it('accepts a non-empty memberIds array', () => {
      expect(bulkMemberActionSchema.safeParse({ memberIds: ['11111111-1111-1111-1111-111111111111'] }).success).toBe(true);
    });
  });

  describe('createMembershipPlanSchema', () => {
    const base = { name: 'Annual Gold', durationValue: 12, durationType: 'MONTHS' as const, price: 499 };

    it('accepts a valid plan', () => {
      expect(createMembershipPlanSchema.safeParse(base).success).toBe(true);
    });

    it('rejects a non-positive duration value', () => {
      expect(createMembershipPlanSchema.safeParse({ ...base, durationValue: 0 }).success).toBe(false);
    });

    it('rejects an invalid duration type', () => {
      expect(createMembershipPlanSchema.safeParse({ ...base, durationType: 'FORTNIGHTS' }).success).toBe(false);
    });

    it('rejects a negative price', () => {
      expect(createMembershipPlanSchema.safeParse({ ...base, price: -5 }).success).toBe(false);
    });

    it('rejects a plan code with disallowed characters', () => {
      expect(createMembershipPlanSchema.safeParse({ ...base, planCode: 'PLAN #1' }).success).toBe(false);
    });

    it('accepts a plan code with letters, numbers, and hyphens', () => {
      expect(createMembershipPlanSchema.safeParse({ ...base, planCode: 'PLAN-0007' }).success).toBe(true);
    });

    it('rejects minAge greater than maxAge', () => {
      expect(createMembershipPlanSchema.safeParse({ ...base, minAge: 40, maxAge: 18 }).success).toBe(false);
    });

    it('accepts minAge less than or equal to maxAge', () => {
      expect(createMembershipPlanSchema.safeParse({ ...base, minAge: 18, maxAge: 65 }).success).toBe(true);
    });

    it('accepts feature fields', () => {
      const result = createMembershipPlanSchema.safeParse({
        ...base,
        ptSessionsIncluded: 4,
        lockerAccess: true,
        freezeAllowed: true,
        freezeDaysLimit: 30,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('updateMembershipPlanSchema', () => {
    it('rejects an empty body (nothing to update)', () => {
      expect(updateMembershipPlanSchema.safeParse({}).success).toBe(false);
    });

    it('allows explicit null to clear a nullable field', () => {
      expect(updateMembershipPlanSchema.safeParse({ description: null }).success).toBe(true);
    });

    it('accepts a status-only toggle', () => {
      expect(updateMembershipPlanSchema.safeParse({ isActive: false }).success).toBe(true);
    });
  });

  describe('extendMembershipSchema', () => {
    it('rejects a non-positive day count', () => {
      expect(extendMembershipSchema.safeParse({ days: 0 }).success).toBe(false);
    });

    it('accepts a positive day count with an optional reason', () => {
      expect(extendMembershipSchema.safeParse({ days: 15, reason: 'Gym closed for renovation' }).success).toBe(true);
    });
  });
});
