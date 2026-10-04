import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type { DashboardOverview, DashboardStats, OverviewRange } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class DashboardService {
  async getOverview(range: OverviewRange): Promise<DashboardOverview> {
    try {
      const res = await apiClient.get<ApiEnvelope<DashboardOverview>>('/admin/dashboard/overview', { params: { range } });
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async getStats(): Promise<DashboardStats> {
    try {
      const res = await apiClient.get<ApiEnvelope<DashboardStats>>('/admin/dashboard/stats');
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }
}

export const dashboardService = new DashboardService();
