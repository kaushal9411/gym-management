import { z } from 'zod';

export const listTenantsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const tenantIdParamSchema = z.object({
  tenantId: z.string().uuid(),
});

export const extendTrialBodySchema = z.object({
  days: z
    .number({ message: 'days must be a whole number between 1 and 90' })
    .int('days must be a whole number between 1 and 90')
    .min(1, 'days must be at least 1')
    .max(90, 'days cannot exceed 90'),
  reason: z.string().trim().max(200, 'reason must be 200 characters or fewer').optional(),
});

export const maintenanceBodySchema = z.object({
  enabled: z.boolean({ message: 'enabled must be true or false' }),
  reason: z.string().trim().max(200, 'reason must be 200 characters or fewer').optional(),
});
