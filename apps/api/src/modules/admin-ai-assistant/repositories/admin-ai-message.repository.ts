import { prisma } from '../../../infrastructure/database/prisma';

export class AdminAiMessageRepository {
  async listForConversation(conversationId: string) {
    return prisma.adminAiMessage.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' } });
  }

  async create(data: { conversationId: string; role: 'USER' | 'ASSISTANT' | 'SYSTEM'; content: string }) {
    return prisma.adminAiMessage.create({ data });
  }

  async deleteTrailingAssistantMessages(conversationId: string) {
    const messages = await prisma.adminAiMessage.findMany({ where: { conversationId }, orderBy: { createdAt: 'desc' } });
    const toDelete: string[] = [];
    for (const message of messages) {
      if (message.role !== 'ASSISTANT') break;
      toDelete.push(message.id);
    }
    if (toDelete.length > 0) await prisma.adminAiMessage.deleteMany({ where: { id: { in: toDelete } } });
  }

  async clearForConversation(conversationId: string) {
    await prisma.adminAiMessage.deleteMany({ where: { conversationId } });
  }
}

export const adminAiMessageRepository = new AdminAiMessageRepository();
