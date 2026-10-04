import { z } from 'zod';

import { REVENUE_RANGES } from '../utils/revenue-insights.util';

const currency = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, 'currency must be a 3-letter code')
  .transform((s) => s.toUpperCase());

export const revenueGrowthQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(366).default(30),
  currency: currency.optional(),
});

export const revenueRangeQuerySchema = z.object({
  range: z.enum(REVENUE_RANGES, { message: 'range must be one of 30d, 90d or 12m' }).default('30d'),
});
