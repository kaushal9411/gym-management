import { z } from 'zod';

import { couponShapeIssues } from '../utils/coupon-rules.util';

const COUPON_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT', 'TRIAL_EXTENSION'] as const;

export const couponListQuerySchema = z.object({
  search: z.string().trim().max(40).optional(),
  status: z.enum(['active', 'disabled', 'expired', 'exhausted']).optional(),
  type: z.enum(COUPON_TYPES).optional(),
});

export const setCouponActiveSchema = z.object({ isActive: z.boolean() });

export const bulkGenerateCouponsSchema = z
  .object({
    prefix: z
      .string()
      .trim()
      .toUpperCase()
      .min(1)
      .max(12)
      .regex(/^[A-Z0-9]+$/, 'Prefix may contain only A-Z and 0-9'),
    count: z.coerce.number().int().min(1).max(200),
    length: z.coerce.number().int().min(4).max(12),
    type: z.enum(COUPON_TYPES),
    scope: z.enum(['ONE_TIME', 'RECURRING', 'REFERRAL']).default('ONE_TIME'),
    percentOff: z.coerce.number().min(1).max(100).optional(),
    amountOff: z.coerce.number().positive().optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    trialExtensionDays: z.coerce.number().int().positive().optional(),
    maxRedemptions: z.coerce.number().int().positive().optional(),
    maxRedemptionsPerTenant: z.coerce.number().int().positive().default(1),
    expiresAt: z.coerce
      .date()
      .refine((d) => d.getTime() > Date.now(), 'expiresAt must be in the future')
      .optional(),
  })
  .superRefine((data, ctx) => {
    for (const issue of couponShapeIssues(data))
      ctx.addIssue({ code: 'custom', message: issue.message, path: [issue.path] });
  });
