import { apiClient } from '@/features/auth/services/api-client';
import type {
  CreateNotificationInput,
  NotificationListResult,
  NotificationTemplate,
  NotificationTemplateType,
  TenantNotification,
  UpdateNotificationTemplateInput,
} from '../types';

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

  async getById(notificationId: string): Promise<TenantNotification> {
    const res = await apiClient.get<ApiEnvelope<TenantNotification>>(`/notifications/${notificationId}`);
    return res.data.data;
  }

  async unreadCount(): Promise<{ unreadCount: number }> {
    const res = await apiClient.get<ApiEnvelope<{ unreadCount: number }>>('/notifications/unread-count');
    return res.data.data;
  }

  async create(input: CreateNotificationInput): Promise<TenantNotification> {
    const res = await apiClient.post<ApiEnvelope<TenantNotification>>('/notifications', input);
    return res.data.data;
  }

  async remove(notificationId: string): Promise<void> {
    await apiClient.delete(`/notifications/${notificationId}`);
  }

  async markRead(notificationId: string): Promise<void> {
    await apiClient.post(`/notifications/${notificationId}/read`);
  }

  async markAllRead(): Promise<void> {
    await apiClient.post('/notifications/read-all');
  }

  async listTemplates(): Promise<NotificationTemplate[]> {
    const res = await apiClient.get<ApiEnvelope<NotificationTemplate[]>>('/notifications/templates');
    return res.data.data;
  }

  async updateTemplate(type: NotificationTemplateType, input: UpdateNotificationTemplateInput): Promise<NotificationTemplate> {
    const res = await apiClient.patch<ApiEnvelope<NotificationTemplate>>(`/notifications/templates/${type}`, input);
    return res.data.data;
  }
}

export const notificationService = new NotificationService();
