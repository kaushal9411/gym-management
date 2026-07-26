import { apiClient } from '@/features/auth/services/api-client';
import type { Branch, BranchDetail, BranchListResult, CreateBranchInput, ListBranchesParams, UpdateBranchInput } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class BranchService {
  /** Unfiltered active-branch list — same endpoint/shape the portal's branch selector has always used. */
  async list(): Promise<Branch[]> {
    const res = await apiClient.get<ApiEnvelope<Branch[]>>('/branches/assignable');
    return res.data.data;
  }

  async listPaginated(params: ListBranchesParams = {}): Promise<BranchListResult> {
    const res = await apiClient.get<ApiEnvelope<BranchListResult>>('/branches', { params });
    return res.data.data;
  }

  async getById(branchId: string): Promise<BranchDetail> {
    const res = await apiClient.get<ApiEnvelope<BranchDetail>>(`/branches/${branchId}`);
    return res.data.data;
  }

  async create(input: CreateBranchInput): Promise<BranchDetail> {
    const res = await apiClient.post<ApiEnvelope<BranchDetail>>('/branches', input);
    return res.data.data;
  }

  async update(branchId: string, input: UpdateBranchInput): Promise<BranchDetail> {
    const res = await apiClient.patch<ApiEnvelope<BranchDetail>>(`/branches/${branchId}`, input);
    return res.data.data;
  }

  async activate(branchId: string): Promise<void> {
    await apiClient.post(`/branches/${branchId}/activate`);
  }

  async deactivate(branchId: string): Promise<void> {
    await apiClient.post(`/branches/${branchId}/deactivate`);
  }

  async setDefault(branchId: string): Promise<BranchDetail> {
    const res = await apiClient.post<ApiEnvelope<BranchDetail>>(`/branches/${branchId}/set-default`);
    return res.data.data;
  }

  async remove(branchId: string): Promise<void> {
    await apiClient.delete(`/branches/${branchId}`);
  }

  async restore(branchId: string): Promise<BranchDetail> {
    const res = await apiClient.post<ApiEnvelope<BranchDetail>>(`/branches/${branchId}/restore`);
    return res.data.data;
  }
}

export const branchService = new BranchService();
