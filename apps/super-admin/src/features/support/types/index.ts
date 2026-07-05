export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TicketListItem {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdByEmail: string;
  createdByName: string | null;
  createdAt: string;
  tenant: { name: string; slug: string } | null;
  assignedAdmin: { name: string; email: string } | null;
}

export interface TicketNote {
  id: string;
  note: string;
  isInternal: boolean;
  createdAt: string;
  authorAdmin: { name: string };
}

export interface TicketDetail extends TicketListItem {
  description: string;
  notes: TicketNote[];
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
