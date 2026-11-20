import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type { Lead, LeadList, LeadListParams, LeadStatus } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class AdminLeadService {
  async list(params: LeadListParams): Promise<LeadList> {
    try {
      const res = await apiClient.get<ApiEnvelope<LeadList>>('/admin/leads', { params });
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  /** `notes: null` clears the notes; omit a key to leave it unchanged. */
  async update(id: string, patch: { status?: LeadStatus; notes?: string | null }): Promise<Lead> {
    try {
      const res = await apiClient.patch<ApiEnvelope<Lead>>(`/admin/leads/${id}`, patch);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await apiClient.delete(`/admin/leads/${id}`);
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }
}

export const adminLeadService = new AdminLeadService();
