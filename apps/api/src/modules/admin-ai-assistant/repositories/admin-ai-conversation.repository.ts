import { prisma } from '../../../infrastructure/database/prisma';

export class AdminAiConversationRepository {
  async create(adminUserId: string, title: string) {
    return prisma.adminAiConversation.create({ data: { adminUserId, title } });
  }

  async listForUser(adminUserId: string, params: { skip: number; take: number }) {
    const where = { adminUserId };
    const [total, items] = await Promise.all([
      prisma.adminAiConversation.count({ where }),
      prisma.adminAiConversation.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: params.skip, take: params.take }),
    ]);
    return { total, items };
  }

  async findByIdForUser(adminUserId: string, id: string) {
    return prisma.adminAiConversation.findFirst({ where: { id, adminUserId } });
  }

  async touch(id: string) {
    await prisma.adminAiConversation.update({ where: { id }, data: { updatedAt: new Date() } });
  }

  async renameIfDefault(id: string, title: string) {
    await prisma.adminAiConversation.updateMany({ where: { id, title: 'New conversation' }, data: { title } });
  }

  async delete(id: string) {
    await prisma.adminAiConversation.delete({ where: { id } });
  }
}

export const adminAiConversationRepository = new AdminAiConversationRepository();
