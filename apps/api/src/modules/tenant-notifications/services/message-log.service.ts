import type { NotificationDeliveryStatus, TenantNotificationChannel } from '@prisma/client';

import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';

/** Tenant-facing read of `NotificationDeliveryLog` — the "did my Email/SMS/WhatsApp actually send" log the tenant asked for. Never exposes other tenants' rows (RLS + explicit tenantId filter). */
export class MessageLogService {
  async list(
    tenantId: string,
    params: { channel?: TenantNotificationChannel; status?: NotificationDeliveryStatus; page: number; limit: number },
  ) {
    const db = getTenantScopedClient(tenantId);
    const where = { tenantId, channel: params.channel, status: params.status };
    const skip = (params.page - 1) * params.limit;
    const [items, total] = await Promise.all([
      db.notificationDeliveryLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: params.limit }),
      db.notificationDeliveryLog.count({ where }),
    ]);
    return { items, page: params.page, limit: params.limit, total, totalPages: Math.ceil(total / params.limit) };
  }
}

export const messageLogService = new MessageLogService();
