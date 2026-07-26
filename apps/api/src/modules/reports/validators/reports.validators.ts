import { z } from 'zod';

import { REPORT_TYPES } from '../dto/reports.dto';

export const idParamSchema = z.object({ id: z.string().uuid() });

export const reportFiltersQuerySchema = z.object({
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  branchId: z.string().uuid().optional(),
  planId: z.string().uuid().optional(),
  trainerId: z.string().uuid().optional(),
  paymentStatus: z.string().trim().optional(),
  memberStatus: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
});

export const trendQuerySchema = z.object({
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  branchId: z.string().uuid().optional(),
});

export const exportQuerySchema = z.object({
  format: z.enum(['csv', 'xlsx', 'pdf']),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  branchId: z.string().uuid().optional(),
  planId: z.string().uuid().optional(),
  trainerId: z.string().uuid().optional(),
  paymentStatus: z.string().trim().optional(),
  memberStatus: z.string().trim().optional(),
});

export const reportTypeParamSchema = z.object({
  reportType: z.enum(REPORT_TYPES),
});

const reportTypeSchema = z.enum(REPORT_TYPES);

export const createScheduledReportSchema = z.object({
  name: z.string().trim().min(1).max(150),
  reportType: reportTypeSchema,
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  recipientEmails: z.array(z.string().trim().email()).min(1).max(20),
  branchId: z.string().uuid().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export const updateScheduledReportSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    reportType: reportTypeSchema.optional(),
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
    recipientEmails: z.array(z.string().trim().email()).min(1).max(20).optional(),
    branchId: z.string().uuid().nullable().optional(),
    filters: z.record(z.string(), z.unknown()).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update.' });
