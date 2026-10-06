import { z } from 'zod';

import { isoDay } from '../../finance/validators/finance.validators';

const NOTIFICATION_CATEGORIES = [
  'ANNOUNCEMENT',
  'SYSTEM',
  'SUBSCRIPTION',
  'GENERAL',
  'MEMBER',
  'MEMBERSHIP',
  'PAYMENT',
  'ATTENDANCE',
  'WORKOUT',
  'DIET',
  'STAFF',
] as const;

export const listNotificationsQuerySchema = z.object({
  unreadOnly: z.preprocess((v) => (v === 'false' ? false : v), z.coerce.boolean().optional()),
  category: z.enum(NOTIFICATION_CATEGORIES).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const notificationIdParamSchema = z.object({
  notificationId: z.string().uuid(),
});

export const createNotificationSchema = z.object({
  category: z.enum(NOTIFICATION_CATEGORIES).default('GENERAL'),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1),
});

const TEMPLATE_TYPES = [
  'MEMBERSHIP_EXPIRY',
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
  'MEMBERSHIP_RENEWAL',
  'NEW_MEMBER_REGISTRATION',
  'ATTENDANCE_CONFIRMATION',
  'WORKOUT_ASSIGNMENT',
  'DIET_ASSIGNMENT',
  'WELCOME_MESSAGE',
  'BIRTHDAY_WISHES',
] as const;

export const templateTypeParamSchema = z.object({
  type: z.enum(TEMPLATE_TYPES),
});

export const updateTemplateSchema = z.object({
  channels: z.array(z.enum(['IN_APP', 'EMAIL', 'PUSH', 'SMS', 'WHATSAPP'])).min(1),
  titleTemplate: z.string().trim().min(1).max(200),
  bodyTemplate: z.string().trim().min(1),
  isActive: z.boolean().default(true),
});

const DELIVERY_CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP'] as const;
const DELIVERY_STATUSES = ['SENT', 'FAILED', 'SKIPPED_DISABLED', 'SKIPPED_QUOTA'] as const;

export const listMessageLogQuerySchema = z.object({
  channel: z.enum(DELIVERY_CHANNELS).optional(),
  status: z.enum(DELIVERY_STATUSES).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const notificationStatsQuerySchema = z
  .object({ dateFrom: isoDay.optional(), dateTo: isoDay.optional() })
  .refine((v) => !v.dateFrom || !v.dateTo || v.dateFrom <= v.dateTo, {
    message: 'dateFrom must be on or before dateTo.',
    path: ['dateFrom'],
  })
  .refine(
    (v) =>
      !v.dateFrom ||
      !v.dateTo ||
      (new Date(`${v.dateTo}T00:00:00Z`).getTime() -
        new Date(`${v.dateFrom}T00:00:00Z`).getTime()) /
        86_400_000 <
        366,
    {
      message: 'Range may not exceed 366 days.',
      path: ['dateTo'],
    },
  );
