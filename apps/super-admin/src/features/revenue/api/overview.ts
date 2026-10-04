'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';

export type RevenueRange = '30d' | '90d' | '12m';
export const REVENUE_RANGES: RevenueRange[] = ['30d', '90d', '12m'];

/** Money fields are decimal strings (or numbers for counts). */
export interface RevenueOverview {
  range: { from: string; to: string } | string;
  previousRange: { from: string; to: string } | string | null;
  currency: string;
  currencies?: string[];
  currencyNote?: string;
  kpis: {
    mrr: { value: string; previous: string | null };
    arr: { value: string };
    arpa: { value: string } | null;
    collected: { value: string; previous: string | null };
    failed: { count: number; amount: string; previousCount: number | null };
    collectionRate: { value: number; previous: number | null };
    avgInvoice: { value: string } | null;
    outstanding: { value: string; invoiceCount: number };
    pipelineMrr: { value: string };
  };
  daily: Array<{ date: string; collected: string; failed: number; previousCollected: string | null }>;
  monthly: Array<{ month: string; collected: string }>;
  mrrByPlan: Array<{ planId: string; planName: string; mrr: string; activeSubscribers: number; share: number }>;
  byGateway: Array<{ provider: string; collected: string; transactions: number; successRate: number }>;
  byCurrency: Array<{ currency: string; collected: string }>;
  byCountry: Array<{ country: string; collected: string; tenants: number }>;
  statusMix: Array<{ status: string; count: number; amount: string }>;
  failureReasons: Array<{ reason: string; count: number; amount: string }>;
  dunning: Array<{ tenantId: string; slug: string; name: string; plan: string | null; status: 'PAST_DUE' | 'GRACE'; graceEndsAt: string | null; amountDue: string | null; daysOverdue: number | null }>;
  invoiceAging: Array<{ bucket: 'Current' | '1-30' | '31-60' | '61-90' | '90+'; count: number; amount: string }>;
  topTenants: Array<{ tenantId: string; slug: string; name: string; collected: string; plan: string | null }>;
  mrrHistory: unknown[] | null;
  newVsChurnedMrr: unknown[] | null;
}

export interface RevenueSummaryV2 {
  mrrTrialing: string;
  mrrByCurrency: Array<{ currency: string; mrr: string }>;
}

interface Envelope<T> { data: T }

export const revenueOverviewService = {
  async overview(range: RevenueRange): Promise<RevenueOverview> {
    try {
      const res = await apiClient.get<Envelope<RevenueOverview>>('/admin/revenue/overview', { params: { range } });
      return res.data.data;
    } catch (e) { throw toAdminServiceError(e); }
  },
  async summary(): Promise<RevenueSummaryV2> {
    try {
      const res = await apiClient.get<Envelope<RevenueSummaryV2>>('/admin/revenue/summary');
      return res.data.data;
    } catch (e) { throw toAdminServiceError(e); }
  },
  /** Server-side CSV export (audited as admin.revenue_exported). */
  async exportCsv(range: RevenueRange): Promise<Blob> {
    try {
      const res = await apiClient.get<Blob>('/admin/revenue/export', { params: { range }, responseType: 'blob' });
      return res.data;
    } catch (e) { throw toAdminServiceError(e); }
  },
};

export function useRevenueOverview(range: RevenueRange) {
  return useQuery({
    queryKey: ['admin', 'revenue', 'overview', range],
    queryFn: () => revenueOverviewService.overview(range),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
  });
}

export function useRevenueSummaryV2() {
  return useQuery({
    queryKey: ['admin', 'revenue', 'summary', 'v2'],
    queryFn: () => revenueOverviewService.summary(),
    staleTime: 60_000,
    retry: false,
  });
}
