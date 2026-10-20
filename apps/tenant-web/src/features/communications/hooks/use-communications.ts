'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { communicationsService } from '../services/communications.service';
import type {
  AudienceMemberParams,
  AutomationInput,
  AutomationKey,
  CampaignInput,
  CampaignListParams,
  CampaignPatch,
  Channel,
  PreviewRequest,
  RecipientListParams,
  SyncedTemplate,
  TestSendInput,
} from '../types';

/** Every query/mutation here shares the `['communications', …]` root so one invalidation refreshes the hub. */
const ROOT = ['communications'] as const;

export function useCommunicationsOverview(enabled = true) {
  return useQuery({
    queryKey: [...ROOT, 'overview'],
    queryFn: () => communicationsService.overview(),
    enabled,
    staleTime: 15_000,
  });
}

/** Notification-settings templates as starter text; always refetched on mount so edits / switch-offs there show up. */
export function useCommunicationTemplates(enabled = true) {
  return useQuery<SyncedTemplate[]>({
    queryKey: [...ROOT, 'templates'],
    queryFn: () => communicationsService.listTemplates(),
    enabled,
    staleTime: 0,
  });
}

/** Live audience count + per-channel contactable/quota numbers. Call with an already-debounced request. */
export function useAudiencePreview(request: PreviewRequest | null) {
  return useQuery({
    queryKey: [...ROOT, 'preview', request],
    queryFn: () => communicationsService.previewAudience(request!),
    enabled: request !== null,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}

export function useAudienceMembers(params: AudienceMemberParams, enabled = true) {
  return useQuery({
    queryKey: [...ROOT, 'audience-members', params],
    queryFn: () => communicationsService.listAudienceMembers(params),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

/** Polls while any row is still SENDING so counts move without a manual refresh. */
export function useCampaigns(params: CampaignListParams, enabled = true) {
  return useQuery({
    queryKey: [...ROOT, 'campaigns', params],
    queryFn: () => communicationsService.listCampaigns(params),
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: (q) => (q.state.data?.items.some((c) => c.status === 'SENDING') ? 4000 : false),
  });
}

/** One campaign; polls every ~2.5 s while it is SENDING (contract: counts move as messages are handed over). */
export function useCampaign(id: string | null) {
  return useQuery({
    queryKey: [...ROOT, 'campaign', id],
    queryFn: () => communicationsService.getCampaign(id!),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.status === 'SENDING' ? 2500 : false),
  });
}

export function useCampaignRecipients(id: string | null, params: RecipientListParams) {
  return useQuery({
    queryKey: [...ROOT, 'recipients', id, params],
    queryFn: () => communicationsService.listRecipients(id!, params),
    enabled: !!id,
    placeholderData: keepPreviousData,
    refetchInterval: (q) => (q.state.data?.items.some((r) => r.status === 'QUEUED') ? 4000 : false),
  });
}

export function useAutomations(enabled = true) {
  return useQuery({
    queryKey: [...ROOT, 'automations'],
    queryFn: () => communicationsService.listAutomations(),
    enabled,
  });
}

function useRefreshCommunications() {
  const queryClient = useQueryClient();
  return () => {
    // Previews depend on live quota, so they refresh too.
    void queryClient.invalidateQueries({ queryKey: ROOT });
  };
}

export function useCreateCampaign() {
  const refresh = useRefreshCommunications();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CampaignInput; idempotencyKey: string }) => communicationsService.createCampaign(input, idempotencyKey),
    onSuccess: refresh,
  });
}

export function useUpdateCampaign() {
  const refresh = useRefreshCommunications();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: CampaignPatch }) => communicationsService.updateCampaign(id, patch),
    onSuccess: refresh,
  });
}

export function useSendDraft() {
  const refresh = useRefreshCommunications();
  return useMutation({
    mutationFn: ({ id, confirmLargeSend }: { id: string; confirmLargeSend: boolean }) => communicationsService.sendDraft(id, confirmLargeSend),
    onSuccess: refresh,
  });
}

export function useCancelCampaign() {
  const refresh = useRefreshCommunications();
  return useMutation({ mutationFn: (id: string) => communicationsService.cancelCampaign(id), onSuccess: refresh });
}

export function useRetryFailed() {
  const refresh = useRefreshCommunications();
  return useMutation({ mutationFn: (id: string) => communicationsService.retryFailed(id), onSuccess: refresh });
}

export function useTestSend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TestSendInput) => communicationsService.testSend(input),
    // A test consumes quota, so the header meters move.
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [...ROOT, 'overview'] }),
  });
}

export function useUpdateAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, input }: { key: AutomationKey; input: AutomationInput }) => communicationsService.updateAutomation(key, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...ROOT, 'automations'] });
      void queryClient.invalidateQueries({ queryKey: [...ROOT, 'overview'] });
    },
  });
}

export function useTestAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, channels }: { key: AutomationKey; channels?: Channel[] }) => communicationsService.testAutomation(key, channels),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: [...ROOT, 'overview'] }),
  });
}
