import type { TenantNotificationCategory, TenantNotificationChannel } from '@prisma/client';

import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { loadEmailBranding } from '../../../infrastructure/mail/branding';
import type { EmailBranding } from '../../../infrastructure/mail/templates/base-layout';
import { tenantNotificationEmail } from '../../../infrastructure/mail/templates/notification-templates';
import { enqueueEmail } from '../../../infrastructure/queue/email.queue';
import { enqueuePush } from '../../../infrastructure/queue/push.queue';
import { enqueueSms } from '../../../infrastructure/queue/sms.queue';
import { enqueueWhatsApp } from '../../../infrastructure/queue/whatsapp.queue';
import { MemberNotificationRepository } from '../../tenant-notifications/repositories/member-notification.repository';
import { recordNotificationDelivery } from '../../tenant-notifications/repositories/notification-delivery-log.repository';
import { checkAndConsumeChannelQuota, type ChannelGateReason, type GatedChannel } from '../../tenant-notifications/services/channel-gate.service';
import type { MemberProfile } from '../repositories/audience.repository';
import { channelLabel } from '../utils/delivery-error.util';
import { singleLine } from '../utils/placeholder.util';
import { normalisePhone } from '../utils/recipient-plan.util';

/** Outcome of handing ONE message to ONE channel. */
export type SendResult =
  /** Finished synchronously (push accepted by our queue, in-app row written). */
  | { outcome: 'SENT' }
  /** Queued on the channel's own worker; that worker reports SENT / FAILED later (`campaignRecipientId`). */
  | { outcome: 'HANDED_OVER' }
  | { outcome: 'SKIPPED'; status: 'SKIPPED_NO_CONTACT' | 'SKIPPED_QUOTA' | 'SKIPPED_DISABLED'; error: string; deliveryLogId?: string };

export interface MemberSend {
  tenantId: string;
  channel: TenantNotificationChannel;
  member: MemberProfile;
  title: string;
  body: string;
  category: TenantNotificationCategory;
  /** Campaign row to finalise from the channel worker; absent for automations / tests. */
  campaignRecipientId?: string;
  /** PUSH also writes the in-app inbox row unless IN_APP is being sent separately in the same message set. */
  inboxViaPush: boolean;
  /** Cached per batch so a 200-message batch loads branding once. */
  branding?: EmailBranding;
  /** Replaces the generic title/body email (e.g. an invoice-detail reminder). */
  richEmail?: (branding: EmailBranding) => { subject: string; html: string };
  /** Extra push `data` entries (string values only). */
  pushData?: Record<string, string>;
}

export function gateDenialMessage(channel: TenantNotificationChannel, reason: ChannelGateReason): string {
  const label = channelLabel(channel);
  if (reason === 'disabled_platform') return `${label} is not enabled for this gym yet - the platform has not granted this channel.`;
  if (reason === 'disabled_tenant') return `${label} notifications are turned off in Gym Settings.`;
  return `This month's ${label} quota has been used up.`;
}

/**
 * Gate (platform ceiling -> gym toggle -> monthly quota, consuming one unit when allowed) and then enqueue on the paid
 * channel's own queue. A block writes the `SKIPPED_*` delivery-log row and returns it; nothing is enqueued.
 */
export async function gateAndEnqueue(args: {
  tenantId: string;
  channel: GatedChannel;
  to: string;
  subject?: string;
  /** Plain text for SMS/WhatsApp, HTML for email. */
  content: string;
  campaignRecipientId?: string;
}): Promise<SendResult> {
  const gate = await checkAndConsumeChannelQuota(args.tenantId, args.channel);
  if (!gate.allowed) {
    const reason = gate.reason!;
    const deliveryLogId = await recordNotificationDelivery({
      tenantId: args.tenantId,
      channel: args.channel,
      recipient: args.to,
      subject: args.subject ?? null,
      content: args.content,
      status: reason === 'quota_exceeded' ? 'SKIPPED_QUOTA' : 'SKIPPED_DISABLED',
      errorMessage: reason,
    });
    return {
      outcome: 'SKIPPED',
      status: reason === 'quota_exceeded' ? 'SKIPPED_QUOTA' : 'SKIPPED_DISABLED',
      error: gateDenialMessage(args.channel, reason),
      deliveryLogId,
    };
  }
  if (args.channel === 'EMAIL') {
    await enqueueEmail({ to: args.to, subject: args.subject ?? '', html: args.content, notificationTenantId: args.tenantId, campaignRecipientId: args.campaignRecipientId });
  } else if (args.channel === 'SMS') {
    await enqueueSms({ tenantId: args.tenantId, to: args.to, body: args.content, campaignRecipientId: args.campaignRecipientId });
  } else {
    await enqueueWhatsApp({ tenantId: args.tenantId, to: args.to, body: args.content, campaignRecipientId: args.campaignRecipientId });
  }
  return { outcome: 'HANDED_OVER' };
}

/** Sends one rendered message to one member on one channel. Opt-out and quiet hours are decided by the caller. */
export async function sendToMember(send: MemberSend): Promise<SendResult> {
  const { tenantId, channel, member } = send;

  if (channel === 'IN_APP') {
    await new MemberNotificationRepository(getTenantScopedClient(tenantId)).create(tenantId, member.id, {
      category: send.category,
      title: singleLine(send.title).slice(0, 200),
      body: send.body,
    });
    return { outcome: 'SENT' };
  }

  if (channel === 'PUSH') {
    if (member.deviceTokens.length === 0) return { outcome: 'SKIPPED', status: 'SKIPPED_NO_CONTACT', error: 'No registered device - the member has not signed in to the mobile app.' };
    if (send.inboxViaPush) {
      await new MemberNotificationRepository(getTenantScopedClient(tenantId)).create(tenantId, member.id, {
        category: send.category,
        title: singleLine(send.title).slice(0, 200),
        body: send.body,
      });
    }
    await enqueuePush({ tenantId, tokens: member.deviceTokens, tokenOwner: 'MEMBER', title: singleLine(send.title), body: send.body, data: { category: send.category, ...send.pushData } });
    return { outcome: 'SENT' };
  }

  if (channel === 'EMAIL') {
    if (!member.email) return { outcome: 'SKIPPED', status: 'SKIPPED_NO_CONTACT', error: 'No email address on file.' };
    const branding = send.branding ?? (await loadEmailBranding(tenantId));
    const mail = send.richEmail ? send.richEmail(branding) : tenantNotificationEmail(branding, singleLine(send.title), send.body);
    return gateAndEnqueue({ tenantId, channel: 'EMAIL', to: member.email, subject: singleLine(mail.subject), content: mail.html, campaignRecipientId: send.campaignRecipientId });
  }

  const phone = normalisePhone(member.phone);
  if (!phone) {
    return { outcome: 'SKIPPED', status: 'SKIPPED_NO_CONTACT', error: member.phone ? 'The phone number on file is not valid.' : 'No phone number on file.' };
  }
  return gateAndEnqueue({
    tenantId,
    channel: channel as GatedChannel,
    to: phone,
    content: `${singleLine(send.title)}\n${send.body}`,
    campaignRecipientId: send.campaignRecipientId,
  });
}
