import { z } from 'zod';

import { couponShapeIssues } from '../utils/coupon-rules.util';

export const createCouponSchema = z
  .object({
    code: z.string().trim().min(3).max(40),
    type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'TRIAL_EXTENSION']),
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
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    for (const issue of couponShapeIssues(data))
      ctx.addIssue({ code: 'custom', message: issue.message, path: [issue.path] });
  });

export const updateCouponSchema = z.object({
  code: z.string().trim().min(3).max(40).optional(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'TRIAL_EXTENSION']).optional(),
  scope: z.enum(['ONE_TIME', 'RECURRING', 'REFERRAL']).optional(),
  percentOff: z.coerce.number().min(1).max(100).optional(),
  amountOff: z.coerce.number().positive().optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  trialExtensionDays: z.coerce.number().int().positive().optional(),
  maxRedemptions: z.coerce.number().int().positive().optional(),
  maxRedemptionsPerTenant: z.coerce.number().int().positive().optional(),
  expiresAt: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});

export const couponIdParamSchema = z.object({
  couponId: z.string().uuid(),
});
