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

const DEVICE_TOKEN_PLATFORMS = ['ANDROID', 'IOS', 'WEB'] as const;

export const memberRegisterDeviceTokenSchema = z.object({
  token: z.string().trim().min(1).max(255),
  platform: z.enum(DEVICE_TOKEN_PLATFORMS).default('ANDROID'),
});

export const memberUnregisterDeviceTokenSchema = z.object({
  token: z.string().trim().min(1).max(255),
});

export const memberNotificationsQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const memberRenewalPaymentParamSchema = z.object({
  paymentId: z.string().uuid('Invalid payment id'),
});

export const memberVerifyRenewalCheckoutSchema = z.object({
  razorpayOrderId: z.string().trim().min(1),
  razorpayPaymentId: z.string().trim().min(1),
  razorpaySignature: z.string().trim().min(1),
});

/** Shared by `/invoices/:id/pay/checkout/:paymentId/verify` — `id` is the invoice, `paymentId` the `MemberPayment` row created by the checkout step. */
export const memberInvoicePaymentParamSchema = z.object({
  id: z.string().uuid('Invalid invoice id'),
  paymentId: z.string().uuid('Invalid payment id'),
});

/** Same shape as `memberVerifyRenewalCheckoutSchema` — kept as a separate export (not a re-used alias) so the two call sites can diverge later without a shared-schema footgun. */
export const memberVerifyInvoicePaymentSchema = z.object({
  razorpayOrderId: z.string().trim().min(1),
  razorpayPaymentId: z.string().trim().min(1),
  razorpaySignature: z.string().trim().min(1),
});
