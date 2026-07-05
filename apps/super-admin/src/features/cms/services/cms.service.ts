import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type { CmsPage, CmsPageType, UpsertCmsPageInput } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class AdminCmsService {
  async list(type?: CmsPageType): Promise<CmsPage[]> {
    try {
      const res = await apiClient.get<ApiEnvelope<CmsPage[]>>('/admin/cms/pages', { params: type ? { type } : undefined });
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async create(input: UpsertCmsPageInput): Promise<CmsPage> {
    try {
      const res = await apiClient.post<ApiEnvelope<CmsPage>>('/admin/cms/pages', input);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async update(slug: string, input: Partial<UpsertCmsPageInput>): Promise<CmsPage> {
    try {
      const res = await apiClient.put<ApiEnvelope<CmsPage>>(`/admin/cms/pages/${slug}`, input);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async remove(slug: string): Promise<void> {
    try {
      await apiClient.delete(`/admin/cms/pages/${slug}`);
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }
}

export const adminCmsService = new AdminCmsService();
