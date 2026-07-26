import { describe, expect, it } from 'vitest';

import { createBranchSchema, listBranchesQuerySchema, updateBranchSchema } from './branch.validators';

describe('branch validators', () => {
  describe('listBranchesQuerySchema', () => {
    it('applies pagination + sort defaults', () => {
      const result = listBranchesQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.sortBy).toBe('name');
      expect(result.sortDir).toBe('asc');
      expect(result.includeDeleted).toBe(false);
    });

    it('rejects a limit above the max page size', () => {
      expect(listBranchesQuerySchema.safeParse({ limit: 500 }).success).toBe(false);
    });
  });

  describe('createBranchSchema', () => {
    it('accepts a minimal input (just a name)', () => {
      expect(createBranchSchema.safeParse({ name: 'Downtown Branch' }).success).toBe(true);
    });

    it('rejects an empty name', () => {
      expect(createBranchSchema.safeParse({ name: '' }).success).toBe(false);
    });

    it('rejects a branch code with invalid characters', () => {
      expect(createBranchSchema.safeParse({ name: 'x', branchCode: 'BR 0001!' }).success).toBe(false);
    });

    it('accepts a valid branch code', () => {
      expect(createBranchSchema.safeParse({ name: 'x', branchCode: 'BR-0002' }).success).toBe(true);
    });

    it('rejects an out-of-range latitude/longitude', () => {
      expect(createBranchSchema.safeParse({ name: 'x', latitude: 200 }).success).toBe(false);
      expect(createBranchSchema.safeParse({ name: 'x', longitude: -200 }).success).toBe(false);
    });

    it('accepts a fully populated input including operating hours and holidays', () => {
      const result = createBranchSchema.safeParse({
        name: 'Downtown Branch',
        email: 'downtown@gym.com',
        phone: '+15551234567',
        city: 'Springfield',
        latitude: 37.774_929,
        longitude: -122.419_416,
        operatingHours: { monday: { open: '06:00', close: '22:00', closed: false }, sunday: { closed: true } },
        holidays: [{ date: '2026-12-25', label: 'Christmas' }],
        capacity: 200,
        maxMembers: 500,
        maxStaff: 20,
        allowCheckIn: true,
      });
      expect(result.success).toBe(true);
    });

    it('rejects a holiday with a malformed date', () => {
      expect(createBranchSchema.safeParse({ name: 'x', holidays: [{ date: '25-12-2026' }] }).success).toBe(false);
    });
  });

  describe('updateBranchSchema', () => {
    it('makes every field optional', () => {
      expect(updateBranchSchema.safeParse({}).success).toBe(true);
    });
  });
});
