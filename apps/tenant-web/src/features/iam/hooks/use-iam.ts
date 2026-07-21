'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthServiceError } from '@/features/auth/types';
import { iamService } from '../services/iam.service';
import type {
  CreateUserPayload,
  InvitationStatus,
  ListUsersParams,
  PermissionOverride,
  UpdateProfilePayload,
  UpdateUserPayload,
} from '../types';

export function toIamError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) return error;
  return new AuthServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

// ── Users ─────────────────────────────────────────────────────────────────

export function useUsers(params: ListUsersParams) {
  return useQuery({ queryKey: ['iam', 'users', params], queryFn: () => iamService.listUsers(params) });
}

export function useUser(userId: string | null) {
  return useQuery({
    queryKey: ['iam', 'users', 'detail', userId],
    queryFn: () => iamService.getUser(userId!),
    enabled: userId !== null,
  });
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['iam', 'users'] });
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => iamService.createUser(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateUserPayload }) =>
      iamService.updateUser(userId, payload),
    onSuccess: invalidate,
  });
}

export function useUserStatusAction() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ userId, action }: { userId: string; action: 'suspend' | 'deactivate' | 'restore' | 'delete' }) => {
      if (action === 'suspend') return iamService.suspendUser(userId);
      if (action === 'deactivate') return iamService.deactivateUser(userId);
      if (action === 'restore') return iamService.restoreUser(userId);
      return iamService.deleteUser(userId);
    },
    onSuccess: invalidate,
  });
}

export function useSetUserRoles() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ userId, roleIds }: { userId: string; roleIds: string[] }) =>
      iamService.setUserRoles(userId, roleIds),
    onSuccess: invalidate,
  });
}

export function useSetUserBranches() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({
      userId,
      allBranches,
      branches,
    }: {
      userId: string;
      allBranches: boolean;
      branches: Array<{ branchId: string; isPrimary?: boolean; expiresAt?: string }>;
    }) => iamService.setUserBranches(userId, allBranches, branches),
    onSuccess: invalidate,
  });
}

export function useSetUserPermissionOverrides() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ userId, overrides }: { userId: string; overrides: PermissionOverride[] }) =>
      iamService.setUserPermissionOverrides(userId, overrides),
    onSuccess: invalidate,
  });
}

export function useBulkImportUsers() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (rows: Array<{ name: string; email: string; phone?: string; roleName?: string; password?: string }>) =>
      iamService.bulkImportUsers(rows),
    onSuccess: invalidate,
  });
}

// ── Roles ─────────────────────────────────────────────────────────────────

export function useRoles() {
  return useQuery({ queryKey: ['iam', 'roles'], queryFn: () => iamService.listRoles() });
}

export function useRole(roleId: string | null) {
  return useQuery({
    queryKey: ['iam', 'roles', roleId],
    queryFn: () => iamService.getRole(roleId!),
    enabled: roleId !== null,
  });
}

function useInvalidateRoles() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['iam', 'roles'] });
    void queryClient.invalidateQueries({ queryKey: ['iam', 'permissions'] });
  };
}

export function useCreateRole() {
  const invalidate = useInvalidateRoles();
  return useMutation({
    mutationFn: (payload: { name: string; description?: string; priority?: number; isDefault?: boolean; permissions: string[] }) =>
      iamService.createRole(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateRole() {
  const invalidate = useInvalidateRoles();
  return useMutation({
    mutationFn: ({
      roleId,
      payload,
    }: {
      roleId: string;
      payload: { name?: string; description?: string; priority?: number; isDefault?: boolean; isActive?: boolean; permissions?: string[] };
    }) => iamService.updateRole(roleId, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteRole() {
  const invalidate = useInvalidateRoles();
  return useMutation({ mutationFn: (roleId: string) => iamService.deleteRole(roleId), onSuccess: invalidate });
}

export function useCloneRole() {
  const invalidate = useInvalidateRoles();
  return useMutation({
    mutationFn: ({ roleId, name }: { roleId: string; name?: string }) => iamService.cloneRole(roleId, name),
    onSuccess: invalidate,
  });
}

// ── Permissions ───────────────────────────────────────────────────────────

export function usePermissionRegistry() {
  return useQuery({
    queryKey: ['iam', 'permissions', 'registry'],
    queryFn: () => iamService.getPermissionRegistry(),
    staleTime: 5 * 60_000,
  });
}

export function usePermissionMatrix() {
  return useQuery({ queryKey: ['iam', 'permissions', 'matrix'], queryFn: () => iamService.getPermissionMatrix() });
}

// ── Invitations ───────────────────────────────────────────────────────────

export function useInvitations(params: { status?: InvitationStatus; page?: number; limit?: number }) {
  return useQuery({ queryKey: ['iam', 'invitations', params], queryFn: () => iamService.listInvitations(params) });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { email: string; roleId: string; branchIds?: string[] }) =>
      iamService.createInvitation(payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['iam', 'invitations'] }),
  });
}

export function useInvitationAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ invitationId, action }: { invitationId: string; action: 'resend' | 'revoke' }) => {
      if (action === 'resend') await iamService.resendInvitation(invitationId);
      else await iamService.revokeInvitation(invitationId);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['iam', 'invitations'] }),
  });
}

// ── Profile ───────────────────────────────────────────────────────────────

export function useIamProfile() {
  return useQuery({ queryKey: ['iam', 'profile'], queryFn: () => iamService.getProfile() });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => iamService.updateProfile(payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['iam', 'profile'] }),
  });
}

// ── Sessions ──────────────────────────────────────────────────────────────

export function useActiveSessions() {
  return useQuery({ queryKey: ['iam', 'sessions'], queryFn: () => iamService.listActiveSessions() });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => iamService.revokeSession(sessionId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['iam', 'sessions'] }),
  });
}

export function useLoginHistory(params: { page?: number; limit?: number }) {
  return useQuery({ queryKey: ['iam', 'login-history', params], queryFn: () => iamService.getLoginHistory(params) });
}

// ── Audit ─────────────────────────────────────────────────────────────────

export function useAuditLogs(params: { page?: number; limit?: number; action?: string }) {
  return useQuery({ queryKey: ['iam', 'audit-logs', params], queryFn: () => iamService.listAuditLogs(params) });
}
