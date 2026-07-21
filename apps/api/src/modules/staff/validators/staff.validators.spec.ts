import { describe, expect, it } from 'vitest';

import {
  assignBranchesSchema,
  bulkStaffActionSchema,
  createStaffSchema,
  updateStaffSchema,
} from './staff.validators';

describe('staff validators', () => {
  describe('createStaffSchema', () => {
    const base = {
      firstName: 'Dana',
      lastName: 'Lee',
      email: 'dana@example.com',
      role: 'TRAINER',
      primaryBranchId: '11111111-1111-1111-1111-111111111111',
    };

    it('accepts a minimal valid payload', () => {
      expect(createStaffSchema.safeParse(base).success).toBe(true);
    });

    it('rejects an unknown role (e.g. OWNER, MEMBER)', () => {
      expect(createStaffSchema.safeParse({ ...base, role: 'OWNER' }).success).toBe(false);
      expect(createStaffSchema.safeParse({ ...base, role: 'MEMBER' }).success).toBe(false);
    });

    it('rejects an employee ID with disallowed characters', () => {
      const result = createStaffSchema.safeParse({ ...base, employeeId: 'EMP #1' });
      expect(result.success).toBe(false);
    });

    it('accepts an employee ID with letters, numbers, and hyphens', () => {
      const result = createStaffSchema.safeParse({ ...base, employeeId: 'EMP-0007' });
      expect(result.success).toBe(true);
    });

    it('rejects a missing primary branch', () => {
      const { primaryBranchId: _omit, ...rest } = base;
      expect(createStaffSchema.safeParse(rest).success).toBe(false);
    });

    it('rejects an invalid phone number', () => {
      expect(createStaffSchema.safeParse({ ...base, phone: 'not-a-phone' }).success).toBe(false);
    });

    it('coerces a numeric salary amount and rejects a negative one', () => {
      expect(createStaffSchema.safeParse({ ...base, salaryAmount: '2500' }).success).toBe(true);
      expect(createStaffSchema.safeParse({ ...base, salaryAmount: -100 }).success).toBe(false);
    });
  });

  describe('updateStaffSchema', () => {
    it('rejects an empty body (nothing to update)', () => {
      expect(updateStaffSchema.safeParse({}).success).toBe(false);
    });

    it('allows explicit null to clear a nullable field', () => {
      expect(updateStaffSchema.safeParse({ notes: null }).success).toBe(true);
    });

    it('accepts a single-field partial update', () => {
      expect(updateStaffSchema.safeParse({ workStatus: 'ON_LEAVE' }).success).toBe(true);
    });
  });

  describe('assignBranchesSchema', () => {
    it('accepts a valid assignment', () => {
      const result = assignBranchesSchema.safeParse({
        primaryBranchId: '11111111-1111-1111-1111-111111111111',
        branchIds: ['11111111-1111-1111-1111-111111111111'],
      });
      expect(result.success).toBe(true);
    });

    it('rejects an empty branch list', () => {
      const result = assignBranchesSchema.safeParse({
        primaryBranchId: '11111111-1111-1111-1111-111111111111',
        branchIds: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('bulkStaffActionSchema', () => {
    it('rejects an empty userIds array', () => {
      expect(bulkStaffActionSchema.safeParse({ userIds: [] }).success).toBe(false);
    });

    it('accepts a non-empty userIds array', () => {
      expect(bulkStaffActionSchema.safeParse({ userIds: ['11111111-1111-1111-1111-111111111111'] }).success).toBe(true);
    });
  });
});
