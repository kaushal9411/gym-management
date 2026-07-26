import { z } from 'zod';

export const listNotificationsQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const notificationIdParamSchema = z.object({
  notificationId: z.string().uuid(),
});

const NOTIFICATION_CATEGORIES = ['ANNOUNCEMENT', 'SYSTEM', 'SUBSCRIPTION', 'GENERAL', 'MEMBER', 'MEMBERSHIP', 'PAYMENT', 'ATTENDANCE', 'WORKOUT', 'DIET', 'STAFF'] as const;

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
