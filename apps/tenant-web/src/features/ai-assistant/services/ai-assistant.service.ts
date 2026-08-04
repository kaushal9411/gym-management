import { apiClient, toAuthServiceError } from '@/features/auth/services/api-client';
import { getCurrentTenantSlug } from '@/features/auth/utils/tenant-detection';
import { getActiveStore } from '@/store';
import type { AiConfig, AiConversation, AiConversationDetail, ChatStreamEvent, PaginatedResult } from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

class AiAssistantService {
  async getConfig(): Promise<AiConfig> {
    try {
      const res = await apiClient.get<ApiEnvelope<AiConfig>>('/ai/config');
      return res.data.data;
    } catch (error) {
      throw toAuthServiceError(error);
    }
  }

  async listConversations(params: { page: number; limit: number }): Promise<PaginatedResult<AiConversation>> {
    try {
      const res = await apiClient.get<ApiEnvelope<PaginatedResult<AiConversation>>>('/ai/conversations', { params });
      return res.data.data;
    } catch (error) {
      throw toAuthServiceError(error);
    }
  }

  async createConversation(): Promise<AiConversation> {
    try {
      const res = await apiClient.post<ApiEnvelope<AiConversation>>('/ai/conversations');
      return res.data.data;
    } catch (error) {
      throw toAuthServiceError(error);
    }
  }

  async getConversation(conversationId: string): Promise<AiConversationDetail> {
    try {
      const res = await apiClient.get<ApiEnvelope<AiConversationDetail>>(`/ai/conversations/${conversationId}`);
      return res.data.data;
    } catch (error) {
      throw toAuthServiceError(error);
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    try {
      await apiClient.delete(`/ai/conversations/${conversationId}`);
    } catch (error) {
      throw toAuthServiceError(error);
    }
  }

  async clearConversation(conversationId: string): Promise<void> {
    try {
      await apiClient.post(`/ai/conversations/${conversationId}/clear`);
    } catch (error) {
      throw toAuthServiceError(error);
    }
  }

  async confirmAction(conversationId: string, messageId: string): Promise<{ result: string }> {
    try {
      const res = await apiClient.post<ApiEnvelope<{ result: string }>>(`/ai/conversations/${conversationId}/actions/${messageId}/confirm`);
      return res.data.data;
    } catch (error) {
      throw toAuthServiceError(error);
    }
  }

  async cancelAction(conversationId: string, messageId: string): Promise<void> {
    try {
      await apiClient.post(`/ai/conversations/${conversationId}/actions/${messageId}/cancel`);
    } catch (error) {
      throw toAuthServiceError(error);
    }
  }

  /**
   * Raw `fetch`, not axios — axios' browser adapter can't hand back a
   * readable byte stream as chunks arrive, which SSE consumption needs.
   * Reuses the exact same auth/tenant header logic `api-client.ts`'s
   * interceptors apply, just inlined here since there's no interceptor
   * pipeline to hook into for a plain fetch call.
   */
  async *streamChat(
    conversationId: string,
    body: { content?: string; regenerate?: boolean },
    signal: AbortSignal,
  ): AsyncGenerator<ChatStreamEvent> {
    const token = getActiveStore()?.getState().auth.accessToken;
    const slug = getCurrentTenantSlug();

    const response = await fetch(`${API_BASE_URL}/ai/conversations/${conversationId}/messages/stream`, {
      method: 'POST',
      credentials: 'include',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(slug ? { 'X-Tenant-Slug': slug } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok || !response.body) {
      yield { type: 'error', message: 'Could not reach the AI assistant. Please try again.' };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const records = buffer.split('\n\n');
        buffer = records.pop() ?? '';

        for (const record of records) {
          for (const line of record.split('\n')) {
            const trimmed = line.trimStart();
            if (!trimmed.startsWith('data:')) continue;
            try {
              yield JSON.parse(trimmed.slice(5).trim()) as ChatStreamEvent;
            } catch {
              // Malformed chunk — skip rather than break the whole stream.
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export const aiAssistantService = new AiAssistantService();
