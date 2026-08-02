import { apiClient } from '@/features/auth/services/api-client';
import type { CreateTicketPayload, ListTicketsParams, Paginated, TicketDetail, TicketListItem } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

class TicketService {
  async list(params: ListTicketsParams): Promise<Paginated<TicketListItem>> {
    const res = await apiClient.get<ApiEnvelope<Paginated<TicketListItem>>>('/support/tickets', { params });
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
