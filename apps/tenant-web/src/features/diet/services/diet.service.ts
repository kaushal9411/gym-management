import { apiClient } from '@/features/auth/services/api-client';
import type {
  AssignDietPlanPayload,
  CreateDietPlanPayload,
  CreateFoodPayload,
  DietPlanDetail,
  DietPlanListItem,
  Food,
  ListDietPlansParams,
  ListFoodsParams,
  MemberDietPlan,
  MemberDietPlansResponse,
  Paginated,
  PlanMealInput,
  UpdateDietPlanPayload,
  UpdateDietProgressPayload,
  UpdateFoodPayload,
  UpdateMemberDietPlanPayload,
} from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class DietService {
  // ── Foods ──────────────────────────────────────────────────────────────

  async listFoods(params: ListFoodsParams): Promise<Paginated<Food>> {
    const res = await apiClient.get<ApiEnvelope<Paginated<Food>>>('/foods', { params });
    return res.data.data;
  }

  async listActiveFoods(): Promise<Food[]> {
    const res = await apiClient.get<ApiEnvelope<Food[]>>('/foods/active');
    return res.data.data;
  }

  async getFoodById(id: string): Promise<Food> {
    const res = await apiClient.get<ApiEnvelope<Food>>(`/foods/${id}`);
    return res.data.data;
  }

  async createFood(payload: CreateFoodPayload): Promise<Food> {
    const res = await apiClient.post<ApiEnvelope<Food>>('/foods', payload);
    return res.data.data;
  }

  async updateFood(id: string, payload: UpdateFoodPayload): Promise<Food> {
    const res = await apiClient.patch<ApiEnvelope<Food>>(`/foods/${id}`, payload);
    return res.data.data;
  }

  async deleteFood(id: string): Promise<void> {
    await apiClient.delete(`/foods/${id}`);
  }

  async restoreFood(id: string): Promise<Food> {
    const res = await apiClient.post<ApiEnvelope<Food>>(`/foods/${id}/restore`);
    return res.data.data;
  }

  // ── Diet plans ─────────────────────────────────────────────────────────

  async listPlans(params: ListDietPlansParams): Promise<Paginated<DietPlanListItem>> {
    const res = await apiClient.get<ApiEnvelope<Paginated<DietPlanListItem>>>('/diet-plans', { params });
    return res.data.data;
  }

  async listAssignablePlans(): Promise<DietPlanListItem[]> {
    const res = await apiClient.get<ApiEnvelope<DietPlanListItem[]>>('/diet-plans/assignable');
    return res.data.data;
  }

  async getPlanById(id: string): Promise<DietPlanDetail> {
    const res = await apiClient.get<ApiEnvelope<DietPlanDetail>>(`/diet-plans/${id}`);
    return res.data.data;
  }

  async createPlan(payload: CreateDietPlanPayload): Promise<DietPlanDetail> {
    const res = await apiClient.post<ApiEnvelope<DietPlanDetail>>('/diet-plans', payload);
    return res.data.data;
  }

  async updatePlan(id: string, payload: UpdateDietPlanPayload): Promise<DietPlanDetail> {
    const res = await apiClient.patch<ApiEnvelope<DietPlanDetail>>(`/diet-plans/${id}`, payload);
    return res.data.data;
  }

  async setPlanMeals(id: string, meals: PlanMealInput[]): Promise<DietPlanDetail> {
    const res = await apiClient.patch<ApiEnvelope<DietPlanDetail>>(`/diet-plans/${id}/meals`, { meals });
    return res.data.data;
  }

  async activatePlan(id: string): Promise<void> {
    await apiClient.post(`/diet-plans/${id}/activate`);
  }

  async deactivatePlan(id: string): Promise<void> {
    await apiClient.post(`/diet-plans/${id}/deactivate`);
  }

  async deletePlan(id: string): Promise<void> {
    await apiClient.delete(`/diet-plans/${id}`);
  }

  async restorePlan(id: string): Promise<DietPlanDetail> {
    const res = await apiClient.post<ApiEnvelope<DietPlanDetail>>(`/diet-plans/${id}/restore`);
    return res.data.data;
  }

  async duplicatePlan(id: string): Promise<DietPlanDetail> {
    const res = await apiClient.post<ApiEnvelope<DietPlanDetail>>(`/diet-plans/${id}/duplicate`);
    return res.data.data;
  }

  // ── Member assignment & progress ──────────────────────────────────────

  async assignPlan(planId: string, payload: AssignDietPlanPayload): Promise<MemberDietPlan> {
    const res = await apiClient.post<ApiEnvelope<MemberDietPlan>>(`/diet-plans/${planId}/assign`, payload);
    return res.data.data;
  }

  async removeAssignment(assignmentId: string): Promise<void> {
    await apiClient.post(`/diet-plans/assignments/${assignmentId}/remove`);
  }

  async updateAssignment(assignmentId: string, payload: UpdateMemberDietPlanPayload): Promise<MemberDietPlan> {
    const res = await apiClient.patch<ApiEnvelope<MemberDietPlan>>(`/diet-plans/assignments/${assignmentId}`, payload);
    return res.data.data;
  }

  async getMemberDietPlans(memberId: string): Promise<MemberDietPlansResponse> {
    const res = await apiClient.get<ApiEnvelope<MemberDietPlansResponse>>(`/diet-plans/members/${memberId}`);
    return res.data.data;
  }

  async updateProgress(assignmentId: string, payload: UpdateDietProgressPayload): Promise<MemberDietPlan> {
    const res = await apiClient.post<ApiEnvelope<MemberDietPlan>>(`/diet-plans/assignments/${assignmentId}/progress`, payload);
    return res.data.data;
  }
}

export const dietService = new DietService();
