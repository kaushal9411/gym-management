import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type { FeatureFlag } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class AdminFeatureFlagService {
  async list(): Promise<FeatureFlag[]> {
    try {
      const res = await apiClient.get<ApiEnvelope<FeatureFlag[]>>('/admin/feature-flags');
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async setEnabled(key: string, enabled: boolean): Promise<FeatureFlag> {
    try {
      const res = await apiClient.patch<ApiEnvelope<FeatureFlag>>(`/admin/feature-flags/${key}`, { enabled });
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }
}

export const adminFeatureFlagService = new AdminFeatureFlagService();
