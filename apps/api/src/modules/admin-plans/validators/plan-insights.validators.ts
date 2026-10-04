import { z } from 'zod';

export const planListQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const planImpactQuerySchema = z
  .object({
    priceMonthly: z.coerce.number().nonnegative().optional(),
    priceYearly: z.coerce.number().nonnegative().optional(),
  })
  .refine((q) => q.priceMonthly !== undefined || q.priceYearly !== undefined, {
    message: 'Provide priceMonthly and/or priceYearly',
    path: ['priceMonthly'],
  });

export const duplicatePlanSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, hyphens only')
    .optional(),
});
