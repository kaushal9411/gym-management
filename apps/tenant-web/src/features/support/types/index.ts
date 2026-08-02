import type { Paginated } from '@/features/iam/types';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TicketNote {
  id: string;
  note: string;
  createdAt: string;
  authorAdmin: { name: string } | null;
}

export interface TicketListItem {
  id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdByEmail: string;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketDetail extends TicketListItem {
  notes: TicketNote[];
}

export interface ListTicketsParams {
  status?: TicketStatus;
  page?: number;
  limit?: number;
}

export interface CreateTicketPayload {
  subject: string;
  description: string;
  priority: TicketPriority;
}

export type { Paginated };
