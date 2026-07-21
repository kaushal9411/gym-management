import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

/**
 * Read side of login_history for the portal's "Login History" panel — the
 * WRITE side stays in the authentication module, which records every
 * attempt as part of the login flow itself.
 */
export class LoginHistoryQueryRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async listForUser(tenantId: string, userId: string, query: { page: number; limit: number }) {
    const where: Prisma.LoginHistoryWhereInput = { tenantId, userId };
    const [items, total] = await Promise.all([
      this.db.loginHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.loginHistory.count({ where }),
    ]);
    return { items, total };
  }
}
