import type { NotificationDeliveryStatus, TenantNotificationChannel } from '@prisma/client';

import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';

export interface RecordDeliveryInput {
  tenantId: string;
  channel: TenantNotificationChannel;
  recipient: string;
  subject?: string | null;
  content: string;
  status: NotificationDeliveryStatus;
  providerRef?: string | null;
  errorMessage?: string | null;
}

/**
 * Written by each paid channel's own queue worker once a send's outcome is
 * known for certain (or by `channel-gate.service.ts` directly for a
 * `SKIPPED_*` row, which never reaches a worker at all). Plain function, not
 * a class — every caller already has a `tenantId` in hand and this has no
 * other state to carry.
 */
export async function recordNotificationDelivery(input: RecordDeliveryInput): Promise<void> {
  const db = getTenantScopedClient(input.tenantId);
  await db.notificationDeliveryLog.create({
    data: {
      tenantId: input.tenantId,
      channel: input.channel,
      recipient: input.recipient,
      subject: input.subject ?? undefined,
      content: input.content,
      status: input.status,
      providerRef: input.providerRef ?? undefined,
      errorMessage: input.errorMessage ?? undefined,
    },
  });
}
