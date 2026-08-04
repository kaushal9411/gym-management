import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export class AiMessageRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async listForConversation(conversationId: string) {
    return this.db.aiMessage.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' } });
  }

  async create(data: {
    tenantId: string;
    conversationId: string;
    role: 'USER' | 'ASSISTANT' | 'SYSTEM';
    content: string;
    actionPayload?: Prisma.InputJsonValue;
    actionStatus?: string;
  }) {
    return this.db.aiMessage.create({ data });
  }

  async findById(id: string) {
    return this.db.aiMessage.findUnique({ where: { id } });
  }

  async setActionStatus(id: string, actionStatus: 'CONFIRMED' | 'CANCELLED') {
    return this.db.aiMessage.update({ where: { id }, data: { actionStatus } });
  }

  /** Used by "Regenerate Response" — removes the trailing assistant message(s) so a fresh completion can be generated from the same point in history. */
  async deleteTrailingAssistantMessages(conversationId: string) {
    const messages = await this.db.aiMessage.findMany({ where: { conversationId }, orderBy: { createdAt: 'desc' } });
    const toDelete: string[] = [];
    for (const message of messages) {
      if (message.role !== 'ASSISTANT') break;
      toDelete.push(message.id);
    }
    if (toDelete.length > 0) await this.db.aiMessage.deleteMany({ where: { id: { in: toDelete } } });
  }

  async clearForConversation(conversationId: string) {
    await this.db.aiMessage.deleteMany({ where: { conversationId } });
  }
}
