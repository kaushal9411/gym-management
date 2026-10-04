'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AuthServiceError } from '@/features/auth/types';
import { ticketService } from '../services/ticket.service';
import type { CreateTicketPayload, ListTicketsParams, TicketStatsParams } from '../types';

export function toTicketError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) return error;
  return new AuthServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

export function useTicketList(params: ListTicketsParams, enabled = true) {
  return useQuery({
    queryKey: ['support', 'tickets', 'list', params],
    queryFn: () => ticketService.list(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** `GET /support/tickets/stats` (analytics section only; failure hides the section, never the list). */
export function useTicketStats(params: TicketStatsParams, enabled = true) {
  return useQuery({
    queryKey: ['support', 'tickets', 'stats', params],
    queryFn: () => ticketService.getStats(params),
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useTicketDetail(ticketId: string | null) {
  return useQuery({
    queryKey: ['support', 'tickets', 'detail', ticketId],
    queryFn: () => ticketService.getById(ticketId!),
    enabled: ticketId !== null,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTicketPayload) => ticketService.create(payload),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] }),
  });
}
