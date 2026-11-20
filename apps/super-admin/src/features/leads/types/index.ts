export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'WON' | 'LOST';
export type LeadTopic = 'SALES' | 'BILLING' | 'DEMO' | 'GENERAL';

/** A contact-form submission from the public website (`GET /admin/leads`). */
export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  gymName: string | null;
  gymSlug: string | null;
  gymSize: string | null;
  topic: LeadTopic;
  message: string;
  /** HOME_PAGE or STATUS_SCREEN. */
  source: string;
  status: LeadStatus;
  notes: string | null;
  contactedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadStats {
  total: number;
  byStatus: Record<LeadStatus, number>;
}

export interface LeadList {
  items: Lead[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  stats: LeadStats;
}

export interface LeadListParams {
  status?: LeadStatus;
  topic?: LeadTopic;
  search?: string;
  page: number;
  limit: number;
}
