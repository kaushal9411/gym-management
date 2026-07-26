import { apiClient } from '@/features/auth/services/api-client';
import type {
  AnnouncementListResult,
  AnnouncementStatus,
  CreateAnnouncementInput,
  ScheduleAnnouncementInput,
  TenantAnnouncement,
  UpdateAnnouncementInput,
} from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class AnnouncementService {
  async list(params: { status?: AnnouncementStatus; page?: number; limit?: number } = {}): Promise<AnnouncementListResult> {
    const res = await apiClient.get<ApiEnvelope<AnnouncementListResult>>('/tenant-announcements', { params });
    return res.data.data;
  }

  async getById(id: string): Promise<TenantAnnouncement> {
    const res = await apiClient.get<ApiEnvelope<TenantAnnouncement>>(`/tenant-announcements/${id}`);
    return res.data.data;
  }

  async create(input: CreateAnnouncementInput): Promise<TenantAnnouncement> {
    const res = await apiClient.post<ApiEnvelope<TenantAnnouncement>>('/tenant-announcements', input);
    return res.data.data;
  }

  async update(id: string, input: UpdateAnnouncementInput): Promise<TenantAnnouncement> {
    const res = await apiClient.patch<ApiEnvelope<TenantAnnouncement>>(`/tenant-announcements/${id}`, input);
    return res.data.data;
  }

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/tenant-announcements/${id}`);
  }

  async publish(id: string): Promise<TenantAnnouncement> {
    const res = await apiClient.post<ApiEnvelope<TenantAnnouncement>>(`/tenant-announcements/${id}/publish`);
    return res.data.data;
  }

  async schedule(id: string, input: ScheduleAnnouncementInput): Promise<TenantAnnouncement> {
    const res = await apiClient.post<ApiEnvelope<TenantAnnouncement>>(`/tenant-announcements/${id}/schedule`, input);
    return res.data.data;
  }
}

export const announcementService = new AnnouncementService();
