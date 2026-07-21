'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthServiceError } from '@/features/auth/types';
import { staffService } from '../services/staff.service';
import type {
  AssignBranchesPayload,
  AssignRolePayload,
  CreateStaffPayload,
  ListStaffParams,
  StaffBulkImportRow,
  UpdateStaffPayload,
} from '../types';

export function toStaffError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) return error;
  return new AuthServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

function useInvalidateStaff() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['staff'] });
}

export function useStaffList(params: ListStaffParams) {
  return useQuery({ queryKey: ['staff', 'list', params], queryFn: () => staffService.list(params) });
}

export function useStaffDetail(staffId: string | null) {
  return useQuery({
    queryKey: ['staff', 'detail', staffId],
    queryFn: () => staffService.getById(staffId!),
    enabled: staffId !== null,
  });
}

export function useCreateStaff() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (payload: CreateStaffPayload) => staffService.create(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateStaff() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: ({ staffId, payload }: { staffId: string; payload: UpdateStaffPayload }) =>
      staffService.update(staffId, payload),
    onSuccess: invalidate,
  });
}

export function useStaffStatusAction() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: ({
      staffId,
      action,
    }: {
      staffId: string;
      action: 'activate' | 'deactivate' | 'suspend' | 'restore' | 'delete';
    }) => {
      if (action === 'activate') return staffService.activate(staffId);
      if (action === 'deactivate') return staffService.deactivate(staffId);
      if (action === 'suspend') return staffService.suspend(staffId);
      if (action === 'restore') return staffService.restore(staffId);
      return staffService.softDelete(staffId);
    },
    onSuccess: invalidate,
  });
}

export function useResetStaffPassword() {
  return useMutation({ mutationFn: (staffId: string) => staffService.resetPassword(staffId) });
}

export function useResendStaffActivation() {
  return useMutation({ mutationFn: (staffId: string) => staffService.resendActivation(staffId) });
}

export function useAssignStaffBranches() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: ({ staffId, payload }: { staffId: string; payload: AssignBranchesPayload }) =>
      staffService.assignBranches(staffId, payload),
    onSuccess: invalidate,
  });
}

export function useAssignStaffRole() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: ({ staffId, payload }: { staffId: string; payload: AssignRolePayload }) =>
      staffService.assignRole(staffId, payload),
    onSuccess: invalidate,
  });
}

export function useBulkImportStaff() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (rows: StaffBulkImportRow[]) => staffService.bulkImport(rows),
    onSuccess: invalidate,
  });
}

export function useBulkStaffAction() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: ({ userIds, action }: { userIds: string[]; action: 'activate' | 'deactivate' | 'delete' }) => {
      if (action === 'activate') return staffService.bulkActivate(userIds);
      if (action === 'deactivate') return staffService.bulkDeactivate(userIds);
      return staffService.bulkDelete(userIds);
    },
    onSuccess: invalidate,
  });
}

// ── Public activation flow ─────────────────────────────────────────────────

export function useStaffActivation(token: string) {
  return useQuery({ queryKey: ['staff', 'activation', token], queryFn: () => staffService.lookupActivation(token), retry: false });
}

export function useAcceptStaffActivation() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) => staffService.acceptActivation(token, password),
  });
}
