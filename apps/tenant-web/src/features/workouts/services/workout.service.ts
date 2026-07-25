import { apiClient } from '@/features/auth/services/api-client';
import type {
  AssignWorkoutPlanPayload,
  CreateExercisePayload,
  CreateWorkoutPlanPayload,
  Exercise,
  ListExercisesParams,
  ListWorkoutPlansParams,
  MarkProgressPayload,
  MemberWorkoutPlan,
  MemberWorkoutPlansResponse,
  Paginated,
  PlanExerciseInput,
  UpdateExercisePayload,
  UpdateMemberWorkoutPlanPayload,
  UpdateWorkoutPlanPayload,
  WorkoutPlanDetail,
  WorkoutPlanListItem,
} from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class WorkoutService {
  // ── Exercises ──────────────────────────────────────────────────────────

  async listExercises(params: ListExercisesParams): Promise<Paginated<Exercise>> {
    const res = await apiClient.get<ApiEnvelope<Paginated<Exercise>>>('/exercises', { params });
    return res.data.data;
  }

  async listActiveExercises(): Promise<Exercise[]> {
    const res = await apiClient.get<ApiEnvelope<Exercise[]>>('/exercises/active');
    return res.data.data;
  }

  async getExerciseById(id: string): Promise<Exercise> {
    const res = await apiClient.get<ApiEnvelope<Exercise>>(`/exercises/${id}`);
    return res.data.data;
  }

  async createExercise(payload: CreateExercisePayload): Promise<Exercise> {
    const res = await apiClient.post<ApiEnvelope<Exercise>>('/exercises', payload);
    return res.data.data;
  }

  async updateExercise(id: string, payload: UpdateExercisePayload): Promise<Exercise> {
    const res = await apiClient.patch<ApiEnvelope<Exercise>>(`/exercises/${id}`, payload);
    return res.data.data;
  }

  async deleteExercise(id: string): Promise<void> {
    await apiClient.delete(`/exercises/${id}`);
  }

  async restoreExercise(id: string): Promise<Exercise> {
    const res = await apiClient.post<ApiEnvelope<Exercise>>(`/exercises/${id}/restore`);
    return res.data.data;
  }

  // ── Workout plans ──────────────────────────────────────────────────────

  async listPlans(params: ListWorkoutPlansParams): Promise<Paginated<WorkoutPlanListItem>> {
    const res = await apiClient.get<ApiEnvelope<Paginated<WorkoutPlanListItem>>>('/workout-plans', { params });
    return res.data.data;
  }

  async listAssignablePlans(): Promise<WorkoutPlanListItem[]> {
    const res = await apiClient.get<ApiEnvelope<WorkoutPlanListItem[]>>('/workout-plans/assignable');
    return res.data.data;
  }

  async getPlanById(id: string): Promise<WorkoutPlanDetail> {
    const res = await apiClient.get<ApiEnvelope<WorkoutPlanDetail>>(`/workout-plans/${id}`);
    return res.data.data;
  }

  async createPlan(payload: CreateWorkoutPlanPayload): Promise<WorkoutPlanDetail> {
    const res = await apiClient.post<ApiEnvelope<WorkoutPlanDetail>>('/workout-plans', payload);
    return res.data.data;
  }

  async updatePlan(id: string, payload: UpdateWorkoutPlanPayload): Promise<WorkoutPlanDetail> {
    const res = await apiClient.patch<ApiEnvelope<WorkoutPlanDetail>>(`/workout-plans/${id}`, payload);
    return res.data.data;
  }

  async setPlanExercises(id: string, exercises: PlanExerciseInput[]): Promise<WorkoutPlanDetail> {
    const res = await apiClient.patch<ApiEnvelope<WorkoutPlanDetail>>(`/workout-plans/${id}/exercises`, { exercises });
    return res.data.data;
  }

  async activatePlan(id: string): Promise<void> {
    await apiClient.post(`/workout-plans/${id}/activate`);
  }

  async deactivatePlan(id: string): Promise<void> {
    await apiClient.post(`/workout-plans/${id}/deactivate`);
  }

  async deletePlan(id: string): Promise<void> {
    await apiClient.delete(`/workout-plans/${id}`);
  }

  async restorePlan(id: string): Promise<WorkoutPlanDetail> {
    const res = await apiClient.post<ApiEnvelope<WorkoutPlanDetail>>(`/workout-plans/${id}/restore`);
    return res.data.data;
  }

  async duplicatePlan(id: string): Promise<WorkoutPlanDetail> {
    const res = await apiClient.post<ApiEnvelope<WorkoutPlanDetail>>(`/workout-plans/${id}/duplicate`);
    return res.data.data;
  }

  // ── Member assignment & progress ──────────────────────────────────────

  async assignPlan(planId: string, payload: AssignWorkoutPlanPayload): Promise<MemberWorkoutPlan> {
    const res = await apiClient.post<ApiEnvelope<MemberWorkoutPlan>>(`/workout-plans/${planId}/assign`, payload);
    return res.data.data;
  }

  async removeAssignment(assignmentId: string): Promise<void> {
    await apiClient.post(`/workout-plans/assignments/${assignmentId}/remove`);
  }

  async updateAssignment(assignmentId: string, payload: UpdateMemberWorkoutPlanPayload): Promise<MemberWorkoutPlan> {
    const res = await apiClient.patch<ApiEnvelope<MemberWorkoutPlan>>(`/workout-plans/assignments/${assignmentId}`, payload);
    return res.data.data;
  }

  async getMemberWorkoutPlans(memberId: string): Promise<MemberWorkoutPlansResponse> {
    const res = await apiClient.get<ApiEnvelope<MemberWorkoutPlansResponse>>(`/workout-plans/members/${memberId}`);
    return res.data.data;
  }

  async markProgress(assignmentId: string, payload: MarkProgressPayload): Promise<MemberWorkoutPlan> {
    const res = await apiClient.post<ApiEnvelope<MemberWorkoutPlan>>(`/workout-plans/assignments/${assignmentId}/progress`, payload);
    return res.data.data;
  }
}

export const workoutService = new WorkoutService();
