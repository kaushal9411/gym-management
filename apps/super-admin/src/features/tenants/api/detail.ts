'use client';

/**
 * Tenant detail ("control center") data layer: types, service fns and TanStack hooks for
 * /admin/tenants/:tenantId/{overview,reports,limits,modules,notes,tags}. Query keys live under
 * ['admin','tenants',tenantId,…] so every existing tenant mutation (suspend, maintenance, plan change…)
 * also invalidates them. Mutations are only ever triggered from click handlers.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type { TenantStatus } from '../types';

interface Envelope<T> { success: boolean; message: string; data: T }

async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  try {
    const res = await apiClient.get<Envelope<T>>(url, { params });
    return res.data.data;
  } catch (e) { throw toAdminServiceError(e); }
}
async function send<T>(method: 'post' | 'put' | 'delete', url: string, body?: unknown): Promise<T> {
  try {
    const res = await apiClient.request<Envelope<T>>({ method, url, data: body });
    return res.data.data;
  } catch (e) { throw toAdminServiceError(e); }
}

/* ───────────── types ───────────── */

export interface OverviewUsage { key: string; label: string; used: number | null; limit: number | null; pct: number | null; overridden: boolean }
export interface TenantOverview {
  tenant: {
    id: string; slug: string; name: string; status: TenantStatus; plan: string | null; subscriptionStatus: string | null; currency: string;
    owner: { name: string; email: string } | null; createdAt: string; trialEndsAt: string | null; renewsAt: string | null; maintenanceMode: boolean; tags: string[];
  };
  kpis: { mrr: string | null; lifetimeRevenue: string; memberCount: number; staffCount: number; branchCount: number; lastActiveAt: string | null; healthScore: number };
  health: { score: number; components: { engagement: number; billing: number; utilisation: number; support: number } };
  usage: OverviewUsage[];
  engagement: { dailyCheckIns: Array<{ date: string; count: number }>; avgDailyCheckIns: number; activeMembers: number; totalMembers: number; staffLoginsPerWeek: number; paymentsRecorded30d: number };
  growth: { months: Array<{ month: string; members: number; mrr: number | string | null }> };
  invoices: Array<{ id: string; number: string; periodStart: string | null; periodEnd: string | null; issuedAt: string; paidAt: string | null; amount: string; currency: string; status: string }>;
  timeline: Array<{ at: string; actor: string; summary: string; family: 'access' | 'subscription' | 'billing' | 'limits' | 'modules' | 'notes' | 'other' }>;
}

export type ReportRange = '30d' | '90d' | '6m' | '12m';
interface Cmp { value: string; previous: string | null }
export interface TenantReports {
  range: ReportRange;
  previousRange: { from: string; to: string } | null;
  currentRange: { from: string; to: string };
  timezone: string;
  kpis: {
    revenuePaid: Cmp;
    memberGrowth: Cmp;
    checkInsPerDay: Cmp;
    retention90d: Cmp | null;
    supportTickets: { value: number | string; avgResolutionHours: number | null };
    churnRisk: { label: 'Low' | 'Medium' | 'High'; score: number };
  };
  memberGrowth: Array<{ month: string; new: number; lost: number; total: number }>;
  featureAdoption: Array<{ feature: string; share: number }>;
  checkInHeatmap: Array<{ weekday: number; hour: number; count: number }>;
  revenueByMonth: Array<{ month: string; amount: string }>;
  paymentMethods: Array<{ method: string; share: number }>;
  retentionCohorts: Array<{ cohort: string; values: Array<number | null> }>;
  staffLoginsByRole: Array<{ week: string; role: string; count: number }>;
  ticketsByMonth: Array<{ month: string; open: number; inProgress: number; resolved: number; closed: number }>;
  avgFirstReplyHours: number | null;
  planUtilization: Array<{ month: string; members: number; limit: number | null }>;
  projection: { monthsTo80Pct: number | null };
}

export interface LimitRow { key: string; label: string; planValue: number | null; override: number | null; effective: number | null }
export interface ModuleRow { key: string; label: string; planDefault: boolean; enabled: boolean; overridden: boolean; platformEnabled: boolean; guarded: boolean }
export interface AdminNote { id: string; body: string; authorId: string; authorName: string; createdAt: string; canDelete: boolean }

export type NotificationChannel = 'EMAIL' | 'SMS' | 'WHATSAPP';
export interface NotificationChannelRow { channel: NotificationChannel; enabled: boolean; monthlyLimit: number | null; usedThisMonth: number }

/* ───────────── keys ───────────── */

const base = (id: string) => ['admin', 'tenants', id] as const;

function useInvalidateDetail(_tenantId: string) {
  const qc = useQueryClient();
  // Prefix invalidation covers this tenant's detail queries, the list rows (tags/status/plan) and the dashboard KPIs.
  return (_parts?: string[]) => {
    void qc.invalidateQueries({ queryKey: ['admin', 'tenants'] });
    void qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
  };
}

/* ───────────── queries ───────────── */

export function useTenantOverview(tenantId: string) {
  return useQuery({ queryKey: [...base(tenantId), 'overview'], queryFn: () => get<TenantOverview>(`/admin/tenants/${tenantId}/overview`), enabled: !!tenantId, retry: false });
}

export function useTenantReports(tenantId: string, range: ReportRange, compare: boolean) {
  return useQuery({
    queryKey: [...base(tenantId), 'reports', range, compare],
    queryFn: () => get<TenantReports>(`/admin/tenants/${tenantId}/reports`, { range, compare }),
    enabled: !!tenantId,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useTenantLimits(tenantId: string) {
  return useQuery({ queryKey: [...base(tenantId), 'limits'], queryFn: () => get<LimitRow[]>(`/admin/tenants/${tenantId}/limits`), enabled: !!tenantId });
}
export function useTenantModules(tenantId: string) {
  return useQuery({ queryKey: [...base(tenantId), 'modules'], queryFn: () => get<ModuleRow[]>(`/admin/tenants/${tenantId}/modules`), enabled: !!tenantId });
}
export function useTenantNotes(tenantId: string) {
  return useQuery({ queryKey: [...base(tenantId), 'notes'], queryFn: () => get<AdminNote[]>(`/admin/tenants/${tenantId}/notes`), enabled: !!tenantId });
}
export function useTenantTags(tenantId: string) {
  return useQuery({ queryKey: [...base(tenantId), 'tags'], queryFn: () => get<{ tags: string[] }>(`/admin/tenants/${tenantId}/tags`), enabled: !!tenantId });
}
export function useTenantNotificationChannels(tenantId: string) {
  return useQuery({
    queryKey: [...base(tenantId), 'notification-channels'],
    queryFn: () => get<NotificationChannelRow[]>(`/admin/tenants/${tenantId}/notification-channels`),
    enabled: !!tenantId,
  });
}

/* ───────────── mutations (call with mutateAsync from click handlers) ───────────── */

export function useSaveLimits(tenantId: string) {
  const inv = useInvalidateDetail(tenantId);
  return useMutation({
    mutationFn: (overrides: Record<string, number | null>) => send<LimitRow[]>('put', `/admin/tenants/${tenantId}/limits`, { overrides }),
    onSuccess: () => inv(['limits', 'overview']),
  });
}
export function useToggleModule(tenantId: string) {
  const inv = useInvalidateDetail(tenantId);
  return useMutation({
    mutationFn: (v: { key: string; enabled: boolean }) => send<ModuleRow>('put', `/admin/tenants/${tenantId}/modules/${v.key}`, { enabled: v.enabled }),
    onSuccess: () => inv(['modules', 'overview']),
  });
}
export function useAddNote(tenantId: string) {
  const inv = useInvalidateDetail(tenantId);
  return useMutation({ mutationFn: (body: string) => send<AdminNote>('post', `/admin/tenants/${tenantId}/notes`, { body }), onSuccess: () => inv(['notes', 'overview']) });
}
export function useDeleteNote(tenantId: string) {
  const inv = useInvalidateDetail(tenantId);
  return useMutation({ mutationFn: (noteId: string) => send<unknown>('delete', `/admin/tenants/${tenantId}/notes/${noteId}`), onSuccess: () => inv(['notes', 'overview']) });
}
export function useSaveTags(tenantId: string) {
  const inv = useInvalidateDetail(tenantId);
  return useMutation({ mutationFn: (tags: string[]) => send<{ tags: string[] }>('put', `/admin/tenants/${tenantId}/tags`, { tags }), onSuccess: () => inv(['tags', 'overview']) });
}
export function useSaveNotificationChannel(tenantId: string) {
  const inv = useInvalidateDetail(tenantId);
  return useMutation({
    mutationFn: (v: { channel: NotificationChannel; enabled: boolean; monthlyLimit: number | null }) =>
      send<NotificationChannelRow>('put', `/admin/tenants/${tenantId}/notification-channels/${v.channel}`, {
        enabled: v.enabled,
        monthlyLimit: v.monthlyLimit,
      }),
    onSuccess: () => inv(['notification-channels', 'overview']),
  });
}

/** Invalidate everything a tenant action (status/maintenance/plan…) can change — used by the control panel after actions that go through the legacy hooks. */
export function useAfterTenantAction(tenantId: string) {
  const inv = useInvalidateDetail(tenantId);
  return () => inv(['overview', 'limits', 'modules']);
}
