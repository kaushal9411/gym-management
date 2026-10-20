import type { TenantNotificationChannel } from '@prisma/client';

import { NotFoundError } from '../../../core/errors/app-error';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { loadEmailBranding } from '../../../infrastructure/mail/branding';
import { tenantNotificationEmail } from '../../../infrastructure/mail/templates/notification-templates';
import { enqueuePush } from '../../../infrastructure/queue/push.queue';
import { AuditLogRepository } from '../../authentication/repositories/audit-log.repository';
import type { IamActor } from '../../authentication/utils/actor.util';
import { channelLabel } from '../utils/delivery-error.util';
import { renderPlaceholders, SAMPLE_VARS, singleLine } from '../utils/placeholder.util';
import { normalisePhone } from '../utils/recipient-plan.util';

import { gateAndEnqueue } from './channel-sender.service';

export interface TestSendResult {
  channel: TenantNotificationChannel;
  status: 'QUEUED' | 'SKIPPED' | 'FAILED';
  message: string;
}

const TEST_PREFIX = '[Test] ';

export function maskEmail(email: string): string {
  const [name = '', domain = ''] = email.split('@');
  return `${name.slice(0, 1)}***@${domain}`;
}

export function maskPhone(phone: string): string {
  return phone.length <= 4 ? '****' : `${phone.slice(0, 3)}${'*'.repeat(Math.max(0, phone.length - 7))}${phone.slice(-4)}`;
}

/**
 * Test-send: one message, to the LOGGED-IN staff member's own email / phone / devices only. Goes through the normal
 * channel gate (so it counts toward the monthly quota and shows up in the Message Log) but is not a campaign.
 */
export class TestSendService {
  constructor(private readonly tenantId: string) {}

  async send(input: { title: string; body: string; channels: readonly string[] }, actor: IamActor): Promise<{ results: TestSendResult[] }> {
    const db = getTenantScopedClient(this.tenantId);
    const user = await db.user.findFirst({ where: { id: actor.userId, tenantId: this.tenantId }, select: { email: true, phone: true } });
    if (!user) throw new NotFoundError('Your account was not found.');

    const branding = await loadEmailBranding(this.tenantId);
    const vars = { ...SAMPLE_VARS, gymName: branding.tenantName, tenantName: branding.tenantName };
    const title = singleLine(renderPlaceholders(input.title, vars));
    const body = renderPlaceholders(input.body, vars);

    const results: TestSendResult[] = [];
    for (const channel of input.channels as TenantNotificationChannel[]) {
      try {
        // eslint-disable-next-line no-await-in-loop -- at most four channels
        results.push(await this.sendOne(actor.userId, channel, { title, body, user, branding }, db));
      } catch (error) {
        results.push({ channel, status: 'FAILED', message: `${channelLabel(channel)} test could not be queued: ${error instanceof Error ? error.message : 'unexpected error'}` });
      }
    }

    await new AuditLogRepository(db).record({
      tenantId: this.tenantId,
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: 'communications.test_sent',
      entityType: 'communications',
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      after: { channels: results.map((r) => ({ channel: r.channel, status: r.status })) },
    });
    return { results };
  }

  private async sendOne(
    userId: string,
    channel: TenantNotificationChannel,
    msg: { title: string; body: string; user: { email: string; phone: string | null }; branding: Awaited<ReturnType<typeof loadEmailBranding>> },
    db: ReturnType<typeof getTenantScopedClient>,
  ): Promise<TestSendResult> {
    const label = channelLabel(channel);
    if (channel === 'PUSH') {
      const rows = await db.staffDeviceToken.findMany({ where: { tenantId: this.tenantId, userId }, select: { token: true } });
      if (rows.length === 0) return { channel, status: 'SKIPPED', message: 'No registered device on your account - sign in to the mobile app first.' };
      await enqueuePush({ tenantId: this.tenantId, tokens: rows.map((r) => r.token), tokenOwner: 'STAFF', title: `${TEST_PREFIX}${msg.title}`, body: msg.body, data: { category: 'GENERAL' } });
      return { channel, status: 'QUEUED', message: `Push test sent to ${rows.length} of your device${rows.length === 1 ? '' : 's'}.` };
    }
    if (channel === 'EMAIL') {
      const mail = tenantNotificationEmail(msg.branding, `${TEST_PREFIX}${msg.title}`, msg.body);
      const r = await gateAndEnqueue({ tenantId: this.tenantId, channel: 'EMAIL', to: msg.user.email, subject: mail.subject, content: mail.html });
      return this.toResult(channel, r, maskEmail(msg.user.email));
    }
    const phone = normalisePhone(msg.user.phone);
    if (!phone) return { channel, status: 'SKIPPED', message: `Your profile has no valid phone number, so the ${label} test was not sent.` };
    const r = await gateAndEnqueue({ tenantId: this.tenantId, channel: channel as 'SMS' | 'WHATSAPP', to: phone, content: `${TEST_PREFIX}${msg.title}\n${msg.body}` });
    return this.toResult(channel, r, maskPhone(phone));
  }

  private toResult(channel: TenantNotificationChannel, r: Awaited<ReturnType<typeof gateAndEnqueue>>, masked: string): TestSendResult {
    if (r.outcome === 'SKIPPED') return { channel, status: 'SKIPPED', message: r.error };
    return { channel, status: 'QUEUED', message: `${channelLabel(channel)} test queued to ${masked}. It counts toward your monthly quota.` };
  }
}
