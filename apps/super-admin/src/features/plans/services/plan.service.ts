import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type { PaginatedResult } from '@/features/payments/types';
import type { Plan, PlanSubscriber, UpsertPlanInput } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class AdminPlanService {
  async list(): Promise<Plan[]> {
    try {
      const res = await apiClient.get<ApiEnvelope<Plan[]>>('/admin/plans');
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async getById(id: string): Promise<Plan> {
    try {
      const res = await apiClient.get<ApiEnvelope<Plan>>(`/admin/plans/${id}`);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async subscribers(id: string, params: { page: number; limit: number }): Promise<PaginatedResult<PlanSubscriber>> {
    try {
      const res = await apiClient.get<ApiEnvelope<PaginatedResult<PlanSubscriber>>>(`/admin/plans/${id}/subscribers`, { params });
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async create(input: UpsertPlanInput): Promise<Plan> {
    try {
      const res = await apiClient.post<ApiEnvelope<Plan>>('/admin/plans', input);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async update(id: string, input: Partial<UpsertPlanInput>): Promise<Plan> {
    try {
      const res = await apiClient.put<ApiEnvelope<Plan>>(`/admin/plans/${id}`, input);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async setActive(id: string, isActive: boolean): Promise<Plan> {
    try {
      const res = await apiClient.patch<ApiEnvelope<Plan>>(`/admin/plans/${id}/active`, { isActive });
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await apiClient.delete(`/admin/plans/${id}`);
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }
}

export const adminPlanService = new AdminPlanService();
