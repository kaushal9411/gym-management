import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export class AiRequestLogRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async record(data: {
    tenantId: string;
    userId: string;
    conversationId?: string;
    provider: string;
    model: string;
    promptTokens?: number;
    completionTokens?: number;
    durationMs: number;
    status: 'SUCCESS' | 'ERROR';
    error?: string;
  }) {
    await this.db.aiRequestLog.create({ data });
  }
}
