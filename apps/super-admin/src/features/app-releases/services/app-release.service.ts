import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type { AppRelease, CreateAppReleasePayload } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class AdminAppReleaseService {
  async list(): Promise<AppRelease[]> {
    try {
      const res = await apiClient.get<ApiEnvelope<AppRelease[]>>('/admin/app-releases');
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async create(payload: CreateAppReleasePayload, onProgress?: (percent: number) => void): Promise<AppRelease> {
    try {
      const form = new FormData();
      form.append('file', payload.file);
      form.append('version', payload.version);
      form.append('versionCode', String(payload.versionCode));
      if (payload.releaseNotes) form.append('releaseNotes', payload.releaseNotes);
      if (payload.activate !== undefined) form.append('activate', String(payload.activate));

      const res = await apiClient.post<ApiEnvelope<AppRelease>>('/admin/app-releases', form, {
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async activate(id: string): Promise<AppRelease> {
    try {
      const res = await apiClient.post<ApiEnvelope<AppRelease>>(`/admin/app-releases/${id}/activate`);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await apiClient.delete(`/admin/app-releases/${id}`);
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }
}

export const adminAppReleaseService = new AdminAppReleaseService();
