import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const notificationIdParamSchema = z.object({
  notificationId: z.string().uuid(),
});
