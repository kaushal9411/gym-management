import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type { RevenueGrowthPoint, RevenueSummary } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class AdminRevenueService {
  async summary(): Promise<RevenueSummary> {
    try {
      const res = await apiClient.get<ApiEnvelope<RevenueSummary>>('/admin/revenue/summary');
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async growth(days = 30): Promise<RevenueGrowthPoint[]> {
    try {
      const res = await apiClient.get<ApiEnvelope<RevenueGrowthPoint[]>>('/admin/revenue/growth', { params: { days } });
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }
}

export const adminRevenueService = new AdminRevenueService();
