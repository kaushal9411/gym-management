'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthServiceError } from '@/features/auth/types';
import { dietService } from '../services/diet.service';
import type {
  AssignDietPlanPayload,
  CreateDietPlanPayload,
  CreateFoodPayload,
  ListDietPlansParams,
  ListFoodsParams,
  PlanMealInput,
  UpdateDietPlanPayload,
  UpdateDietProgressPayload,
  UpdateFoodPayload,
  UpdateMemberDietPlanPayload,
} from '../types';

export function toDietError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) return error;
  return new AuthServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

function useInvalidateFoods() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['foods'] });
}

function useInvalidateDietPlans() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['diet-plans'] });
}

// ── Foods ────────────────────────────────────────────────────────────────

export function useFoodList(params: ListFoodsParams) {
  return useQuery({ queryKey: ['foods', 'list', params], queryFn: () => dietService.listFoods(params) });
}

export function useActiveFoods() {
  return useQuery({ queryKey: ['foods', 'active'], queryFn: () => dietService.listActiveFoods() });
}

export function useFood(id: string | null) {
  return useQuery({ queryKey: ['foods', 'detail', id], queryFn: () => dietService.getFoodById(id!), enabled: id !== null });
}

export function useCreateFood() {
  const invalidate = useInvalidateFoods();
  return useMutation({ mutationFn: (payload: CreateFoodPayload) => dietService.createFood(payload), onSuccess: invalidate });
}

export function useUpdateFood() {
  const invalidate = useInvalidateFoods();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateFoodPayload }) => dietService.updateFood(id, payload),
    onSuccess: invalidate,
  });
}

export function useFoodStatusAction() {
  const invalidate = useInvalidateFoods();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'delete' | 'restore' }) => {
      if (action === 'delete') return dietService.deleteFood(id);
      await dietService.restoreFood(id);
      return undefined;
    },
    onSuccess: invalidate,
  });
}

// ── Diet plans ───────────────────────────────────────────────────────────

export function useDietPlanList(params: ListDietPlansParams) {
  return useQuery({ queryKey: ['diet-plans', 'list', params], queryFn: () => dietService.listPlans(params) });
}

export function useAssignableDietPlans() {
  return useQuery({ queryKey: ['diet-plans', 'assignable'], queryFn: () => dietService.listAssignablePlans() });
}

export function useDietPlan(id: string | null) {
  return useQuery({ queryKey: ['diet-plans', 'detail', id], queryFn: () => dietService.getPlanById(id!), enabled: id !== null });
}

export function useCreateDietPlan() {
  const invalidate = useInvalidateDietPlans();
  return useMutation({ mutationFn: (payload: CreateDietPlanPayload) => dietService.createPlan(payload), onSuccess: invalidate });
}

export function useUpdateDietPlan() {
  const invalidate = useInvalidateDietPlans();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateDietPlanPayload }) => dietService.updatePlan(id, payload),
    onSuccess: invalidate,
  });
}

export function useSetPlanMeals() {
  const invalidate = useInvalidateDietPlans();
  return useMutation({
    mutationFn: ({ id, meals }: { id: string; meals: PlanMealInput[] }) => dietService.setPlanMeals(id, meals),
    onSuccess: invalidate,
  });
}

export function useDietPlanStatusAction() {
  const invalidate = useInvalidateDietPlans();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'activate' | 'deactivate' | 'delete' | 'restore' | 'duplicate' }) => {
      if (action === 'activate') return dietService.activatePlan(id);
      if (action === 'deactivate') return dietService.deactivatePlan(id);
      if (action === 'delete') return dietService.deletePlan(id);
      if (action === 'restore') {
        await dietService.restorePlan(id);
        return undefined;
      }
      await dietService.duplicatePlan(id);
      return undefined;
    },
    onSuccess: invalidate,
  });
}

export function useDuplicateDietPlan() {
  const invalidate = useInvalidateDietPlans();
  return useMutation({ mutationFn: (id: string) => dietService.duplicatePlan(id), onSuccess: invalidate });
}

// ── Member assignment & progress ────────────────────────────────────────

export function useMemberDietPlans(memberId: string | null) {
  return useQuery({
    queryKey: ['diet-plans', 'member', memberId],
    queryFn: () => dietService.getMemberDietPlans(memberId!),
    enabled: memberId !== null,
  });
}

export function useAssignDietPlan() {
  const invalidate = useInvalidateDietPlans();
  return useMutation({
    mutationFn: ({ planId, payload }: { planId: string; payload: AssignDietPlanPayload }) => dietService.assignPlan(planId, payload),
    onSuccess: invalidate,
  });
}

export function useRemoveDietAssignment() {
  const invalidate = useInvalidateDietPlans();
  return useMutation({ mutationFn: (assignmentId: string) => dietService.removeAssignment(assignmentId), onSuccess: invalidate });
}

export function useUpdateDietAssignment() {
  const invalidate = useInvalidateDietPlans();
  return useMutation({
    mutationFn: ({ assignmentId, payload }: { assignmentId: string; payload: UpdateMemberDietPlanPayload }) =>
      dietService.updateAssignment(assignmentId, payload),
    onSuccess: invalidate,
  });
}

export function useUpdateDietProgress() {
  const invalidate = useInvalidateDietPlans();
  return useMutation({
    mutationFn: ({ assignmentId, payload }: { assignmentId: string; payload: UpdateDietProgressPayload }) =>
      dietService.updateProgress(assignmentId, payload),
    onSuccess: invalidate,
  });
}
