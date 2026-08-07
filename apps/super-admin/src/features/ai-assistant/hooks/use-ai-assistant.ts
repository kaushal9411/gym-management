'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { notifyProgrammaticNavigation } from '@/components/navigation-progress-provider';

import { aiAssistantService } from '../services/ai-assistant.service';
import type { AiErrorCode, AiMessage, UpdatePlatformAiSettingsInput } from '../types';

const ACTIONABLE_ERROR_CODES: ReadonlySet<AiErrorCode> = new Set(['AUTH_INVALID', 'QUOTA_EXCEEDED', 'NOT_CONFIGURED']);

export function useAiConfig() {
  return useQuery({ queryKey: ['admin', 'ai-assistant', 'config'], queryFn: () => aiAssistantService.getConfig(), staleTime: 5 * 60_000 });
}

export function usePlatformAiSettings() {
  return useQuery({ queryKey: ['admin', 'ai-assistant', 'settings'], queryFn: () => aiAssistantService.getSettings() });
}

export function useUpdatePlatformAiSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePlatformAiSettingsInput) => aiAssistantService.updateSettings(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ai-assistant', 'settings'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ai-assistant', 'config'] });
    },
  });
}

export function useResetPlatformAiSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => aiAssistantService.resetSettings(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ai-assistant', 'settings'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ai-assistant', 'config'] });
    },
  });
}

export function useAiConversations(params: { page: number; limit: number }) {
  return useQuery({ queryKey: ['admin', 'ai-assistant', 'conversations', params], queryFn: () => aiAssistantService.listConversations(params) });
}

export function useAiConversation(conversationId: string | null) {
  return useQuery({
    queryKey: ['admin', 'ai-assistant', 'conversations', conversationId],
    queryFn: () => aiAssistantService.getConversation(conversationId!),
    enabled: !!conversationId,
  });
}

export function useCreateAiConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => aiAssistantService.createConversation(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'ai-assistant', 'conversations'] }),
  });
}

export function useDeleteAiConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => aiAssistantService.deleteConversation(conversationId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'ai-assistant', 'conversations'] }),
  });
}

export function useClearAiConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => aiAssistantService.clearConversation(conversationId),
    onSuccess: (_data, conversationId) => void queryClient.invalidateQueries({ queryKey: ['admin', 'ai-assistant', 'conversations', conversationId] }),
  });
}

interface UseAiChatStreamResult {
  pendingMessages: AiMessage[];
  streamingText: string;
  isStreaming: boolean;
  send: (content: string) => void;
  regenerate: () => void;
  stop: () => void;
}

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
        setPendingMessages([{ id: 'pending-user', conversationId, role: 'USER', content: body.content, createdAt: new Date().toISOString() }]);
      }

      let accumulated = '';
      try {
        for await (const event of aiAssistantService.streamChat(conversationId, body, controller.signal)) {
          if (event.type === 'delta') {
            accumulated += event.text;
            setStreamingText(accumulated);
          } else if (event.type === 'error') {
            if (event.code && ACTIONABLE_ERROR_CODES.has(event.code)) {
              toast.error(event.message, { action: { label: 'Open AI Settings', onClick: () => { notifyProgrammaticNavigation('/settings/ai'); router.push('/settings/ai'); } } });
            } else {
              toast.error(event.message);
            }
          }
        }
      } catch {
        // AbortError from Stop Generation, or a network failure.
      } finally {
        setIsStreaming(false);
        setStreamingText('');
        setPendingMessages([]);
        void queryClient.invalidateQueries({ queryKey: ['admin', 'ai-assistant', 'conversations', conversationId] });
        void queryClient.invalidateQueries({ queryKey: ['admin', 'ai-assistant', 'conversations'], exact: false });
      }
    },
    [conversationId, queryClient, router],
  );

  const send = React.useCallback((content: string) => void run({ content }), [run]);
  const regenerate = React.useCallback(() => void run({ regenerate: true }), [run]);
  const stop = React.useCallback(() => abortRef.current?.abort(), []);

  return { pendingMessages, streamingText, isStreaming, send, regenerate, stop };
}
