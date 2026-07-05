import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type { PaginatedResult, TenantDetail, TenantListItem, TenantStatus } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class AdminTenantService {
  async list(params: { search?: string; status?: TenantStatus; page: number; limit: number }): Promise<PaginatedResult<TenantListItem>> {
    try {
      const res = await apiClient.get<ApiEnvelope<PaginatedResult<TenantListItem>>>('/admin/tenants', { params });
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async getById(tenantId: string): Promise<TenantDetail> {
    try {
      const res = await apiClient.get<ApiEnvelope<TenantDetail>>(`/admin/tenants/${tenantId}`);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async activate(tenantId: string): Promise<void> {
    try {
      await apiClient.post(`/admin/tenants/${tenantId}/activate`);
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async suspend(tenantId: string): Promise<void> {
    try {
      await apiClient.post(`/admin/tenants/${tenantId}/suspend`);
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async reactivate(tenantId: string): Promise<void> {
    try {
      await apiClient.post(`/admin/tenants/${tenantId}/reactivate`);
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async remove(tenantId: string): Promise<void> {
    try {
      await apiClient.delete(`/admin/tenants/${tenantId}`);
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async resetOwnerPassword(tenantId: string): Promise<{ email: string }> {
    try {
      const res = await apiClient.post<ApiEnvelope<{ email: string }>>(`/admin/tenants/${tenantId}/reset-owner-password`);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async impersonate(tenantId: string): Promise<{ accessToken: string; expiresAt: string; portalUrl: string }> {
    try {
      const res = await apiClient.post<ApiEnvelope<{ accessToken: string; expiresAt: string; portalUrl: string }>>(`/admin/tenants/${tenantId}/impersonate`);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async auditLogs(tenantId: string) {
    try {
      const res = await apiClient.get<ApiEnvelope<unknown[]>>(`/admin/tenants/${tenantId}/audit-logs`);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }
}

export const adminTenantService = new AdminTenantService();
