import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

interface PlatformConfig {
  appName: string;
}

/** `GET /public/platform-config` — no auth required, works on the login screen too. */
class PlatformConfigService {
  async get(): Promise<PlatformConfig> {
    try {
      const res = await apiClient.get<ApiEnvelope<PlatformConfig>>('/public/platform-config');
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }
}

export const platformConfigService = new PlatformConfigService();
