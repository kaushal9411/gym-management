import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { ILoginHistoryRepository } from '../interfaces/repositories.interface';

export class LoginHistoryRepository implements ILoginHistoryRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async record(input: {
    tenantId: string;
    userId: string | null;
    email: string;
    success: boolean;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.db.loginHistory.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        email: input.email,
        success: input.success,
        reason: input.reason,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  async countRecentFailures(tenantId: string, email: string, sinceMinutesAgo: number): Promise<number> {
    return this.db.loginHistory.count({
      where: {
        tenantId,
        email,
        success: false,
        createdAt: { gte: new Date(Date.now() - sinceMinutesAgo * 60_000) },
      },
    });
  }
}
