import type { NotificationTemplateType, TenantNotificationChannel } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export class NotificationTemplateRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async listOverrides(tenantId: string) {
    return this.db.notificationTemplate.findMany({ where: { tenantId } });
  }

  async findOverride(tenantId: string, type: NotificationTemplateType) {
    return this.db.notificationTemplate.findFirst({ where: { tenantId, type } });
  }

  async upsert(
    tenantId: string,
    type: NotificationTemplateType,
    input: { channels: TenantNotificationChannel[]; titleTemplate: string; bodyTemplate: string; isActive: boolean },
  ) {
    return this.db.notificationTemplate.upsert({
      where: { tenantId_type: { tenantId, type } },
      create: { tenantId, type, ...input },
      update: input,
    });
  }
}
