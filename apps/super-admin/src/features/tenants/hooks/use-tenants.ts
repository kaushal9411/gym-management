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
