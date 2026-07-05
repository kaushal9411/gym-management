import { z } from 'zod';

export const createCouponSchema = z
  .object({
    code: z.string().trim().min(3).max(40),
    type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'TRIAL_EXTENSION']),
    scope: z.enum(['ONE_TIME', 'RECURRING', 'REFERRAL']).default('ONE_TIME'),
    percentOff: z.coerce.number().min(0).max(100).optional(),
    amountOff: z.coerce.number().nonnegative().optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    trialExtensionDays: z.coerce.number().int().positive().optional(),
    maxRedemptions: z.coerce.number().int().positive().optional(),
    maxRedemptionsPerTenant: z.coerce.number().int().positive().default(1),
    expiresAt: z.coerce.date().optional(),
    isActive: z.boolean().default(true),
  })
  .refine((data) => data.type !== 'PERCENTAGE' || data.percentOff !== undefined, { message: 'percentOff is required for a percentage coupon', path: ['percentOff'] })
  .refine((data) => data.type !== 'FIXED_AMOUNT' || data.amountOff !== undefined, { message: 'amountOff is required for a fixed-amount coupon', path: ['amountOff'] })
  .refine((data) => data.type !== 'TRIAL_EXTENSION' || data.trialExtensionDays !== undefined, { message: 'trialExtensionDays is required for a trial-extension coupon', path: ['trialExtensionDays'] });

export const updateCouponSchema = z.object({
  code: z.string().trim().min(3).max(40).optional(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'TRIAL_EXTENSION']).optional(),
  scope: z.enum(['ONE_TIME', 'RECURRING', 'REFERRAL']).optional(),
  percentOff: z.coerce.number().min(0).max(100).optional(),
  amountOff: z.coerce.number().nonnegative().optional(),
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
