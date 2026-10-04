import { z } from 'zod';

import { isoDay } from '../../finance/validators/finance.validators';

export const idParamSchema = z.object({ id: z.string().uuid() });

const AUDIENCES = ['ALL', 'MEMBERS', 'STAFF'] as const;
const STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'EXPIRED'] as const;

export const listAnnouncementsQuerySchema = z.object({
  status: z.enum(STATUSES).optional(),
  audience: z.enum(AUDIENCES).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1),
  audience: z.enum(AUDIENCES).default('ALL'),
  branchId: z.string().uuid().optional(),
  expiresAt: z.string().trim().optional(),
});

export const updateAnnouncementSchema = createAnnouncementSchema.partial();

export const scheduleAnnouncementSchema = z.object({
  publishAt: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(new Date(v).getTime()) && new Date(v).getTime() > Date.now(), {
      message: 'publishAt must be a valid date in the future.',
    }),
});

export const announcementStatsQuerySchema = z
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
