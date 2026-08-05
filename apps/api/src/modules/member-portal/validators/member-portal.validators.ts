import { z } from 'zod';

export const memberPortalPaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const memberWorkoutProgressSchema = z.object({
  exerciseId: z.string().uuid('Invalid exercise id'),
  status: z.enum(['PENDING', 'COMPLETED', 'SKIPPED']),
  notes: z.string().max(500).optional(),
});

export const memberDietLogSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  waterIntakeMl: z.coerce.number().int().nonnegative().optional(),
  weightKg: z.coerce.number().positive().optional(),
  mealsStatus: z.record(z.enum(['PENDING', 'COMPLETED', 'SKIPPED'])).optional(),
  notes: z.string().max(500).optional(),
});

export const memberPortalIdParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

export const memberPortalClassesQuerySchema = z.object({
  dateFrom: z.string().min(1, 'dateFrom is required'),
  dateTo: z.string().min(1, 'dateTo is required'),
});
