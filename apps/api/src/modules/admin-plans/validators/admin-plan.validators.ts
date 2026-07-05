import { z } from 'zod';

const planFeatureSchema = z.object({
  key: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(120),
  included: z.boolean(),
});

export const createPlanSchema = z.object({
  slug: z.string().trim().toLowerCase().min(2).max(40).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, hyphens only'),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  priceMonthly: z.coerce.number().nonnegative(),
  priceYearly: z.coerce.number().nonnegative(),
  currency: z.string().trim().length(3).toUpperCase(),
  trialDays: z.coerce.number().int().min(0).max(90),
  maxBranches: z.coerce.number().int().positive(),
  maxManagers: z.coerce.number().int().positive(),
  maxTrainers: z.coerce.number().int().positive(),
  maxReceptionists: z.coerce.number().int().nonnegative(),
  maxStaff: z.coerce.number().int().nonnegative(),
  maxMembers: z.coerce.number().int().positive(),
  maxStorageMb: z.coerce.number().int().positive(),
  sortOrder: z.coerce.number().int().nonnegative().default(0),
  features: z.array(planFeatureSchema).default([]),
});

export const updatePlanSchema = createPlanSchema.partial();

export const setPlanActiveSchema = z.object({
  isActive: z.boolean(),
});

export const planIdParamSchema = z.object({
  planId: z.string().uuid(),
});
