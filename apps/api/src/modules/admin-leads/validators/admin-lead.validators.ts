import { z } from 'zod';

export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST'] as const;
export const LEAD_TOPICS = ['SALES', 'BILLING', 'DEMO', 'GENERAL'] as const;

export const listLeadsQuerySchema = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  topic: z.enum(LEAD_TOPICS).optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const leadIdParamSchema = z.object({ leadId: z.string().uuid() });

/** Any subset; `notes: null` clears the notes. */
export const updateLeadSchema = z
  .object({
    status: z.enum(LEAD_STATUSES).optional(),
    notes: z.string().trim().max(4000, 'Notes can be at most 4000 characters.').nullable().optional(),
  })
  .strict()
  .refine((v) => v.status !== undefined || v.notes !== undefined, { message: 'Nothing to update.' });

export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
