import { z } from 'zod';

export const checkoutSchema = z.object({
  planSlug: z.string().trim().min(1).max(40),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
  couponCode: z.string().trim().min(1).max(40).optional(),
});

export const verifyCheckoutSchema = z.object({
  razorpayOrderId: z.string().trim().min(1),
  razorpayPaymentId: z.string().trim().min(1),
  razorpaySignature: z.string().trim().min(1),
});

export const cancelSubscriptionSchema = z.object({
  immediate: z.boolean().default(false),
  reason: z.string().trim().max(500).optional(),
});
