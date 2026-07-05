'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AdminServiceError } from '@/features/auth/types';
import { adminTicketService } from '../services/ticket.service';
import type { TicketPriority, TicketStatus } from '../types';

export function toTicketError(error: unknown): AdminServiceError {
  if (error instanceof AdminServiceError) return error;
  return new AdminServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

export function useTickets(params: { status?: TicketStatus; priority?: TicketPriority; page: number; limit: number }) {
  return useQuery({ queryKey: ['admin', 'tickets', params], queryFn: () => adminTicketService.list(params) });
}

export function useTicket(id: string) {
  return useQuery({ queryKey: ['admin', 'tickets', id], queryFn: () => adminTicketService.getById(id), enabled: !!id });
}

export function useAssignTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assignedAdminId }: { id: string; assignedAdminId: string | null }) => adminTicketService.assign(id, assignedAdminId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] }),
  });
}

export function useCloseTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminTicketService.close(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] }),
  });
}

export function useSetTicketStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TicketStatus }) => adminTicketService.setStatus(id, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] }),
  });
}

export function useAddTicketNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note, isInternal }: { id: string; note: string; isInternal: boolean }) => adminTicketService.addNote(id, note, isInternal),
    onSuccess: (_data, variables) => void queryClient.invalidateQueries({ queryKey: ['admin', 'tickets', variables.id] }),
  });
}
