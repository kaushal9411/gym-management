import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import type { IAuditLogRepository } from '../interfaces/repositories.interface';

export class AuditLogRepository implements IAuditLogRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async record(input: {
    tenantId: string | null;
    actorUserId: string | null;
    actorRole?: string;
    action: string;
    entityType?: string;
    entityId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.db.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }
}
