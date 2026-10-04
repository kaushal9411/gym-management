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

export interface TicketCounts {
  all: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
}

/** List response; `counts` ignores the status filter (optional until the API lands). */
export type TicketListResponse = Paginated<TicketListItem> & { counts?: TicketCounts };

export interface TicketStatsParams {
  dateFrom: string;
  dateTo: string;
}

export interface TicketStats {
  range: { from: string; to: string };
  previousRange: { from: string; to: string };
  kpis: {
    created: { value: number; previous: number };
    open: { value: number };
    inProgress: { value: number };
    resolved: { value: number };
    closed: { value: number };
    unresolved: { value: number };
    oldestOpenDays: { value: number } | null;
  };
  daily: { date: string; created: number; previousCreated: number }[];
  byStatus: { status: TicketStatus; count: number }[];
  byPriority: { priority: TicketPriority; count: number; previousCount: number }[];
}

export type { Paginated };
