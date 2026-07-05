import { z } from 'zod';

const AUDIENCE = ['ALL', 'TRIAL', 'ACTIVE', 'SPECIFIC'] as const;

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1),
  audience: z.enum(AUDIENCE).default('ALL'),
  expiresAt: z.coerce.date().optional(),
});

export const setAnnouncementActiveSchema = z.object({ isActive: z.boolean() });

export const createNotificationSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1),
  channel: z.enum(['EMAIL', 'PUSH', 'IN_APP']).default('EMAIL'),
  audience: z.enum(AUDIENCE).default('ALL'),
  scheduledAt: z.coerce.date().optional(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });
