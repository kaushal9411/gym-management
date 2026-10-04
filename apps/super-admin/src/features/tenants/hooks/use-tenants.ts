'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminTenantService } from '../services/tenant.service';
import type { TenantStatus } from '../types';
import { AdminServiceError } from '@/features/auth/types';

export function toTenantError(error: unknown): AdminServiceError {
  if (error instanceof AdminServiceError) return error;
  return new AdminServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

export function useTenants(params: { search?: string; status?: TenantStatus; page: number; limit: number }) {
  return useQuery({ queryKey: ['admin', 'tenants', params], queryFn: () => adminTenantService.list(params) });
}

export function useTenant(tenantId: string) {
  return useQuery({ queryKey: ['admin', 'tenants', tenantId], queryFn: () => adminTenantService.getById(tenantId), enabled: !!tenantId });
}

export function useTenantAuditLogs(tenantId: string) {
  return useQuery({ queryKey: ['admin', 'tenants', tenantId, 'audit'], queryFn: () => adminTenantService.auditLogs(tenantId), enabled: !!tenantId });
}

export function useTenantPayments(tenantId: string, params: { page: number; limit: number }) {
  return useQuery({
    queryKey: ['admin', 'tenants', tenantId, 'payments', params],
    queryFn: () => adminTenantService.payments(tenantId, params),
    enabled: !!tenantId,
  });
}

export function useTenantInvoices(tenantId: string, params: { page: number; limit: number }) {
  return useQuery({
    queryKey: ['admin', 'tenants', tenantId, 'invoices', params],
    queryFn: () => adminTenantService.invoices(tenantId, params),
    enabled: !!tenantId,
  });
}

function useTenantMutation(fn: (tenantId: string) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] }),
  });
}

export function useActivateTenant() {
  return useTenantMutation((tenantId) => adminTenantService.activate(tenantId));
}
export function useSuspendTenant() {
  return useTenantMutation((tenantId) => adminTenantService.suspend(tenantId));
}
export function useReactivateTenant() {
  return useTenantMutation((tenantId) => adminTenantService.reactivate(tenantId));
}
export function useDeleteTenant() {
  return useTenantMutation((tenantId) => adminTenantService.remove(tenantId));
}
export function useResetOwnerPassword() {
  return useMutation({ mutationFn: (tenantId: string) => adminTenantService.resetOwnerPassword(tenantId) });
}
export function useImpersonateTenant() {
  return useMutation({ mutationFn: (tenantId: string) => adminTenantService.impersonate(tenantId) });
}

/** Search-as-you-type lookup for the dashboard command console and the Ctrl+K palette (cache key lives under ['admin','tenants'] so every tenant mutation invalidates it). */
export function useTenantSearch(search: string) {
  const term = search.trim();
  return useQuery({
    queryKey: ['admin', 'tenants', 'search', term],
    queryFn: () => adminTenantService.list({ search: term, page: 1, limit: 6 }),
    enabled: term.length > 0,
    staleTime: 10_000,
  });
}
export function useExtendTrial() {
  return useTenantMutation2((v: { tenantId: string; days: number; reason?: string }) =>
    adminTenantService.extendTrial(v.tenantId, { days: v.days, ...(v.reason ? { reason: v.reason } : {}) }),
  );
}
export function useSetMaintenance() {
  return useTenantMutation2((v: { tenantId: string; enabled: boolean; reason?: string }) =>
    adminTenantService.setMaintenance(v.tenantId, { enabled: v.enabled, ...(v.reason ? { reason: v.reason } : {}) }),
  );
}
export function useForceLogout() {
  return useMutation({ mutationFn: (tenantId: string) => adminTenantService.forceLogout(tenantId) });
}

function useTenantMutation2<V>(fn: (v: V) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] }),
  });
}
