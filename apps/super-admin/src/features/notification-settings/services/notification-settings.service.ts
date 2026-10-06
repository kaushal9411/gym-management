import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type { PlatformNotificationCredentials, UpdatePlatformNotificationCredentialsInput } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class NotificationSettingsService {
  async getCredentials(): Promise<PlatformNotificationCredentials> {
    try {
      const res = await apiClient.get<ApiEnvelope<PlatformNotificationCredentials>>('/admin/notification-settings');
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async updateCredentials(input: UpdatePlatformNotificationCredentialsInput): Promise<PlatformNotificationCredentials> {
    try {
      const res = await apiClient.patch<ApiEnvelope<PlatformNotificationCredentials>>('/admin/notification-settings', input);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }
}

export const notificationSettingsService = new NotificationSettingsService();
