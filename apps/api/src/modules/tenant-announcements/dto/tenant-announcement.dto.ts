import type { TenantAnnouncementAudience, TenantAnnouncementStatus } from '@prisma/client';

export interface TenantAnnouncementDto {
  id: string;
  title: string;
  body: string;
  audience: TenantAnnouncementAudience;
  status: TenantAnnouncementStatus;
  branch: { id: string; name: string } | null;
  publishAt: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  createdBy: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantAnnouncementInput {
  title: string;
  body: string;
  audience?: TenantAnnouncementAudience;
  branchId?: string;
  expiresAt?: string;
}

export type UpdateTenantAnnouncementInput = Partial<CreateTenantAnnouncementInput>;

export interface ScheduleAnnouncementInput {
  publishAt: string;
}

export interface ListAnnouncementsQuery {
  status?: TenantAnnouncementStatus;
  page: number;
  limit: number;
}
