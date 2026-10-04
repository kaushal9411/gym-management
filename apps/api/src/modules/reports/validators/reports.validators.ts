import { z } from 'zod';

import { REPORT_TYPES } from '../dto/reports.dto';
import { SUMMARY_REPORT_TYPES } from '../utils/report-summary.util';

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

const isoDay = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}/, 'Expected an ISO date (YYYY-MM-DD).')
  .transform((v) => v.slice(0, 10))
  .refine((v) => !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()), 'Invalid date.');

/** Same range rules as the finance analytics endpoints: inverted range rejected, 366-day cap. */
function withRangeRules<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .refine((v: { dateFrom?: string; dateTo?: string }) => !v.dateFrom || !v.dateTo || v.dateFrom <= v.dateTo, {
      message: 'dateFrom must be on or before dateTo.',
      path: ['dateFrom'],
    })
    .refine(
      (v: { dateFrom?: string; dateTo?: string }) =>
        !v.dateFrom || !v.dateTo || (new Date(`${v.dateTo}T00:00:00Z`).getTime() - new Date(`${v.dateFrom}T00:00:00Z`).getTime()) / 86_400_000 < 366,
      { message: 'Range may not exceed 366 days.', path: ['dateTo'] },
    );
}

/** GET /reports/overview and GET /analytics/branch-comparison. */
export const overviewQuerySchema = withRangeRules(
  z.object({
    dateFrom: isoDay.optional(),
    dateTo: isoDay.optional(),
    branchId: z.string().uuid().optional(),
  }),
);

/** GET /reports/:type/summary — the report list filters minus pagination. */
export const reportSummaryQuerySchema = withRangeRules(
  z.object({
    dateFrom: isoDay.optional(),
    dateTo: isoDay.optional(),
    branchId: z.string().uuid().optional(),
    planId: z.string().uuid().optional(),
    trainerId: z.string().uuid().optional(),
    paymentStatus: z.string().trim().optional(),
    memberStatus: z.string().trim().optional(),
  }),
);

export const reportSummaryParamSchema = z.object({ reportType: z.enum(SUMMARY_REPORT_TYPES) });

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
