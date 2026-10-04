export type AnnouncementAudience = 'ALL' | 'MEMBERS' | 'STAFF';
export type AnnouncementStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'EXPIRED';

export interface TenantAnnouncement {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  status: AnnouncementStatus;
  branch: { id: string; name: string } | null;
  publishAt: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementCounts {
  all: number;
  draft: number;
  scheduled: number;
  published: number;
  expired: number;
}

export interface AnnouncementListParams {
  status?: AnnouncementStatus;
  audience?: AnnouncementAudience;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AnnouncementListResult {
  /** Tab counts for the current audience/search filters (ignoring status); absent until the backend ships it. */
  counts?: AnnouncementCounts;
  items: TenantAnnouncement[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  audience?: AnnouncementAudience;
  branchId?: string;
  expiresAt?: string;
}

export type UpdateAnnouncementInput = Partial<CreateAnnouncementInput>;

export interface ScheduleAnnouncementInput {
  publishAt: string;
}

export interface AnnouncementStatsParams {
  dateFrom: string;
  dateTo: string;
}

/** `GET /tenant-announcements/stats` — dates are `YYYY-MM-DD`. */
export interface AnnouncementStats {
  range: { from: string; to: string };
  previousRange: { from: string; to: string };
  kpis: {
    published: { value: number; previous: number };
    drafts: { value: number };
    scheduled: { value: number };
    expired: { value: number };
    expiringSoon: { value: number };
  };
  daily: Array<{ date: string; published: number; previousPublished: number }>;
  byStatus: Array<{ status: AnnouncementStatus; count: number }>;
  byAudience: Array<{ audience: AnnouncementAudience; count: number; previousCount: number }>;
  byBranch: Array<{ branchId: string; name: string; count: number }>;
  upcoming: Array<{ id: string; title: string; audience: AnnouncementAudience; publishAt: string }>;
  expiring: Array<{ id: string; title: string; audience: AnnouncementAudience; expiresAt: string }>;
  /** `delivered`/`read` are null when announcements can't be linked to member notifications. */
  recent: Array<{ id: string; title: string; audience: AnnouncementAudience; publishedAt: string; delivered: number | null; read: number | null }>;
}
