'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type { TenantStatus } from '../types';

/** Types, service functions and TanStack hooks for the tenants LIST page (GET /admin/tenants, /insights, /tags, /bulk, /export). */

export type HealthBucket = 'at_risk' | 'fair' | 'healthy';
export type ListView = 'trials_ending' | 'at_risk' | 'past_due' | 'suspended' | 'near_limits';
export type ListSort = 'mrr' | 'createdAt' | 'lastActiveAt' | 'members' | 'health' | 'name';

export interface ListQuery {
  search?: string;
  status?: TenantStatus;
  plan?: string;
  country?: string;
  createdFrom?: string;
  createdTo?: string;
  health?: HealthBucket;
  view?: ListView;
  tag?: string;
  sort?: ListSort;
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface HealthComponents { engagement: number; billing: number; utilisation: number; support: number }

export interface TenantRow {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  trialEndsAt: string | null;
  createdAt: string;
  owner: { name: string; email: string } | null;
  plan: string | null;
  subscriptionStatus: string | null;
  planId: string | null;
  planName: string | null;
  mrr: string | null;
  members: number | null;
  membersLimit: number | null;
  branches: number | null;
  country: string | null;
  renewsAt: string | null;
  lastActiveAt: string | null;
  healthScore: number;
  healthComponents: HealthComponents;
  atRiskReason: string | null;
  maintenanceMode: boolean;
  /** Additive field (admin tags) — may be absent on older API builds. */
  tags?: string[];
}

export interface ListCounts {
  all: number; active: number; trial: number; pastDue: number; suspended: number; cancelled: number;
  trialsEnding: number; atRisk: number; nearLimits: number;
}

export interface TenantListResult {
  items: TenantRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  counts: ListCounts;
}

export interface TenantInsights {
  growth: Array<{ month: string; total: number; new: number }>;
  planMix: Array<{ planId: string; planName: string; tenants: number; mrr: string }>;
  healthDistribution: Array<{ bucket: string; count: number }>;
  signupsBySource: Array<{ source: string; count: number }> | null;
  renewals: Array<{ weekStart: string; tenants: number; expectedMrr: string }>;
}

export type BulkAction = 'extend-trial' | 'change-plan' | 'maintenance' | 'suspend' | 'reactivate' | 'force-logout';
export interface BulkParams { days?: number; reason?: string; planId?: string; mode?: 'manual' | 'payment_link'; enabled?: boolean }
export interface BulkResult { results: Array<{ tenantId: string; ok: boolean; error?: string }>; succeeded: number; failed: number }

interface Envelope<T> { success: boolean; data: T }

export const LIST_KEY = ['admin', 'tenants', 'list-v2'] as const;
export const INSIGHTS_KEY = ['admin', 'tenants', 'insights'] as const;
export const TAGS_KEY = ['admin', 'tenants', 'tags'] as const;

export const tenantListService = {
  async list(params: ListQuery): Promise<TenantListResult> {
    try {
      const res = await apiClient.get<Envelope<TenantListResult>>('/admin/tenants', { params });
      return res.data.data;
    } catch (e) { throw toAdminServiceError(e); }
  },
  async insights(): Promise<TenantInsights> {
    try {
      const res = await apiClient.get<Envelope<TenantInsights>>('/admin/tenants/insights');
      return res.data.data;
    } catch (e) { throw toAdminServiceError(e); }
  },
  async tags(): Promise<Array<{ tag: string; count: number }>> {
    try {
      const res = await apiClient.get<Envelope<Array<{ tag: string; count: number }>>>('/admin/tenants/tags');
      return res.data.data;
    } catch (e) { throw toAdminServiceError(e); }
  },
  async bulk(body: { action: BulkAction; tenantIds: string[]; params: BulkParams }): Promise<BulkResult> {
    try {
      const res = await apiClient.post<Envelope<BulkResult>>('/admin/tenants/bulk', body);
      return res.data.data;
    } catch (e) { throw toAdminServiceError(e); }
  },
  /** CSV of the CURRENT filters (no page/limit). Returned as a Blob; the caller saves it. */
  async exportCsv(params: ListQuery): Promise<Blob> {
    try {
      const { page: _p, limit: _l, ...rest } = params;
      const res = await apiClient.get<Blob>('/admin/tenants/export', { params: rest, responseType: 'blob' });
      return res.data;
    } catch (e) { throw toAdminServiceError(e); }
  },
};

export function useTenantList(params: ListQuery) {
  return useQuery({
    queryKey: [...LIST_KEY, params],
    queryFn: () => tenantListService.list(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: false,
  });
}

export function useTenantInsights() {
  return useQuery({ queryKey: INSIGHTS_KEY, queryFn: () => tenantListService.insights(), staleTime: 60_000, retry: false });
}

/** Optional (additive endpoint): an error simply hides the tag controls. */
export function useTenantTags() {
  return useQuery({ queryKey: TAGS_KEY, queryFn: () => tenantListService.tags(), staleTime: 60_000, retry: false });
}

export function useBulkAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { action: BulkAction; tenantIds: string[]; params: BulkParams }) => tenantListService.bulk(body),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'tenants'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });
}
