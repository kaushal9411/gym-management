import { apiClient } from '@/features/auth/services/api-client';
import type { CreateTicketPayload, ListTicketsParams, TicketDetail, TicketListResponse, TicketStats, TicketStatsParams } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class TicketService {
  async list(params: ListTicketsParams): Promise<TicketListResponse> {
    const res = await apiClient.get<ApiEnvelope<TicketListResponse>>('/support/tickets', { params });
    return res.data.data;
  }

  async getStats(params: TicketStatsParams): Promise<TicketStats> {
    const res = await apiClient.get<ApiEnvelope<TicketStats>>('/support/tickets/stats', { params });
    return res.data.data;
  }

  async getById(ticketId: string): Promise<TicketDetail> {
    const res = await apiClient.get<ApiEnvelope<TicketDetail>>(`/support/tickets/${ticketId}`);
    return res.data.data;
  }

  async create(payload: CreateTicketPayload): Promise<TicketDetail> {
    const res = await apiClient.post<ApiEnvelope<TicketDetail>>('/support/tickets', payload);
    return res.data.data;
  }
}

export const ticketService = new TicketService();
