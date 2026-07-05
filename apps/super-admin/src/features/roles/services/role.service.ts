import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type { AdminPermission, AdminRole, AdminUserListItem, CreateAdminInput, CreateAdminResult, PaginatedResult } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class AdminRoleService {
  async listPermissions(): Promise<AdminPermission[]> {
    try {
      const res = await apiClient.get<ApiEnvelope<AdminPermission[]>>('/admin/roles/permissions');
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async listRoles(): Promise<AdminRole[]> {
    try {
      const res = await apiClient.get<ApiEnvelope<AdminRole[]>>('/admin/roles');
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async createRole(input: { name: string; description?: string; permissionKeys: string[] }): Promise<AdminRole> {
    try {
      const res = await apiClient.post<ApiEnvelope<AdminRole>>('/admin/roles', input);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async updateRolePermissions(roleId: string, permissionKeys: string[]): Promise<AdminRole> {
    try {
      const res = await apiClient.put<ApiEnvelope<AdminRole>>(`/admin/roles/${roleId}/permissions`, { permissionKeys });
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async listAdmins(params: { search?: string; page: number; limit: number }): Promise<PaginatedResult<AdminUserListItem>> {
    try {
      const res = await apiClient.get<ApiEnvelope<PaginatedResult<AdminUserListItem>>>('/admin/roles/admins', { params });
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async createAdmin(input: CreateAdminInput): Promise<CreateAdminResult> {
    try {
      const res = await apiClient.post<ApiEnvelope<CreateAdminResult>>('/admin/roles/admins', input);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async updateAdminRole(adminId: string, roleId: string): Promise<void> {
    try {
      await apiClient.patch(`/admin/roles/admins/${adminId}/role`, { roleId });
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async setAdminStatus(adminId: string, status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'): Promise<void> {
    try {
      await apiClient.patch(`/admin/roles/admins/${adminId}/status`, { status });
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }
}

export const adminRoleService = new AdminRoleService();
