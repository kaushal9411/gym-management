import { AppError, NotFoundError } from '../../../core/errors/app-error';
import { logger } from '../../../core/logging/logger';
import { adminUserRepository } from '../../admin-auth/repositories/admin-user.repository';
import type { AiErrorCode } from '../../ai-assistant/providers/error-classification';
import { getAiProvider, getEffectiveAiConfig } from '../../ai-assistant/providers/factory';
import type { AiChatMessage } from '../../ai-assistant/providers/types';
import { buildAdminSystemPrompt } from '../constants/admin-system-prompt';
import { adminAiConversationRepository } from '../repositories/admin-ai-conversation.repository';
import { adminAiMessageRepository } from '../repositories/admin-ai-message.repository';
import { adminAiRequestLogRepository } from '../repositories/admin-ai-request-log.repository';

import { buildPlatformContext } from './admin-ai-context.service';
import { adminAiSettingsService } from './admin-ai-settings.service';

const MAX_HISTORY_MESSAGES = 20;
const TITLE_MAX_LENGTH = 60;

export type AdminChatStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; messageId: string; content: string }
  | { type: 'error'; message: string; code?: AiErrorCode };

function errorCodeOf(error: unknown): AiErrorCode | undefined {
  if (error instanceof AppError && typeof error.details?.code === 'string') return error.details.code as AiErrorCode;
  return undefined;
}

function deriveTitle(content: string): string {
  const singleLine = content.replace(/\s+/g, ' ').trim();
  return singleLine.length > TITLE_MAX_LENGTH ? `${singleLine.slice(0, TITLE_MAX_LENGTH - 1)}…` : singleLine || 'New conversation';
}

/**
 * The super-admin equivalent of `AiChatService` — same streaming-generator
 * shape, no tenant scoping (admin-plane, no RLS), no AI Actions (query-only
 * — there's no confirm/execute flow on this side, deliberately out of scope
 * for this pass). Reuses the identical provider abstraction and error
 * classification as the tenant assistant.
 */
export class AdminAiChatService {
  async listConversations(adminUserId: string, page: number, limit: number) {
    const { total, items } = await adminAiConversationRepository.listForUser(adminUserId, { skip: (page - 1) * limit, take: limit });
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async createConversation(adminUserId: string) {
    return adminAiConversationRepository.create(adminUserId, 'New conversation');
  }

  async getConversation(adminUserId: string, conversationId: string) {
    const conversation = await this.mustFindOwn(adminUserId, conversationId);
    const messages = await adminAiMessageRepository.listForConversation(conversationId);
    return { ...conversation, messages };
  }

  async deleteConversation(adminUserId: string, conversationId: string) {
    await this.mustFindOwn(adminUserId, conversationId);
    await adminAiConversationRepository.delete(conversationId);
  }

  async clearConversation(adminUserId: string, conversationId: string) {
    await this.mustFindOwn(adminUserId, conversationId);
    await adminAiMessageRepository.clearForConversation(conversationId);
  }

  private async mustFindOwn(adminUserId: string, conversationId: string) {
    const conversation = await adminAiConversationRepository.findByIdForUser(adminUserId, conversationId);
    if (!conversation) throw new NotFoundError('Conversation not found.');
    return conversation;
  }

  async *respond(
    adminUserId: string,
    conversationId: string,
    content: string | null,
    regenerate: boolean,
    signal?: AbortSignal,
  ): AsyncGenerator<AdminChatStreamEvent> {
    await this.mustFindOwn(adminUserId, conversationId);

    const override = await adminAiSettingsService.resolveProviderOverride();
    let provider: ReturnType<typeof getAiProvider>;
    try {
      provider = getAiProvider(override);
    } catch (error) {
      yield { type: 'error', message: (error as Error).message, code: errorCodeOf(error) ?? 'NOT_CONFIGURED' };
      return;
    }
    const effectiveConfig = getEffectiveAiConfig(override);

    if (regenerate) {
      await adminAiMessageRepository.deleteTrailingAssistantMessages(conversationId);
    } else {
      if (!content?.trim()) {
        yield { type: 'error', message: 'Message content is required.' };
        return;
      }
      await adminAiMessageRepository.create({ conversationId, role: 'USER', content });
      await adminAiConversationRepository.renameIfDefault(conversationId, deriveTitle(content));
    }

    const history = await adminAiMessageRepository.listForConversation(conversationId);
    const permissions = await adminUserRepository.getPermissionKeys(adminUserId);
    const contextBlock = await buildPlatformContext(permissions);

    const chatMessages: AiChatMessage[] = [
      { role: 'system', content: buildAdminSystemPrompt(contextBlock) },
      ...history.slice(-MAX_HISTORY_MESSAGES).map((m): AiChatMessage => ({ role: m.role.toLowerCase() as 'user' | 'assistant', content: m.content })),
    ];

    const startedAt = Date.now();
    let fullContent = '';

    try {
      for await (const delta of provider.stream({
        messages: chatMessages,
        model: effectiveConfig.model,
        temperature: effectiveConfig.temperature,
        maxTokens: effectiveConfig.maxTokens,
        signal,
      })) {
        fullContent += delta;
        yield { type: 'delta', text: delta };
      }

      const assistantMessage = await adminAiMessageRepository.create({ conversationId, role: 'ASSISTANT', content: fullContent });
      await adminAiConversationRepository.touch(conversationId);
      await adminAiRequestLogRepository.record({
        adminUserId,
        conversationId,
        provider: provider.name,
        model: effectiveConfig.model,
        durationMs: Date.now() - startedAt,
        status: 'SUCCESS',
      });

      yield { type: 'done', messageId: assistantMessage.id, content: fullContent };
    } catch (error) {
      const message = (error as Error).message;
      const code = errorCodeOf(error) ?? 'GENERIC';
      logger.error('Admin AI provider request failed', { adminUserId, provider: provider.name, error: message, code });
      await adminAiRequestLogRepository.record({
        adminUserId,
        conversationId,
        provider: provider.name,
        model: effectiveConfig.model,
        durationMs: Date.now() - startedAt,
        status: 'ERROR',
        error: message,
      });
      yield {
        type: 'error',
        message:
          code === 'AUTH_INVALID'
            ? 'Your AI provider API key looks invalid or has been revoked. Update it in AI Settings.'
            : code === 'QUOTA_EXCEEDED'
              ? 'Your AI provider is out of credit or rate-limited. Add credit or update your key in AI Settings.'
              : 'The AI assistant could not complete this request. Please try again.',
        code,
      };
    }
  }
}

export const adminAiChatService = new AdminAiChatService();
