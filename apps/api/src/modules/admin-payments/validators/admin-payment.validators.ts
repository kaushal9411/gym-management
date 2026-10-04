import { z } from 'zod';

import { REVENUE_RANGES } from '../../admin-revenue/utils/revenue-insights.util';
import { INVOICE_SORTS, PAYMENT_SORTS } from '../utils/payment-filters.util';

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Invalid date');
const amount = z.coerce.number().min(0).max(1_000_000_000);
const currency = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, 'currency must be a 3-letter code')
  .transform((s) => s.toUpperCase());
const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

const rangeOk = (v: { from?: string; to?: string; minAmount?: number; maxAmount?: number }) =>
  !(v.from && v.to && v.from > v.to) &&
  !(v.minAmount !== undefined && v.maxAmount !== undefined && v.minAmount > v.maxAmount);
const rangeMsg = { message: 'from must be <= to and minAmount <= maxAmount' };

const paymentFilterShape = {
  status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED']).optional(),
  provider: z.enum(['STRIPE', 'RAZORPAY', 'PAYPAL', 'MANUAL']).optional(),
  tenant: z.string().trim().min(1).max(100).optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
  minAmount: amount.optional(),
  maxAmount: amount.optional(),
  currency: currency.optional(),
  mode: z.enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD', 'OTHER']).optional(),
  sort: z.enum(PAYMENT_SORTS).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
};

export const paymentListQuerySchema = z
  .object({
    ...paymentFilterShape,
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .refine(rangeOk, rangeMsg);

export const paymentExportQuerySchema = z.object(paymentFilterShape).refine(rangeOk, rangeMsg);

export const invoiceListQuerySchema = z
  .object({
    status: z.enum(['DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE']).optional(),
    tenant: z.string().trim().min(1).max(100).optional(),
    from: dateStr.optional(),
    to: dateStr.optional(),
    overdue: bool.optional(),
    minAmount: amount.optional(),
    maxAmount: amount.optional(),
    currency: currency.optional(),
    sort: z.enum(INVOICE_SORTS).default('createdAt'),
    sortDir: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .refine(rangeOk, rangeMsg);

export const paymentOverviewQuerySchema = z.object({
  range: z.enum(REVENUE_RANGES, { message: 'range must be one of 30d, 90d or 12m' }).default('30d'),
});

export const paymentIdParamSchema = z.object({ paymentId: z.string().uuid() });
export const invoiceIdParamSchema = z.object({ invoiceId: z.string().uuid() });
