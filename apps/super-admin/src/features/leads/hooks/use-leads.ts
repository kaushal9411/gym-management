'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AdminServiceError } from '@/features/auth/types';
import { adminLeadService } from '../services/lead.service';
import type { LeadListParams, LeadStatus } from '../types';

export function toLeadError(error: unknown): AdminServiceError {
  if (error instanceof AdminServiceError) return error;
  return new AdminServiceError('UNKNOWN', 'Something went wrong. Please try again.');
}

export function useLeads(params: LeadListParams) {
  return useQuery({
    queryKey: ['admin', 'leads', params],
    queryFn: () => adminLeadService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; status?: LeadStatus; notes?: string | null }) => adminLeadService.update(id, patch),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] }),
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminLeadService.remove(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] }),
  });
}
