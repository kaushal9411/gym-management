'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { notifyProgrammaticNavigation } from '@/components/navigation-progress-provider';

import { aiAssistantService } from '../services/ai-assistant.service';
import type { AiErrorCode, AiMessage, UpdateTenantAiSettingsInput } from '../types';

/** `AUTH_INVALID`/`QUOTA_EXCEEDED`/`NOT_CONFIGURED` all mean "something about the AI key/provider config needs attention" — surfaced as a toast with a direct link to fix it, instead of a dead-end error. */
const ACTIONABLE_ERROR_CODES: ReadonlySet<AiErrorCode> = new Set(['AUTH_INVALID', 'QUOTA_EXCEEDED', 'NOT_CONFIGURED']);

export function useAiConfig() {
  return useQuery({ queryKey: ['ai-assistant', 'config'], queryFn: () => aiAssistantService.getConfig(), staleTime: 5 * 60_000 });
}

export function useTenantAiSettings() {
  return useQuery({ queryKey: ['ai-assistant', 'tenant-settings'], queryFn: () => aiAssistantService.getTenantSettings() });
}

export function useUpdateTenantAiSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTenantAiSettingsInput) => aiAssistantService.updateTenantSettings(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ai-assistant', 'tenant-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['ai-assistant', 'config'] });
    },
  });
}

export function useResetTenantAiSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => aiAssistantService.resetTenantSettings(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ai-assistant', 'tenant-settings'] });
      void queryClient.invalidateQueries({ queryKey: ['ai-assistant', 'config'] });
    },
  });
}

export function useAiConversations(params: { page: number; limit: number }) {
  return useQuery({ queryKey: ['ai-assistant', 'conversations', params], queryFn: () => aiAssistantService.listConversations(params) });
}

export function useAiConversation(conversationId: string | null) {
  return useQuery({
    queryKey: ['ai-assistant', 'conversations', conversationId],
    queryFn: () => aiAssistantService.getConversation(conversationId!),
    enabled: !!conversationId,
  });
}

export function useCreateAiConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => aiAssistantService.createConversation(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['ai-assistant', 'conversations'] }),
  });
}

export function useDeleteAiConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => aiAssistantService.deleteConversation(conversationId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['ai-assistant', 'conversations'] }),
  });
}

export function useClearAiConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => aiAssistantService.clearConversation(conversationId),
    onSuccess: (_data, conversationId) => void queryClient.invalidateQueries({ queryKey: ['ai-assistant', 'conversations', conversationId] }),
  });
}

export function useConfirmAiAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, messageId }: { conversationId: string; messageId: string }) => aiAssistantService.confirmAction(conversationId, messageId),
    onSuccess: (_data, { conversationId }) => void queryClient.invalidateQueries({ queryKey: ['ai-assistant', 'conversations', conversationId] }),
  });
}

export function useCancelAiAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, messageId }: { conversationId: string; messageId: string }) => aiAssistantService.cancelAction(conversationId, messageId),
    onSuccess: (_data, { conversationId }) => void queryClient.invalidateQueries({ queryKey: ['ai-assistant', 'conversations', conversationId] }),
  });
}

interface UseAiChatStreamResult {
  /** Optimistic messages for the active conversation — the real, persisted list is refetched (and this cleared) once the stream completes. */
  pendingMessages: AiMessage[];
  streamingText: string;
  isStreaming: boolean;
  send: (content: string) => void;
  regenerate: () => void;
  stop: () => void;
}

/**
 * Owns the optimistic-message + SSE-consumption lifecycle for one active
 * conversation. Kept separate from the TanStack Query hooks above — a
 * streaming response isn't cache data, it's transient UI state that
 * collapses into a `queryClient.invalidateQueries` once the stream's
 * `done`/`error` event lands (at which point the real persisted messages,
 * fetched fresh, take over from the optimistic ones).
 */
export function useAiChatStream(conversationId: string | null): UseAiChatStreamResult {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [pendingMessages, setPendingMessages] = React.useState<AiMessage[]>([]);
  const [streamingText, setStreamingText] = React.useState('');
  const [isStreaming, setIsStreaming] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  const run = React.useCallback(
    async (body: { content?: string; regenerate?: boolean }) => {
      if (!conversationId) return;
      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);
      setStreamingText('');

      if (body.content) {
        setPendingMessages([
          { id: 'pending-user', conversationId, role: 'USER', content: body.content, actionPayload: null, actionStatus: null, createdAt: new Date().toISOString() },
        ]);
      }

      let accumulated = '';
      try {
        for await (const event of aiAssistantService.streamChat(conversationId, body, controller.signal)) {
          if (event.type === 'delta') {
            accumulated += event.text;
            setStreamingText(accumulated);
          } else if (event.type === 'error') {
            // Surfaced explicitly — otherwise a failed send (e.g. the AI provider isn't configured) silently drops the optimistic user message with zero feedback, confirmed live as a real gap before this fix.
            if (event.code && ACTIONABLE_ERROR_CODES.has(event.code)) {
              toast.error(event.message, { action: { label: 'Open AI Settings', onClick: () => { notifyProgrammaticNavigation('/gym-settings/ai'); router.push('/gym-settings/ai'); } } });
            } else {
              toast.error(event.message);
            }
          }
        }
      } catch {
        // AbortError from Stop Generation, or a network failure — either way, fall through to the same cleanup.
      } finally {
        setIsStreaming(false);
        setStreamingText('');
        setPendingMessages([]);
        void queryClient.invalidateQueries({ queryKey: ['ai-assistant', 'conversations', conversationId] });
        void queryClient.invalidateQueries({ queryKey: ['ai-assistant', 'conversations'], exact: false });
      }
    },
    [conversationId, queryClient, router],
  );

  const send = React.useCallback((content: string) => void run({ content }), [run]);
  const regenerate = React.useCallback(() => void run({ regenerate: true }), [run]);
  const stop = React.useCallback(() => abortRef.current?.abort(), []);

  return { pendingMessages, streamingText, isStreaming, send, regenerate, stop };
}
