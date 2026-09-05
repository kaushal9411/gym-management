import { apiClient } from '@/features/auth/services/api-client';
import type { CmsPage, CmsPageType } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class CmsService {
  /** `GET /public/cms/pages?type=...` — no auth required, only ever returns published pages. */
  async listPublished(type: CmsPageType): Promise<CmsPage[]> {
    const res = await apiClient.get<ApiEnvelope<CmsPage[]>>('/public/cms/pages', { params: { type } });
    return res.data.data;
  }
}

export const cmsService = new CmsService();
