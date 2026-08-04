import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export class AiConversationRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async create(tenantId: string, userId: string, title: string) {
    return this.db.aiConversation.create({ data: { tenantId, userId, title } });
  }

  /** Conversation history is per-user (business rule) — every query here filters by both tenantId (defense in depth alongside RLS) AND userId, so one staff member never sees another's chats. */
  async listForUser(tenantId: string, userId: string, params: { skip: number; take: number }) {
    const where = { tenantId, userId };
    const [total, items] = await Promise.all([
      this.db.aiConversation.count({ where }),
      this.db.aiConversation.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: params.skip, take: params.take }),
    ]);
    return { total, items };
  }

  async findByIdForUser(tenantId: string, userId: string, id: string) {
    return this.db.aiConversation.findFirst({ where: { id, tenantId, userId } });
  }

  async touch(id: string) {
    await this.db.aiConversation.update({ where: { id }, data: { updatedAt: new Date() } });
  }

  async renameIfDefault(id: string, title: string) {
    await this.db.aiConversation.updateMany({ where: { id, title: 'New conversation' }, data: { title } });
  }

  async delete(id: string) {
    await this.db.aiConversation.delete({ where: { id } });
  }
}
