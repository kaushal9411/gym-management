import { apiClient } from '@/features/auth/services/api-client';
import type { Announcement } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class AnnouncementService {
  async listActive(): Promise<Announcement[]> {
    const res = await apiClient.get<ApiEnvelope<Announcement[]>>('/announcements/active');
    return res.data.data;
  }
}

export const announcementService = new AnnouncementService();
