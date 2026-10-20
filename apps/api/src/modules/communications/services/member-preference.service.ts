import type { TenantNotificationChannel } from '@prisma/client';

import { getTenantScopedClient, type TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import { OPT_OUT_CHANNELS } from '../constants/limits';
import type { MemberPreferencesInput } from '../validators/communications.validators';

const LABEL: Record<(typeof OPT_OUT_CHANNELS)[number], string> = {
  PUSH: 'Push notifications',
  EMAIL: 'Email',
  SMS: 'SMS',
  WHATSAPP: 'WhatsApp',
};

/** Reminders the member can never switch off - shown by the UIs so the opt-out copy is honest. */
export const NON_BLOCKABLE = [
  { key: 'MEMBERSHIP_REMINDERS', label: 'Membership expiry reminders' },
  { key: 'PAYMENT_REMINDERS', label: 'Invoice and payment reminders' },
  { key: 'CLASS_UPDATES', label: 'Reminders and changes for classes you booked' },
  { key: 'ACCOUNT_MESSAGES', label: 'Account, security and receipt messages' },
];

export const PREFERENCES_NOTE =
  'Opting out stops promotional and general announcements on that channel. Reminders about your own membership, payments and bookings are always delivered.';

/** Member plane: promotional opt-out per channel. Member id and tenant come from the token only. */
export class MemberPreferenceService {
  private readonly db: TenantScopedPrisma;

  constructor(private readonly tenantId: string) {
    this.db = getTenantScopedClient(tenantId);
  }

  async get(memberId: string) {
    const rows = await this.db.memberChannelPreference.findMany({ where: { tenantId: this.tenantId, memberId }, select: { channel: true, promotionalOptOut: true } });
    const optedOut = new Set(rows.filter((r) => r.promotionalOptOut).map((r) => r.channel));
    return {
      channels: OPT_OUT_CHANNELS.map((channel) => ({ channel, label: LABEL[channel], promotionalOptOut: optedOut.has(channel as TenantNotificationChannel) })),
      nonBlockable: NON_BLOCKABLE,
      note: PREFERENCES_NOTE,
    };
  }

  async put(memberId: string, input: MemberPreferencesInput, ctx: { ipAddress?: string; userAgent?: string }) {
    for (const entry of input.channels) {
      // eslint-disable-next-line no-await-in-loop -- at most four upserts
      await this.db.memberChannelPreference.upsert({
        where: { memberId_channel: { memberId, channel: entry.channel } },
        create: { tenantId: this.tenantId, memberId, channel: entry.channel, promotionalOptOut: entry.promotionalOptOut },
        update: { promotionalOptOut: entry.promotionalOptOut },
      });
    }
    await new AuditLogRepository(this.db).record({
      tenantId: this.tenantId,
      actorUserId: null,
      actorRole: 'MEMBER',
      action: 'member_portal.notification_preferences_updated',
      entityType: 'member',
      entityId: memberId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      after: { memberId, channels: input.channels.map((c) => ({ channel: c.channel, promotionalOptOut: c.promotionalOptOut })) },
    });
    return this.get(memberId);
  }
}
