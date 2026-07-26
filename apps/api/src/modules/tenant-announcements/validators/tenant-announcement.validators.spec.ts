import { describe, expect, it } from 'vitest';

import { createAnnouncementSchema, listAnnouncementsQuerySchema, scheduleAnnouncementSchema, updateAnnouncementSchema } from './tenant-announcement.validators';

describe('tenant announcement validators', () => {
  describe('createAnnouncementSchema', () => {
    it('applies the ALL audience default', () => {
      const result = createAnnouncementSchema.parse({ title: 'Pool closed', body: 'Closed for maintenance this weekend.' });
      expect(result.audience).toBe('ALL');
    });

    it('rejects an empty title', () => {
      expect(createAnnouncementSchema.safeParse({ title: '', body: 'x' }).success).toBe(false);
    });

    it('rejects an empty body', () => {
      expect(createAnnouncementSchema.safeParse({ title: 'x', body: '' }).success).toBe(false);
    });

    it('rejects a non-uuid branchId', () => {
      expect(createAnnouncementSchema.safeParse({ title: 'x', body: 'y', branchId: 'not-a-uuid' }).success).toBe(false);
    });

    it('accepts a fully populated input', () => {
      const result = createAnnouncementSchema.safeParse({
        title: 'Holiday hours',
        body: '<p>We close early on the 25th.</p>',
        audience: 'MEMBERS',
        branchId: '11111111-1111-1111-1111-111111111111',
        expiresAt: '2026-12-31',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('updateAnnouncementSchema', () => {
    it('makes every field optional', () => {
      expect(updateAnnouncementSchema.safeParse({}).success).toBe(true);
    });
  });

  describe('scheduleAnnouncementSchema', () => {
    it('rejects a past date', () => {
      expect(scheduleAnnouncementSchema.safeParse({ publishAt: '2020-01-01T00:00:00.000Z' }).success).toBe(false);
    });

    it('rejects an unparseable date', () => {
      expect(scheduleAnnouncementSchema.safeParse({ publishAt: 'not-a-date' }).success).toBe(false);
    });

    it('accepts a future date', () => {
      const future = new Date(Date.now() + 86_400_000).toISOString();
      expect(scheduleAnnouncementSchema.safeParse({ publishAt: future }).success).toBe(true);
    });
  });

  describe('listAnnouncementsQuerySchema', () => {
    it('applies pagination defaults', () => {
      const result = listAnnouncementsQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('rejects an invalid status', () => {
      expect(listAnnouncementsQuerySchema.safeParse({ status: 'BOGUS' }).success).toBe(false);
    });
  });
});
