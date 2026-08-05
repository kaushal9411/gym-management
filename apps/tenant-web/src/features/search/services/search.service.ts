import { apiClient } from '@/features/auth/services/api-client';
import type { GlobalSearchResult } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class SearchService {
  async search(query: string): Promise<GlobalSearchResult> {
    const res = await apiClient.get<ApiEnvelope<GlobalSearchResult>>('/search', { params: { q: query } });
    return res.data.data;
  }
}

export const searchService = new SearchService();
