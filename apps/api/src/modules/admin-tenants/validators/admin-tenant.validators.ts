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
