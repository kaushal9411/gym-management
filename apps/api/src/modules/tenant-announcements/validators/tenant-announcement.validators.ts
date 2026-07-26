import { z } from 'zod';

export const idParamSchema = z.object({ id: z.string().uuid() });

const AUDIENCES = ['ALL', 'MEMBERS', 'STAFF'] as const;
const STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'EXPIRED'] as const;

export const listAnnouncementsQuerySchema = z.object({
  status: z.enum(STATUSES).optional(),
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
  publishAt: z.string().trim().refine((v) => !Number.isNaN(new Date(v).getTime()) && new Date(v).getTime() > Date.now(), {
    message: 'publishAt must be a valid date in the future.',
  }),
});
