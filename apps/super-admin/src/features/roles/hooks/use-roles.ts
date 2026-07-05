'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AdminServiceError } from '@/features/auth/types';
import { adminRoleService } from '../services/role.service';
import type { CreateAdminInput } from '../types';

export function toRoleError(error: unknown): AdminServiceError {
  if (error instanceof AdminServiceError) return error;
  return new AdminServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

export function usePermissionCatalog() {
  return useQuery({ queryKey: ['admin', 'permissions'], queryFn: () => adminRoleService.listPermissions() });
}

export function useRoles() {
  return useQuery({ queryKey: ['admin', 'roles'], queryFn: () => adminRoleService.listRoles() });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string; permissionKeys: string[] }) => adminRoleService.createRole(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] }),
  });
}

export function useUpdateRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissionKeys }: { roleId: string; permissionKeys: string[] }) => adminRoleService.updateRolePermissions(roleId, permissionKeys),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] }),
  });
}

export function useAdmins(params: { search?: string; page: number; limit: number }) {
  return useQuery({ queryKey: ['admin', 'admins', params], queryFn: () => adminRoleService.listAdmins(params) });
}

export function useCreateAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAdminInput) => adminRoleService.createAdmin(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] }),
  });
}

export function useUpdateAdminRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ adminId, roleId }: { adminId: string; roleId: string }) => adminRoleService.updateAdminRole(adminId, roleId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] }),
  });
}

export function useSetAdminStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ adminId, status }: { adminId: string; status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' }) => adminRoleService.setAdminStatus(adminId, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'admins'] }),
  });
}
