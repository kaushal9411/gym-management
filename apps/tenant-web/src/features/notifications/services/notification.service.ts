import { apiClient } from '@/features/auth/services/api-client';
import type { NotificationListResult } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class NotificationService {
  async list(params: { unreadOnly?: boolean; page?: number; limit?: number } = {}): Promise<NotificationListResult> {
    const res = await apiClient.get<ApiEnvelope<NotificationListResult>>('/notifications', { params });
    return res.data.data;
  }

  async markRead(notificationId: string): Promise<void> {
    await apiClient.post(`/notifications/${notificationId}/read`);
  }

  async markAllRead(): Promise<void> {
    await apiClient.post('/notifications/read-all');
  }
}

export const notificationService = new NotificationService();
