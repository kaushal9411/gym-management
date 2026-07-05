import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type { Plan, UpsertPlanInput } from '../types';

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
