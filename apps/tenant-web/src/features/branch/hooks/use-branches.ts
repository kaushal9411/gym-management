'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthServiceError } from '@/features/auth/types';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { branchSelected } from '../store/branch-slice';
import { branchService } from '../services/branch.service';
import type { CreateBranchInput, ListBranchesParams, UpdateBranchInput } from '../types';

export function toBranchError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) return error;
  return new AuthServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

export function useBranches() {
  return useQuery({ queryKey: ['branches'], queryFn: () => branchService.list(), staleTime: 5 * 60_000 });
}

/** Current branch, defaulting to the tenant's default branch the first time the list loads. */
export function useCurrentBranch() {
  const dispatch = useAppDispatch();
  const currentBranchId = useAppSelector((state) => state.branch.currentBranchId);
  const { data: branches } = useBranches();

  React.useEffect(() => {
    if (!currentBranchId && branches && branches.length > 0) {
      const fallback = branches.find((b) => b.isDefault) ?? branches[0];
      if (fallback) dispatch(branchSelected(fallback.id));
    }
  }, [currentBranchId, branches, dispatch]);

  const currentBranch = branches?.find((b) => b.id === currentBranchId) ?? null;
  return { branches: branches ?? [], currentBranch, currentBranchId };
}

// ── Branch Management (Prompt 22) ───────────────────────────────────────

export function useBranchList(params: ListBranchesParams = {}) {
  return useQuery({ queryKey: ['branches', 'list', params], queryFn: () => branchService.listPaginated(params) });
}

export function useBranchDetail(branchId: string | null) {
  return useQuery({
    queryKey: ['branches', 'detail', branchId],
    queryFn: () => branchService.getById(branchId!),
    enabled: !!branchId,
  });
}

function useInvalidateBranches() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['branches'] });
}

export function useCreateBranch() {
  const invalidate = useInvalidateBranches();
  return useMutation({
    mutationFn: (input: CreateBranchInput) => branchService.create(input),
    onSuccess: () => void invalidate(),
  });
}

export function useUpdateBranch() {
  const invalidate = useInvalidateBranches();
  return useMutation({
    mutationFn: ({ branchId, input }: { branchId: string; input: UpdateBranchInput }) => branchService.update(branchId, input),
    onSuccess: () => void invalidate(),
  });
}

export function useActivateBranch() {
  const invalidate = useInvalidateBranches();
  return useMutation({
    mutationFn: (branchId: string) => branchService.activate(branchId),
    onSuccess: () => void invalidate(),
  });
}

export function useDeactivateBranch() {
  const invalidate = useInvalidateBranches();
  return useMutation({
    mutationFn: (branchId: string) => branchService.deactivate(branchId),
    onSuccess: () => void invalidate(),
  });
}

export function useSetDefaultBranch() {
  const invalidate = useInvalidateBranches();
  return useMutation({
    mutationFn: (branchId: string) => branchService.setDefault(branchId),
    onSuccess: () => void invalidate(),
  });
}

export function useDeleteBranch() {
  const invalidate = useInvalidateBranches();
  return useMutation({
    mutationFn: (branchId: string) => branchService.remove(branchId),
    onSuccess: () => void invalidate(),
  });
}

export function useRestoreBranch() {
  const invalidate = useInvalidateBranches();
  return useMutation({
    mutationFn: (branchId: string) => branchService.restore(branchId),
    onSuccess: () => void invalidate(),
  });
}
