import type { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export interface AuditLogQuery {
  page: number;
  limit: number;
  action?: string;
  entityType?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
}

/**
 * Read side of audit_logs — writes happen inside each module through the
 * authentication module's AuditLogRepository. Prefix match on `action`
 * lets the UI filter whole areas ("iam.") as well as exact actions.
 */
export class AuditLogQueryRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(tenantId: string, query: AuditLogQuery) {
    const where: Prisma.AuditLogWhereInput = {
      tenantId,
      ...(query.action ? { action: { startsWith: query.action } } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.db.auditLog.count({ where }),
    ]);
    return { items, total };
  }
}
