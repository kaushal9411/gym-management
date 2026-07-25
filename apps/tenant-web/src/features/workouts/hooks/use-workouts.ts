'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthServiceError } from '@/features/auth/types';
import { workoutService } from '../services/workout.service';
import type {
  AssignWorkoutPlanPayload,
  CreateExercisePayload,
  CreateWorkoutPlanPayload,
  ListExercisesParams,
  ListWorkoutPlansParams,
  MarkProgressPayload,
  PlanExerciseInput,
  UpdateExercisePayload,
  UpdateMemberWorkoutPlanPayload,
  UpdateWorkoutPlanPayload,
} from '../types';

export function toWorkoutError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) return error;
  return new AuthServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

function useInvalidateExercises() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['exercises'] });
}

function useInvalidateWorkoutPlans() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ['workout-plans'] });
}

// ── Exercises ────────────────────────────────────────────────────────────

export function useExerciseList(params: ListExercisesParams) {
  return useQuery({ queryKey: ['exercises', 'list', params], queryFn: () => workoutService.listExercises(params) });
}

export function useActiveExercises() {
  return useQuery({ queryKey: ['exercises', 'active'], queryFn: () => workoutService.listActiveExercises() });
}

export function useExercise(id: string | null) {
  return useQuery({ queryKey: ['exercises', 'detail', id], queryFn: () => workoutService.getExerciseById(id!), enabled: id !== null });
}

export function useCreateExercise() {
  const invalidate = useInvalidateExercises();
  return useMutation({ mutationFn: (payload: CreateExercisePayload) => workoutService.createExercise(payload), onSuccess: invalidate });
}

export function useUpdateExercise() {
  const invalidate = useInvalidateExercises();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateExercisePayload }) => workoutService.updateExercise(id, payload),
    onSuccess: invalidate,
  });
}

export function useExerciseStatusAction() {
  const invalidate = useInvalidateExercises();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'delete' | 'restore' }) => {
      if (action === 'delete') return workoutService.deleteExercise(id);
      await workoutService.restoreExercise(id);
      return undefined;
    },
    onSuccess: invalidate,
  });
}

// ── Workout plans ────────────────────────────────────────────────────────

export function useWorkoutPlanList(params: ListWorkoutPlansParams) {
  return useQuery({ queryKey: ['workout-plans', 'list', params], queryFn: () => workoutService.listPlans(params) });
}

export function useAssignableWorkoutPlans() {
  return useQuery({ queryKey: ['workout-plans', 'assignable'], queryFn: () => workoutService.listAssignablePlans() });
}

export function useWorkoutPlan(id: string | null) {
  return useQuery({ queryKey: ['workout-plans', 'detail', id], queryFn: () => workoutService.getPlanById(id!), enabled: id !== null });
}

export function useCreateWorkoutPlan() {
  const invalidate = useInvalidateWorkoutPlans();
  return useMutation({ mutationFn: (payload: CreateWorkoutPlanPayload) => workoutService.createPlan(payload), onSuccess: invalidate });
}

export function useUpdateWorkoutPlan() {
  const invalidate = useInvalidateWorkoutPlans();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateWorkoutPlanPayload }) => workoutService.updatePlan(id, payload),
    onSuccess: invalidate,
  });
}

export function useSetPlanExercises() {
  const invalidate = useInvalidateWorkoutPlans();
  return useMutation({
    mutationFn: ({ id, exercises }: { id: string; exercises: PlanExerciseInput[] }) => workoutService.setPlanExercises(id, exercises),
    onSuccess: invalidate,
  });
}

export function useWorkoutPlanStatusAction() {
  const invalidate = useInvalidateWorkoutPlans();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'activate' | 'deactivate' | 'delete' | 'restore' | 'duplicate' }) => {
      if (action === 'activate') return workoutService.activatePlan(id);
      if (action === 'deactivate') return workoutService.deactivatePlan(id);
      if (action === 'delete') return workoutService.deletePlan(id);
      if (action === 'restore') {
        await workoutService.restorePlan(id);
        return undefined;
      }
      await workoutService.duplicatePlan(id);
      return undefined;
    },
    onSuccess: invalidate,
  });
}

export function useDuplicateWorkoutPlan() {
  const invalidate = useInvalidateWorkoutPlans();
  return useMutation({ mutationFn: (id: string) => workoutService.duplicatePlan(id), onSuccess: invalidate });
}

// ── Member assignment & progress ────────────────────────────────────────

export function useMemberWorkoutPlans(memberId: string | null) {
  return useQuery({
    queryKey: ['workout-plans', 'member', memberId],
    queryFn: () => workoutService.getMemberWorkoutPlans(memberId!),
    enabled: memberId !== null,
  });
}

export function useAssignWorkoutPlan() {
  const invalidate = useInvalidateWorkoutPlans();
  return useMutation({
    mutationFn: ({ planId, payload }: { planId: string; payload: AssignWorkoutPlanPayload }) => workoutService.assignPlan(planId, payload),
    onSuccess: invalidate,
  });
}

export function useRemoveWorkoutAssignment() {
  const invalidate = useInvalidateWorkoutPlans();
  return useMutation({ mutationFn: (assignmentId: string) => workoutService.removeAssignment(assignmentId), onSuccess: invalidate });
}

export function useUpdateWorkoutAssignment() {
  const invalidate = useInvalidateWorkoutPlans();
  return useMutation({
    mutationFn: ({ assignmentId, payload }: { assignmentId: string; payload: UpdateMemberWorkoutPlanPayload }) =>
      workoutService.updateAssignment(assignmentId, payload),
    onSuccess: invalidate,
  });
}

export function useMarkWorkoutProgress() {
  const invalidate = useInvalidateWorkoutPlans();
  return useMutation({
    mutationFn: ({ assignmentId, payload }: { assignmentId: string; payload: MarkProgressPayload }) =>
      workoutService.markProgress(assignmentId, payload),
    onSuccess: invalidate,
  });
}
