import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type { SystemSetting } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class AdminSettingsService {
  async list(): Promise<SystemSetting[]> {
    try {
      const res = await apiClient.get<ApiEnvelope<SystemSetting[]>>('/admin/settings');
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async upsert(key: string, category: string, value: unknown): Promise<SystemSetting> {
    try {
      const res = await apiClient.put<ApiEnvelope<SystemSetting>>(`/admin/settings/${key}`, { category, value });
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }
}

export const adminSettingsService = new AdminSettingsService();
