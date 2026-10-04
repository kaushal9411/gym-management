import { z } from 'zod';

import { isoDay } from '../../finance/validators/finance.validators';

export const listTicketsQuerySchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const ticketStatsQuerySchema = z
  .object({ dateFrom: isoDay.optional(), dateTo: isoDay.optional() })
  .refine((v) => !v.dateFrom || !v.dateTo || v.dateFrom <= v.dateTo, {
    message: 'dateFrom must be on or before dateTo.',
    path: ['dateFrom'],
  })
  .refine(
    (v) =>
      !v.dateFrom ||
      !v.dateTo ||
      (new Date(`${v.dateTo}T00:00:00Z`).getTime() -
        new Date(`${v.dateFrom}T00:00:00Z`).getTime()) /
        86_400_000 <
        366,
    { message: 'Range may not exceed 366 days.', path: ['dateTo'] },
  );

export const ticketIdParamSchema = z.object({ ticketId: z.string().uuid() });

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(5000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
