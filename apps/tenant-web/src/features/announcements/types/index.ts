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

export interface AnnouncementListResult {
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
