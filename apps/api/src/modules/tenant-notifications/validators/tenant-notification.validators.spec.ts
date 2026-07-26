import { describe, expect, it } from 'vitest';

import { createNotificationSchema, listNotificationsQuerySchema, notificationIdParamSchema, templateTypeParamSchema, updateTemplateSchema } from './tenant-notification.validators';

describe('tenant notification validators', () => {
  describe('listNotificationsQuerySchema', () => {
    it('applies pagination defaults', () => {
      const result = listNotificationsQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('rejects a limit above the max page size', () => {
      expect(listNotificationsQuerySchema.safeParse({ limit: 500 }).success).toBe(false);
    });
  });

  describe('notificationIdParamSchema', () => {
    it('rejects a non-uuid id', () => {
      expect(notificationIdParamSchema.safeParse({ notificationId: 'not-a-uuid' }).success).toBe(false);
    });
  });

  describe('createNotificationSchema', () => {
    it('applies the GENERAL category default', () => {
      const result = createNotificationSchema.parse({ title: 'Heads up', body: 'The pool is closed today.' });
      expect(result.category).toBe('GENERAL');
    });

    it('rejects an empty title', () => {
      expect(createNotificationSchema.safeParse({ title: '', body: 'x' }).success).toBe(false);
    });

    it('rejects an invalid category', () => {
      expect(createNotificationSchema.safeParse({ title: 'x', body: 'y', category: 'BOGUS' }).success).toBe(false);
    });

    it('accepts every new business-event category', () => {
      for (const category of ['MEMBER', 'MEMBERSHIP', 'PAYMENT', 'ATTENDANCE', 'WORKOUT', 'DIET', 'STAFF']) {
        expect(createNotificationSchema.safeParse({ title: 'x', body: 'y', category }).success).toBe(true);
      }
    });
  });

  describe('templateTypeParamSchema', () => {
    it('accepts a known template type', () => {
      expect(templateTypeParamSchema.safeParse({ type: 'PAYMENT_SUCCESS' }).success).toBe(true);
    });

    it('rejects an unknown template type', () => {
      expect(templateTypeParamSchema.safeParse({ type: 'BOGUS' }).success).toBe(false);
    });
  });

  describe('updateTemplateSchema', () => {
    it('rejects an empty channels array', () => {
      expect(updateTemplateSchema.safeParse({ channels: [], titleTemplate: 'x', bodyTemplate: 'y' }).success).toBe(false);
    });

    it('defaults isActive to true', () => {
      const result = updateTemplateSchema.parse({ channels: ['IN_APP'], titleTemplate: 'x', bodyTemplate: 'y' });
      expect(result.isActive).toBe(true);
    });
  });
});
