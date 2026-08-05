import { z } from 'zod';

const JOB_CATEGORIES = ['MEMBERSHIP', 'ATTENDANCE', 'PAYMENT', 'NOTIFICATION', 'REPORT', 'MAINTENANCE', 'CLASS'] as const;
const JOB_RUN_STATUSES = ['PENDING', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED'] as const;

export const listJobsQuerySchema = z.object({
  category: z.enum(JOB_CATEGORIES).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const jobHistoryQuerySchema = z.object({
  jobName: z.string().trim().min(1).max(100).optional(),
  status: z.enum(JOB_RUN_STATUSES).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const jobNameParamSchema = z.object({ name: z.string().trim().min(1).max(100) });
export const queueNameParamSchema = z.object({ queueName: z.string().trim().min(1).max(60) });
