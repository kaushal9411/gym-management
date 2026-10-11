'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toAuthServiceError } from '@/features/auth/services/api-client';
import { LeadError, leadsService } from '../services/leads.service';
import type {
  AddActivityPayload,
  AnalyticsParams,
  ChangeStatusPayload,
  ConvertLeadPayload,
  CreateLeadPayload,
  ListLeadsParams,
  UpdateLeadPayload,
} from '../types';

export { LeadError };

export function toLeadError(error: unknown): LeadError {
  if (error instanceof LeadError) return error;
  const base = toAuthServiceError(error);
  return new LeadError(base.message, [], base.code);
}

export function useLeadList(params: ListLeadsParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['leads', 'list', params],
    queryFn: () => leadsService.list(params),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useLeadDetail(id: string) {
  return useQuery({
    queryKey: ['leads', 'detail', id],
    queryFn: () => leadsService.get(id),
    retry: (count, err) => (err instanceof LeadError && err.notFound ? false : count < 2),
  });
}

export function useLeadAnalytics(params: AnalyticsParams, enabled = true) {
  return useQuery({
    queryKey: ['leads', 'analytics', params],
    queryFn: () => leadsService.analytics(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useFollowUps(bucket: 'due' | 'overdue' | 'today' | 'upcoming', scope: 'mine' | 'all', branchId?: string) {
  return useQuery({
    queryKey: ['leads', 'follow-ups', bucket, scope, branchId ?? ''],
    queryFn: () => leadsService.followUps({ bucket, scope, branchId, limit: 30 }),
  });
}

export function useLeadAssignees() {
  return useQuery({ queryKey: ['leads', 'assignees'], queryFn: () => leadsService.assignees(), staleTime: 5 * 60_000 });
}

function useInvalidateLeads() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: ['leads'] });
}

export function useCreateLead() {
  const invalidate = useInvalidateLeads();
  return useMutation({ mutationFn: (p: CreateLeadPayload) => leadsService.create(p), onSuccess: invalidate });
}

export function useUpdateLead() {
  const invalidate = useInvalidateLeads();
  return useMutation({ mutationFn: ({ id, payload }: { id: string; payload: UpdateLeadPayload }) => leadsService.update(id, payload), onSuccess: invalidate });
}

export function useDeleteLead() {
  const invalidate = useInvalidateLeads();
  return useMutation({ mutationFn: (id: string) => leadsService.remove(id), onSuccess: invalidate });
}

export function useChangeLeadStatus() {
  const invalidate = useInvalidateLeads();
  return useMutation({ mutationFn: ({ id, payload }: { id: string; payload: ChangeStatusPayload }) => leadsService.changeStatus(id, payload), onSuccess: invalidate });
}

export function useAssignLead() {
  const invalidate = useInvalidateLeads();
  return useMutation({ mutationFn: ({ id, userId }: { id: string; userId: string | null }) => leadsService.assign(id, userId), onSuccess: invalidate });
}

export function useAddLeadActivity() {
  const invalidate = useInvalidateLeads();
  return useMutation({ mutationFn: ({ id, payload }: { id: string; payload: AddActivityPayload }) => leadsService.addActivity(id, payload), onSuccess: invalidate });
}

export function useConvertLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ConvertLeadPayload }) => leadsService.convert(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leads'] });
      void qc.invalidateQueries({ queryKey: ['members'] });
    },
  });
}
