import { z } from 'zod';

export const listTicketsQuerySchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedAdminId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const ticketIdParamSchema = z.object({ ticketId: z.string().uuid() });

export const assignTicketSchema = z.object({ assignedAdminId: z.string().uuid().nullable() });

export const setTicketStatusSchema = z.object({ status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']) });

export const addTicketNoteSchema = z.object({ note: z.string().trim().min(1).max(2000), isInternal: z.boolean().default(true) });
