'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { branchSelected } from '../store/branch-slice';
import { branchService } from '../services/branch.service';

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
