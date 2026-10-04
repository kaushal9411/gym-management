'use client';

/** Coupon insights, detail, update/toggle and bulk-generate: types + service fns + TanStack hooks. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '@/features/auth/services/api-client';
import { toCouponServiceError } from '../services/coupon.service';
import type { Coupon, CouponComputed, CouponScope, CouponType, UpsertCouponInput } from '../types';

interface ApiEnvelope<T> { success: boolean; message: string; data: T }

export interface CouponOverview {
  kpis: {
    total: number; active: number; expired: number; disabled: number; exhausted: number;
    redemptions30d: number; redemptionsPrev30d: number; discountGiven30d: string; discountGivenAllTime: string;
  };
  redemptionsDaily: Array<{ date: string; count: number; previousCount: number }>;
  byType: Array<{ type: CouponType; coupons: number; redemptions: number }>;
  topCoupons: Array<{ couponId: string; code: string; redemptions: number; discountGiven: string }>;
  expiringSoon: Array<{ couponId: string; code: string; expiresAt: string; remaining: number | null }>;
}

export interface CouponRedemptionRow {
  id: string;
  tenantId: string;
  redeemedAt: string;
  tenant?: { id?: string; name: string; slug: string } | null;
}

export interface CouponDetail extends Coupon {
  computed: CouponComputed;
  redemptions: CouponRedemptionRow[];
  redemptionsDaily: Array<{ date: string; count: number }>;
  topTenants: Array<{ tenantId: string; name: string; slug: string; redemptions: number }>;
  invoices: Array<{ id: string; number: string; tenant: { id: string; name: string; slug: string }; discountAmount: string; total: string; paidAt: string | null }>;
}

export interface BulkGenerateInput {
  prefix: string;
  count: number;
  length: number;
  type: CouponType;
  scope: CouponScope;
  percentOff?: number;
  amountOff?: number;
  currency?: string;
  trialExtensionDays?: number;
  maxRedemptions?: number;
  maxRedemptionsPerTenant?: number;
  expiresAt?: string;
}

const unwrap = async <T,>(p: Promise<{ data: ApiEnvelope<T> }>): Promise<T> => {
  try { return (await p).data.data; } catch (e) { throw toCouponServiceError(e); }
};

export const couponInsightsService = {
  overview: () => unwrap<CouponOverview>(apiClient.get('/admin/coupons/overview')),
  detail: (id: string) => unwrap<CouponDetail>(apiClient.get(`/admin/coupons/${id}`)),
  update: (id: string, input: Partial<UpsertCouponInput>) => unwrap<Coupon>(apiClient.put(`/admin/coupons/${id}`, input)),
  setActive: (id: string, isActive: boolean) => unwrap<Coupon>(apiClient.patch(`/admin/coupons/${id}/active`, { isActive })),
  bulk: (input: BulkGenerateInput) => unwrap<{ created: number; codes: string[] }>(apiClient.post('/admin/coupons/bulk-generate', input)),
};

const LIST_KEY = ['admin', 'coupons'] as const;

export function useCouponOverview() {
  return useQuery({ queryKey: [...LIST_KEY, 'overview'], queryFn: couponInsightsService.overview, retry: false });
}

export function useCouponDetail(id: string) {
  return useQuery({ queryKey: [...LIST_KEY, 'detail', id], queryFn: () => couponInsightsService.detail(id), retry: false });
}

export function useUpdateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<UpsertCouponInput> }) => couponInsightsService.update(id, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

/** Optimistic enable/disable on the list cache with rollback; always refetches (computed.status changes server-side). */
export function useSetCouponActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => couponInsightsService.setActive(id, isActive),
    onMutate: async ({ id, isActive }) => {
      await qc.cancelQueries({ queryKey: LIST_KEY, exact: true });
      const prev = qc.getQueryData<Coupon[]>(LIST_KEY);
      if (prev) {
        qc.setQueryData<Coupon[]>(LIST_KEY, prev.map((c) => (c.id === id ? {
          ...c, isActive,
          computed: c.computed && c.computed.status !== 'expired' && c.computed.status !== 'exhausted'
            ? { ...c.computed, status: isActive ? 'active' : 'disabled' } : c.computed,
        } : c)));
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(LIST_KEY, ctx.prev); },
    onSettled: () => void qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useBulkGenerateCoupons() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BulkGenerateInput) => couponInsightsService.bulk(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}
