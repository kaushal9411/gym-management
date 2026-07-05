import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type { AuditLogEntry, PaginatedResult } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class AdminAuditService {
  async list(params: { action?: string; page: number; limit: number }): Promise<PaginatedResult<AuditLogEntry>> {
    try {
      const res = await apiClient.get<ApiEnvelope<PaginatedResult<AuditLogEntry>>>('/admin/audit-logs', { params });
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }
}

export const adminAuditService = new AdminAuditService();
