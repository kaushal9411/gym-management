import { apiClient } from '@/features/auth/services/api-client';
import type {
  ActiveSession,
  AuditLogEntry,
  BulkImportResult,
  CreateUserPayload,
  InvitationDto,
  InvitationStatus,
  ListUsersParams,
  LoginHistoryEntry,
  Paginated,
  PermissionMatrix,
  PermissionOverride,
  PermissionRegistry,
  ProfileDto,
  RoleDto,
  UpdateProfilePayload,
  UpdateUserPayload,
  UserDetail,
  UserListItem,
} from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * One transport layer for the whole IAM surface — same axios instance as
 * auth (tenant header, bearer token, refresh, error normalization all
 * inherited). Errors bubble as AuthServiceError via the shared interceptor.
 */
class IamService {
  // ── Users ───────────────────────────────────────────────────────────────
  async listUsers(params: ListUsersParams): Promise<Paginated<UserListItem>> {
    const res = await apiClient.get<ApiEnvelope<Paginated<UserListItem>>>('/users', { params });
    return res.data.data;
  }

  async getUser(userId: string): Promise<UserDetail> {
    const res = await apiClient.get<ApiEnvelope<UserDetail>>(`/users/${userId}`);
    return res.data.data;
  }

  async createUser(payload: CreateUserPayload): Promise<UserDetail> {
    const res = await apiClient.post<ApiEnvelope<UserDetail>>('/users', payload);
    return res.data.data;
  }

  async updateUser(userId: string, payload: UpdateUserPayload): Promise<UserDetail> {
    const res = await apiClient.patch<ApiEnvelope<UserDetail>>(`/users/${userId}`, payload);
    return res.data.data;
  }

  async suspendUser(userId: string): Promise<void> {
    await apiClient.post(`/users/${userId}/suspend`);
  }

  async deactivateUser(userId: string): Promise<void> {
    await apiClient.post(`/users/${userId}/deactivate`);
  }

  async restoreUser(userId: string): Promise<void> {
    await apiClient.post(`/users/${userId}/restore`);
  }

  async deleteUser(userId: string): Promise<void> {
    await apiClient.delete(`/users/${userId}`);
  }

  async setUserRoles(userId: string, roleIds: string[]): Promise<UserDetail> {
    const res = await apiClient.put<ApiEnvelope<UserDetail>>(`/users/${userId}/roles`, { roleIds });
    return res.data.data;
  }

  async setUserBranches(
    userId: string,
    allBranches: boolean,
    branches: Array<{ branchId: string; isPrimary?: boolean; expiresAt?: string }>,
  ): Promise<UserDetail> {
    const res = await apiClient.put<ApiEnvelope<UserDetail>>(`/users/${userId}/branches`, { allBranches, branches });
    return res.data.data;
  }

  async setUserPermissionOverrides(userId: string, overrides: PermissionOverride[]): Promise<UserDetail> {
    const res = await apiClient.put<ApiEnvelope<UserDetail>>(`/users/${userId}/permissions`, { overrides });
    return res.data.data;
  }

  /** Returns a blob URL — caller revokes after triggering the download. */
  async exportUsersCsvUrl(): Promise<string> {
    const res = await apiClient.get('/users/export', { responseType: 'blob' });
    return URL.createObjectURL(res.data as Blob);
  }

  async bulkImportUsers(
    rows: Array<{ name: string; email: string; phone?: string; roleName?: string; password?: string }>,
  ): Promise<BulkImportResult> {
    const res = await apiClient.post<ApiEnvelope<BulkImportResult>>('/users/import', { rows });
    return res.data.data;
  }

  // ── Roles ───────────────────────────────────────────────────────────────
  async listRoles(): Promise<RoleDto[]> {
    const res = await apiClient.get<ApiEnvelope<RoleDto[]>>('/roles');
    return res.data.data;
  }

  async getRole(roleId: string): Promise<RoleDto> {
    const res = await apiClient.get<ApiEnvelope<RoleDto>>(`/roles/${roleId}`);
    return res.data.data;
  }

  async createRole(payload: {
    name: string;
    description?: string;
    priority?: number;
    isDefault?: boolean;
    permissions: string[];
  }): Promise<RoleDto> {
    const res = await apiClient.post<ApiEnvelope<RoleDto>>('/roles', payload);
    return res.data.data;
  }

  async updateRole(
    roleId: string,
    payload: {
      name?: string;
      description?: string;
      priority?: number;
      isDefault?: boolean;
      isActive?: boolean;
      permissions?: string[];
    },
  ): Promise<RoleDto> {
    const res = await apiClient.patch<ApiEnvelope<RoleDto>>(`/roles/${roleId}`, payload);
    return res.data.data;
  }

  async deleteRole(roleId: string): Promise<void> {
    await apiClient.delete(`/roles/${roleId}`);
  }

  async cloneRole(roleId: string, name?: string): Promise<RoleDto> {
    const res = await apiClient.post<ApiEnvelope<RoleDto>>(`/roles/${roleId}/clone`, { name });
    return res.data.data;
  }

  // ── Permissions ─────────────────────────────────────────────────────────
  async getPermissionRegistry(): Promise<PermissionRegistry> {
    const res = await apiClient.get<ApiEnvelope<PermissionRegistry>>('/permissions');
    return res.data.data;
  }

  async getPermissionMatrix(): Promise<PermissionMatrix> {
    const res = await apiClient.get<ApiEnvelope<PermissionMatrix>>('/permissions/matrix');
    return res.data.data;
  }

  // ── Invitations ─────────────────────────────────────────────────────────
  async listInvitations(params: { status?: InvitationStatus; page?: number; limit?: number }): Promise<
    Paginated<InvitationDto>
  > {
    const res = await apiClient.get<ApiEnvelope<Paginated<InvitationDto>>>('/invitations', { params });
    return res.data.data;
  }

  async createInvitation(payload: { email: string; roleId: string; branchIds?: string[] }): Promise<InvitationDto> {
    const res = await apiClient.post<ApiEnvelope<InvitationDto>>('/invitations', payload);
    return res.data.data;
  }

  async resendInvitation(invitationId: string): Promise<InvitationDto> {
    const res = await apiClient.post<ApiEnvelope<InvitationDto>>(`/invitations/${invitationId}/resend`);
    return res.data.data;
  }

  async revokeInvitation(invitationId: string): Promise<void> {
    await apiClient.delete(`/invitations/${invitationId}`);
  }

  // ── Profile ─────────────────────────────────────────────────────────────
  async getProfile(): Promise<ProfileDto> {
    const res = await apiClient.get<ApiEnvelope<ProfileDto>>('/profile');
    return res.data.data;
  }

  async updateProfile(payload: UpdateProfilePayload): Promise<ProfileDto> {
    const res = await apiClient.patch<ApiEnvelope<ProfileDto>>('/profile', payload);
    return res.data.data;
  }

  // ── Sessions ────────────────────────────────────────────────────────────
  async listActiveSessions(): Promise<ActiveSession[]> {
    const res = await apiClient.get<ApiEnvelope<ActiveSession[]>>('/auth/sessions');
    return res.data.data;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await apiClient.delete(`/auth/sessions/${sessionId}`);
  }

  async getLoginHistory(params: { page?: number; limit?: number }): Promise<Paginated<LoginHistoryEntry>> {
    const res = await apiClient.get<ApiEnvelope<Paginated<LoginHistoryEntry>>>('/sessions/login-history', { params });
    return res.data.data;
  }

  // ── Audit ───────────────────────────────────────────────────────────────
  async listAuditLogs(params: {
    page?: number;
    limit?: number;
    action?: string;
    actorUserId?: string;
  }): Promise<Paginated<AuditLogEntry>> {
    const res = await apiClient.get<ApiEnvelope<Paginated<AuditLogEntry>>>('/audit-logs', { params });
    return res.data.data;
  }
}

export const iamService = new IamService();
