import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type { AdminNotification, Announcement, CreateAnnouncementInput, CreateNotificationInput } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class AdminNotificationService {
  async listAnnouncements(): Promise<Announcement[]> {
    try {
      const res = await apiClient.get<ApiEnvelope<Announcement[]>>('/admin/notifications/announcements');
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async createAnnouncement(input: CreateAnnouncementInput): Promise<Announcement> {
    try {
      const res = await apiClient.post<ApiEnvelope<Announcement>>('/admin/notifications/announcements', input);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async setAnnouncementActive(id: string, isActive: boolean): Promise<Announcement> {
    try {
      const res = await apiClient.patch<ApiEnvelope<Announcement>>(`/admin/notifications/announcements/${id}/active`, { isActive });
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async listNotifications(): Promise<AdminNotification[]> {
    try {
      const res = await apiClient.get<ApiEnvelope<AdminNotification[]>>('/admin/notifications');
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async createNotification(input: CreateNotificationInput): Promise<AdminNotification> {
    try {
      const res = await apiClient.post<ApiEnvelope<AdminNotification>>('/admin/notifications', input);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async send(id: string): Promise<AdminNotification> {
    try {
      const res = await apiClient.post<ApiEnvelope<AdminNotification>>(`/admin/notifications/${id}/send`);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }
}

export const adminNotificationService = new AdminNotificationService();
