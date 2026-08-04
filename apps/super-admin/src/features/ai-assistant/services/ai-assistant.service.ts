import { apiClient, toAdminServiceError } from '@/features/auth/services/api-client';
import { getActiveStore } from '@/store';
import type {
  AiConfig,
  AiConversation,
  AiConversationDetail,
  ChatStreamEvent,
  PaginatedResult,
  PlatformAiSettings,
  UpdatePlatformAiSettingsInput,
} from '../types';

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

class AiAssistantService {
  async getConfig(): Promise<AiConfig> {
    try {
      const res = await apiClient.get<ApiEnvelope<AiConfig>>('/admin/ai/config');
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async getSettings(): Promise<PlatformAiSettings> {
    try {
      const res = await apiClient.get<ApiEnvelope<PlatformAiSettings>>('/admin/ai/settings');
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async updateSettings(input: UpdatePlatformAiSettingsInput): Promise<PlatformAiSettings> {
    try {
      const res = await apiClient.put<ApiEnvelope<PlatformAiSettings>>('/admin/ai/settings', input);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async resetSettings(): Promise<void> {
    try {
      await apiClient.delete('/admin/ai/settings');
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async listConversations(params: { page: number; limit: number }): Promise<PaginatedResult<AiConversation>> {
    try {
      const res = await apiClient.get<ApiEnvelope<PaginatedResult<AiConversation>>>('/admin/ai/conversations', { params });
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async createConversation(): Promise<AiConversation> {
    try {
      const res = await apiClient.post<ApiEnvelope<AiConversation>>('/admin/ai/conversations');
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async getConversation(conversationId: string): Promise<AiConversationDetail> {
    try {
      const res = await apiClient.get<ApiEnvelope<AiConversationDetail>>(`/admin/ai/conversations/${conversationId}`);
      return res.data.data;
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    try {
      await apiClient.delete(`/admin/ai/conversations/${conversationId}`);
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  async clearConversation(conversationId: string): Promise<void> {
    try {
      await apiClient.post(`/admin/ai/conversations/${conversationId}/clear`);
    } catch (error) {
      throw toAdminServiceError(error);
    }
  }

  /** Raw `fetch`, not axios — same reasoning as the tenant-web version: axios can't hand back a readable byte stream as SSE chunks arrive. */
  async *streamChat(conversationId: string, body: { content?: string; regenerate?: boolean }, signal: AbortSignal): AsyncGenerator<ChatStreamEvent> {
    const token = getActiveStore()?.getState().auth.accessToken;

    const response = await fetch(`${API_BASE_URL}/admin/ai/conversations/${conversationId}/messages/stream`, {
      method: 'POST',
      credentials: 'include',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
