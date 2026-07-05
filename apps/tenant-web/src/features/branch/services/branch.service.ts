import { apiClient } from '@/features/auth/services/api-client';
import type { Branch } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class BranchService {
  async list(): Promise<Branch[]> {
    const res = await apiClient.get<ApiEnvelope<Branch[]>>('/branches');
    return res.data.data;
  }
}

export const branchService = new BranchService();
