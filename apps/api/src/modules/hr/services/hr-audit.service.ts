import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';

/** Thin wrapper so every HR mutation records `hr.*` audit rows the same way (`after` carries `{ before, after }` where relevant). */
export class HrAudit {
  private readonly repo: AuditLogRepository;

  constructor(
    private readonly tenantId: string,
    db: TenantScopedPrisma,
  ) {
    this.repo = new AuditLogRepository(db);
  }

  async record(actor: IamActor, action: string, entityType: string, entityId: string | undefined, detail?: Record<string, unknown>): Promise<void> {
    await this.repo.record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action,
      entityType,
      entityId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      after: detail,
    });
  }
}
