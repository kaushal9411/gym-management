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

export const PAYMENT_MODE_VALUES = ['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'CARD', 'OTHER'] as const;

export const changePlanBodySchema = z
  .object({
    planId: z.string().uuid(),
    mode: z.enum(['manual', 'payment_link']),
    // Only meaningful (and required) when mode === 'manual' — "Mark Paid
    // Manually" captures the same kind of detail a real payment already
    // carries (mode/date/amount/proof), rather than silently recording a
    // paid invoice with no payment record behind it at all.
    paymentMode: z.enum(PAYMENT_MODE_VALUES).optional(),
    paymentDate: z.string().trim().min(1).optional(),
    amount: z.coerce.number().positive().optional(),
    proofDataUrl: z.string().trim().min(1).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.mode !== 'manual') return;
    if (!body.paymentMode) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['paymentMode'], message: 'Mode of payment is required.' });
    if (!body.paymentDate) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['paymentDate'], message: 'Payment date is required.' });
  });
