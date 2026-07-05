import { z } from 'zod';

export const checkoutSchema = z.object({
  planSlug: z.string().trim().min(1).max(40),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
  couponCode: z.string().trim().min(1).max(40).optional(),
  provider: z.enum(['stripe', 'razorpay', 'paypal']).optional(),
  paymentToken: z.string().min(1).optional(),
});

export const cancelSubscriptionSchema = z.object({
  immediate: z.boolean().default(false),
  reason: z.string().trim().max(500).optional(),
});
