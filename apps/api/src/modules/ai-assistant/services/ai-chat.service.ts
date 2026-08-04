import type { Prisma } from '@prisma/client';

import { env } from '../../../config/env';
import { NotFoundError, ValidationError } from '../../../core/errors/app-error';
import { logger } from '../../../core/logging/logger';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import type { IamActor } from '../../authentication/utils/actor.util';
import { permissionEngine } from '../../permissions/services/permission-engine.service';
import { extractActionProposal, type AiActionProposal } from '../constants/action-types';
import { buildSystemPrompt } from '../constants/system-prompt';
import { getAiProvider } from '../providers/factory';
import type { AiChatMessage } from '../providers/types';
import { AiConversationRepository } from '../repositories/ai-conversation.repository';
import { AiMessageRepository } from '../repositories/ai-message.repository';
import { AiRequestLogRepository } from '../repositories/ai-request-log.repository';

import { buildTenantContext } from './ai-context.service';

const MAX_HISTORY_MESSAGES = 20;
const TITLE_MAX_LENGTH = 60;

export type ChatStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; messageId: string; content: string; action: AiActionProposal | null }
  | { type: 'error'; message: string };

function deriveTitle(content: string): string {
  const singleLine = content.replace(/\s+/g, ' ').trim();
  return singleLine.length > TITLE_MAX_LENGTH ? `${singleLine.slice(0, TITLE_MAX_LENGTH - 1)}…` : singleLine || 'New conversation';
}

export class AiChatService {
  private readonly conversations: AiConversationRepository;
  private readonly messages: AiMessageRepository;
  private readonly requestLogs: AiRequestLogRepository;

  constructor(private readonly tenantId: string) {
    const db = getTenantScopedClient(tenantId);
    this.conversations = new AiConversationRepository(db);
    this.messages = new AiMessageRepository(db);
    this.requestLogs = new AiRequestLogRepository(db);
  }

  async listConversations(userId: string, page: number, limit: number) {
    const { total, items } = await this.conversations.listForUser(this.tenantId, userId, { skip: (page - 1) * limit, take: limit });
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async createConversation(userId: string) {
    return this.conversations.create(this.tenantId, userId, 'New conversation');
  }

  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.mustFindOwn(userId, conversationId);
    const messages = await this.messages.listForConversation(conversationId);
    return { ...conversation, messages };
  }

  async deleteConversation(userId: string, conversationId: string) {
    await this.mustFindOwn(userId, conversationId);
    await this.conversations.delete(conversationId);
  }

  async clearConversation(userId: string, conversationId: string) {
    await this.mustFindOwn(userId, conversationId);
    await this.messages.clearForConversation(conversationId);
  }

  private async mustFindOwn(userId: string, conversationId: string) {
    const conversation = await this.conversations.findByIdForUser(this.tenantId, userId, conversationId);
    if (!conversation) throw new NotFoundError('Conversation not found.');
    return conversation;
  }

  /**
   * The one path both the streaming and non-streaming "send message"
   * endpoints funnel through. `regenerate: true` skips adding a new user
   * message and instead removes the trailing assistant reply so a fresh
   * completion can be generated from the same point — this is what backs
   * "Regenerate Response".
   */
  async *respond(
    actor: IamActor,
    tenantName: string,
    conversationId: string,
    content: string | null,
    regenerate: boolean,
    signal?: AbortSignal,
  ): AsyncGenerator<ChatStreamEvent> {
    await this.mustFindOwn(actor.userId, conversationId);

    // Fail before persisting anything — otherwise a not-yet-configured provider leaves an orphaned user message with no reply once it IS configured.
    if (!env.ai.isConfigured) {
      yield { type: 'error', message: 'The AI assistant is not configured for this environment — set AI_API_KEY (or switch AI_PROVIDER=ollama for a local model).' };
      return;
    }

    if (regenerate) {
      await this.messages.deleteTrailingAssistantMessages(conversationId);
    } else {
      if (!content?.trim()) {
        yield { type: 'error', message: 'Message content is required.' };
        return;
      }
      await this.messages.create({ tenantId: this.tenantId, conversationId, role: 'USER', content });
      await this.conversations.renameIfDefault(conversationId, deriveTitle(content));
    }

    const history = await this.messages.listForConversation(conversationId);
    const permissions = await permissionEngine.getEffectivePermissions(this.tenantId, actor.userId);
    const contextBlock = await buildTenantContext(this.tenantId, tenantName, permissions);

    const chatMessages: AiChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(tenantName, contextBlock) },
      ...history.slice(-MAX_HISTORY_MESSAGES).map((m): AiChatMessage => ({ role: m.role.toLowerCase() as 'user' | 'assistant', content: m.content })),
    ];

    const provider = getAiProvider();
    const startedAt = Date.now();
    let fullContent = '';

    try {
      for await (const delta of provider.stream({
        messages: chatMessages,
        model: env.ai.model,
        temperature: env.ai.temperature,
        maxTokens: env.ai.maxTokens,
        signal,
      })) {
        fullContent += delta;
        yield { type: 'delta', text: delta };
      }

      const { content: cleanedContent, action } = extractActionProposal(fullContent);
      const assistantMessage = await this.messages.create({
        tenantId: this.tenantId,
        conversationId,
        role: 'ASSISTANT',
        content: cleanedContent,
        actionPayload: action ? (action as unknown as Prisma.InputJsonObject) : undefined,
        actionStatus: action ? 'PENDING' : undefined,
      });
      await this.conversations.touch(conversationId);
      await this.requestLogs.record({
        tenantId: this.tenantId,
        userId: actor.userId,
        conversationId,
        provider: provider.name,
        model: env.ai.model,
        durationMs: Date.now() - startedAt,
        status: 'SUCCESS',
      });

      yield { type: 'done', messageId: assistantMessage.id, content: cleanedContent, action };
    } catch (error) {
      const message = (error as Error).message;
      logger.error('AI provider request failed', { tenantId: this.tenantId, provider: provider.name, error: message });
      await this.requestLogs.record({
        tenantId: this.tenantId,
        userId: actor.userId,
        conversationId,
        provider: provider.name,
        model: env.ai.model,
        durationMs: Date.now() - startedAt,
        status: 'ERROR',
        error: message,
      });
      yield { type: 'error', message: 'The AI assistant could not complete this request. Please try again.' };
    }
  }

  /** Shared lookup for both the confirm and cancel endpoints — fetches the pending action, verifying it belongs to this user's conversation and hasn't already been resolved. */
  async getPendingAction(userId: string, conversationId: string, messageId: string) {
    await this.mustFindOwn(userId, conversationId);
    const message = await this.messages.findById(messageId);
    if (!message || message.conversationId !== conversationId) throw new NotFoundError('Message not found.');
    if (message.actionStatus !== 'PENDING') throw new ValidationError('This action is no longer pending confirmation.');
    return message;
  }

  async markActionStatus(messageId: string, status: 'CONFIRMED' | 'CANCELLED') {
    await this.messages.setActionStatus(messageId, status);
  }

  async appendSystemNote(conversationId: string, content: string) {
    await this.messages.create({ tenantId: this.tenantId, conversationId, role: 'SYSTEM', content });
    await this.conversations.touch(conversationId);
  }
}
