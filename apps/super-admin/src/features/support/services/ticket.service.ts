import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import type { PaginatedResult, TicketDetail, TicketListItem, TicketPriority, TicketStatus } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class AdminTicketService {
  async list(params: { status?: TicketStatus; priority?: TicketPriority; page: number; limit: number }): Promise<PaginatedResult<TicketListItem>> {
    try {
      const res = await apiClient.get<ApiEnvelope<PaginatedResult<TicketListItem>>>('/admin/support/tickets', { params });
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async getById(id: string): Promise<TicketDetail> {
    try {
      const res = await apiClient.get<ApiEnvelope<TicketDetail>>(`/admin/support/tickets/${id}`);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async assign(id: string, assignedAdminId: string | null): Promise<void> {
    try {
      await apiClient.post(`/admin/support/tickets/${id}/assign`, { assignedAdminId });
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async close(id: string): Promise<void> {
    try {
      await apiClient.post(`/admin/support/tickets/${id}/close`);
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async setStatus(id: string, status: TicketStatus): Promise<void> {
    try {
      await apiClient.patch(`/admin/support/tickets/${id}/status`, { status });
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async addNote(id: string, note: string, isInternal: boolean): Promise<void> {
    try {
      await apiClient.post(`/admin/support/tickets/${id}/notes`, { note, isInternal });
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }
}

export const adminTicketService = new AdminTicketService();
