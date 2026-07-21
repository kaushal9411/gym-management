import type { Request, Response } from 'express';

import { sendSuccess } from '../../../core/http/response';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogQueryRepository, type AuditLogQuery } from '../repositories/audit-log-query.repository';

export class AuditLogController {
  async list(req: Request, res: Response): Promise<void> {
    const repository = new AuditLogQueryRepository(getTenantScopedClient(req.tenant!.id));
    const query = req.query as unknown as AuditLogQuery;
    const { items, total } = await repository.list(req.tenant!.id, query);
    sendSuccess(res, {
      items: items.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        actor: log.actor ? { id: log.actor.id, name: log.actor.name, email: log.actor.email } : null,
        actorRole: log.actorRole,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt.toISOString(),
      })),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    });
  }
}

export const auditLogController = new AuditLogController();
