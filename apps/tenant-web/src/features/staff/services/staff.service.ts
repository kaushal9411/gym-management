import { apiClient } from '@/features/auth/services/api-client';
import type {
  AssignBranchesPayload,
  AssignRolePayload,
  BulkStaffActionResult,
  CreateStaffPayload,
  ListStaffParams,
  Paginated,
  StaffBulkImportResult,
  StaffBulkImportRow,
  StaffDetail,
  StaffListItem,
  UpdateStaffPayload,
} from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

/** Same axios instance as auth/IAM — tenant header, bearer token, refresh, error normalization all inherited. */
class StaffService {
  async list(params: ListStaffParams): Promise<Paginated<StaffListItem>> {
    const res = await apiClient.get<ApiEnvelope<Paginated<StaffListItem>>>('/staff', { params });
    return res.data.data;
  }

  async getById(staffId: string): Promise<StaffDetail> {
    const res = await apiClient.get<ApiEnvelope<StaffDetail>>(`/staff/${staffId}`);
    return res.data.data;
  }

  async create(payload: CreateStaffPayload): Promise<StaffDetail> {
    const res = await apiClient.post<ApiEnvelope<StaffDetail>>('/staff', payload);
    return res.data.data;
  }

  async update(staffId: string, payload: UpdateStaffPayload): Promise<StaffDetail> {
    const res = await apiClient.patch<ApiEnvelope<StaffDetail>>(`/staff/${staffId}`, payload);
    return res.data.data;
  }

  async activate(staffId: string): Promise<void> {
    await apiClient.post(`/staff/${staffId}/activate`);
  }

  async deactivate(staffId: string): Promise<void> {
    await apiClient.post(`/staff/${staffId}/deactivate`);
  }

  async suspend(staffId: string): Promise<void> {
    await apiClient.post(`/staff/${staffId}/suspend`);
  }

  async restore(staffId: string): Promise<void> {
    await apiClient.post(`/staff/${staffId}/restore`);
  }

  async softDelete(staffId: string): Promise<void> {
    await apiClient.delete(`/staff/${staffId}`);
  }

  async resetPassword(staffId: string): Promise<void> {
    await apiClient.post(`/staff/${staffId}/reset-password`);
  }

  async resendActivation(staffId: string): Promise<void> {
    await apiClient.post(`/staff/${staffId}/resend-activation`);
  }

  async assignBranches(staffId: string, payload: AssignBranchesPayload): Promise<StaffDetail> {
    const res = await apiClient.put<ApiEnvelope<StaffDetail>>(`/staff/${staffId}/branches`, payload);
    return res.data.data;
  }

  async assignRole(staffId: string, payload: AssignRolePayload): Promise<StaffDetail> {
    const res = await apiClient.put<ApiEnvelope<StaffDetail>>(`/staff/${staffId}/role`, payload);
    return res.data.data;
  }

  /** Returns a blob URL — caller revokes after triggering the download. */
  async exportCsvUrl(): Promise<string> {
    const res = await apiClient.get('/staff/export', { responseType: 'blob' });
    return URL.createObjectURL(res.data as Blob);
  }

  async bulkImport(rows: StaffBulkImportRow[]): Promise<StaffBulkImportResult> {
    const res = await apiClient.post<ApiEnvelope<StaffBulkImportResult>>('/staff/import', { rows });
    return res.data.data;
  }

  async bulkActivate(userIds: string[]): Promise<BulkStaffActionResult> {
    const res = await apiClient.post<ApiEnvelope<BulkStaffActionResult>>('/staff/bulk/activate', { userIds });
    return res.data.data;
  }

  async bulkDeactivate(userIds: string[]): Promise<BulkStaffActionResult> {
    const res = await apiClient.post<ApiEnvelope<BulkStaffActionResult>>('/staff/bulk/deactivate', { userIds });
    return res.data.data;
  }

  async bulkDelete(userIds: string[]): Promise<BulkStaffActionResult> {
    const res = await apiClient.post<ApiEnvelope<BulkStaffActionResult>>('/staff/bulk/delete', { userIds });
    return res.data.data;
  }

  // ── Public activation flow ────────────────────────────────────────────
  async lookupActivation(token: string): Promise<{ name: string; email: string; expiresAt: string }> {
    const res = await apiClient.get<ApiEnvelope<{ name: string; email: string; expiresAt: string }>>(
      '/staff/activation/lookup',
      { params: { token } },
    );
    return res.data.data;
  }

  async acceptActivation(token: string, password: string): Promise<{ email: string }> {
    const res = await apiClient.post<ApiEnvelope<{ email: string }>>('/staff/activation/accept', { token, password });
    return res.data.data;
  }
}

export const staffService = new StaffService();
