import { z } from 'zod';

export const listTicketsQuerySchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const ticketIdParamSchema = z.object({ ticketId: z.string().uuid() });

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(5000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
