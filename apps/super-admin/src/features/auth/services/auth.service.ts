import { apiClient, toAdminServiceError } from './api-client';
import type { AdminProfile, EstablishedSession, LoginPayload, SessionTokens } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

interface AdminAuthSuccessDto {
  admin: AdminProfile;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
}

function toSession(dto: AdminAuthSuccessDto): EstablishedSession {
  const tokens: SessionTokens = { accessToken: dto.accessToken, refreshToken: dto.refreshToken, accessTokenExpiresAt: dto.accessTokenExpiresAt };
  return { admin: dto.admin, tokens };
}

class AdminAuthService {
  async login(payload: LoginPayload): Promise<EstablishedSession> {
    try {
      const res = await apiClient.post<ApiEnvelope<AdminAuthSuccessDto>>('/admin/auth/login', payload);
      return toSession(res.data.data);
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async fetchCurrentAdmin(): Promise<AdminProfile> {
    try {
      const res = await apiClient.get<ApiEnvelope<AdminProfile>>('/admin/auth/me');
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async logout(refreshToken: string | null): Promise<void> {
    try {
      await apiClient.post('/admin/auth/logout', refreshToken ? { refreshToken } : {});
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }
}

export const adminAuthService = new AdminAuthService();
