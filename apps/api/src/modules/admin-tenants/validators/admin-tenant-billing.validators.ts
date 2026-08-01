import { z } from 'zod';

export const tenantBillingListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const tenantPaymentParamSchema = z.object({
  tenantId: z.string().uuid(),
  paymentId: z.string().uuid(),
});

export const tenantInvoiceParamSchema = z.object({
  tenantId: z.string().uuid(),
  invoiceId: z.string().uuid(),
});

export const createPaymentLinkBodySchema = z.object({
  invoiceId: z.string().uuid().optional(),
});

export const resendNotificationBodySchema = z.object({
  medium: z.enum(['email', 'sms']),
});

export const emailInvoiceBodySchema = z.object({
  email: z.string().trim().email().optional(),
});

export const changePlanBodySchema = z.object({
  planId: z.string().uuid(),
  mode: z.enum(['manual', 'payment_link']),
});
