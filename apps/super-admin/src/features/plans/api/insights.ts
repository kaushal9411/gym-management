'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type { Plan, PlanStats } from '../types';

/** Types, service functions and TanStack hooks for the plans insights surface (/admin/plans/overview, /:id/overview, /:id/impact, /:id/duplicate). */

interface Env<T> { success: boolean; message: string; data: T }

export interface PlansOverview {
  kpis: { totalPlans: number; activePlans: number; totalSubscribers: number; activeSubscribers: number; trialSubscribers: number; mrr: string; arr: string; arpa: string | null; currency: string };
  mrrByCurrency: Array<{ currency: string; mrr: string }>;
  byPlan: Array<{ planId: string; name: string; slug: string; isActive: boolean; currency: string; activeSubscribers: number; trialSubscribers: number; mrr: string; share: number; monthly: number; yearly: number }>;
  priceLadder: Array<{ planId: string; name: string; priceMonthly: string; priceYearly: string; currency: string; yearlyDiscountPct: number | null }>;
  upcomingRenewals: RenewalBucket[];
}
export interface RenewalBucket { weekStart: string; subscriptions: number; expectedRevenue: string }

export interface PlanOverview {
  plan: Plan;
  stats: PlanStats;
  subscribersByStatus: Array<{ status: string; count: number }>;
  subscribersByCycle: Array<{ cycle: string; count: number }>;
  upcomingRenewals: RenewalBucket[];
  recentChanges: Array<{ at: string; actor: string | null; action: string; summary: string }>;
  couponsUsed: Array<{ code: string; redemptions: number }>;
}

export interface PriceImpact {
  affected: { activeSubscribers: number; monthlyCycle: number; yearlyCycle: number };
  currentMrr: string;
  projectedMrr: string;
  mrrDelta: string;
  mrrDeltaPct: number | null;
  renewalsInNext30Days: number;
  note: string;
}

class PlanInsightsService {
  async overview(): Promise<PlansOverview> {
    try { return (await apiClient.get<Env<PlansOverview>>('/admin/plans/overview')).data.data; } catch (e) { throw toAdminServiceError(e); }
  }
  async planOverview(id: string): Promise<PlanOverview> {
    try { return (await apiClient.get<Env<PlanOverview>>(`/admin/plans/${id}/overview`)).data.data; } catch (e) { throw toAdminServiceError(e); }
  }
  async impact(id: string, p: { priceMonthly?: number; priceYearly?: number }): Promise<PriceImpact> {
    try { return (await apiClient.get<Env<PriceImpact>>(`/admin/plans/${id}/impact`, { params: p })).data.data; } catch (e) { throw toAdminServiceError(e); }
  }
  async duplicate(id: string, body: { name?: string; slug?: string }): Promise<Plan> {
    try { return (await apiClient.post<Env<Plan>>(`/admin/plans/${id}/duplicate`, body)).data.data; } catch (e) { throw toAdminServiceError(e); }
  }
}
export const planInsightsService = new PlanInsightsService();

export function usePlansOverview() {
  return useQuery({ queryKey: ['admin', 'plans', 'insights', 'overview'], queryFn: () => planInsightsService.overview(), staleTime: 30_000, retry: false });
}
export function usePlanOverview(id: string) {
  return useQuery({ queryKey: ['admin', 'plans', 'insights', 'plan', id], queryFn: () => planInsightsService.planOverview(id), enabled: !!id, staleTime: 30_000, retry: false });
}
/** Read-only price-change simulation. Pass already-debounced values; `enabled` false (or no valid price) skips the call. */
export function usePriceImpact(id: string, prices: { priceMonthly?: number; priceYearly?: number }, enabled: boolean) {
  const has = prices.priceMonthly !== undefined || prices.priceYearly !== undefined;
  return useQuery({
    queryKey: ['admin', 'plans', 'insights', 'impact', id, prices.priceMonthly ?? null, prices.priceYearly ?? null],
    queryFn: () => planInsightsService.impact(id, prices),
    enabled: enabled && has && !!id,
    staleTime: 10_000,
    retry: false,
  });
}
export function useDuplicatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; slug?: string } }) => planInsightsService.duplicate(id, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'plans'] }),
  });
}
