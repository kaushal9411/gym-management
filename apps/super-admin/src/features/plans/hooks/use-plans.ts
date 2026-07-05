'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AdminServiceError } from '@/features/auth/types';
import { adminPlanService } from '../services/plan.service';
import type { UpsertPlanInput } from '../types';

export function toPlanError(error: unknown): AdminServiceError {
  if (error instanceof AdminServiceError) return error;
  return new AdminServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

export function usePlans() {
  return useQuery({ queryKey: ['admin', 'plans'], queryFn: () => adminPlanService.list() });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertPlanInput) => adminPlanService.create(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] }),
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<UpsertPlanInput> }) => adminPlanService.update(id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] }),
  });
}

export function useSetPlanActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => adminPlanService.setActive(id, isActive),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] }),
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminPlanService.remove(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] }),
  });
}
