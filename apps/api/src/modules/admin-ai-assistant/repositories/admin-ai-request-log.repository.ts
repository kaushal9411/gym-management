import { prisma } from '../../../infrastructure/database/prisma';

export class AdminAiRequestLogRepository {
  async record(data: {
    adminUserId: string;
    conversationId?: string;
    provider: string;
    model: string;
    durationMs: number;
    status: 'SUCCESS' | 'ERROR';
    error?: string;
  }) {
    await prisma.adminAiRequestLog.create({ data });
  }
}

export const adminAiRequestLogRepository = new AdminAiRequestLogRepository();
