import { logger } from '../../../core/logging/logger';
import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';
import { loadEmailBranding } from '../../../infrastructure/mail/branding';
import { enqueueCampaignBatch } from '../../../infrastructure/queue/communications.queue';
import { BATCH_SIZE, MAX_RECIPIENTS, QUIET_HOLD_CHANNELS } from '../constants/limits';
import { AudienceRepository } from '../repositories/audience.repository';
import { CampaignRepository, type RecipientSeed } from '../repositories/campaign.repository';
import { humanizeDeliveryError } from '../utils/delivery-error.util';
import { buildMemberVars } from '../utils/message-vars.util';
import { renderPlaceholders } from '../utils/placeholder.util';
import { quietHoldUntil } from '../utils/quiet-hours.util';
import { decideSeed, isOptedOut } from '../utils/recipient-plan.util';

import { AudienceService } from './audience.service';
import { specFromRow } from './campaign.service';
import { sendToMember } from './channel-sender.service';
import { finalizeCampaignRecipient, finishCampaignIfDone, syncCampaignCounters } from './recipient-finalizer.service';

/** Marks a SENDING campaign as failed before any message exists (audience vanished / too large). */
async function failCampaign(tenantId: string, campaignId: string, reason: string): Promise<void> {
  const repo = new CampaignRepository(getTenantScopedClient(tenantId));
  await repo.updateIfStatus(campaignId, tenantId, ['SENDING'], { status: 'FAILED', finishedAt: new Date(), failureReason: reason });
}

/**
 * `start` job: resolve the audience NOW (not at creation time), create one QUEUED / SKIPPED row per member x channel
 * (idempotent - unique constraint + skipDuplicates, so a retried job is harmless), then kick off the first batch.
 */
export async function startCampaign(tenantId: string, campaignId: string): Promise<void> {
  const db = getTenantScopedClient(tenantId);
  const repo = new CampaignRepository(db);
  const campaign = await repo.findById(tenantId, campaignId);
  if (!campaign || campaign.status !== 'SENDING') return; // cancelled before the job ran, or already finished

  const audience = new AudienceService(tenantId);
  const ids = await audience.resolveIds(specFromRow(campaign));
  if (ids.length > MAX_RECIPIENTS) {
    await failCampaign(tenantId, campaignId, `The audience grew to more than ${MAX_RECIPIENTS.toLocaleString('en-IN')} members by the time the send started, so nothing was sent. Narrow the filters and send again.`);
    return;
  }
  if (ids.length === 0) {
    await failCampaign(tenantId, campaignId, 'Nobody matched the audience when the send started, so nothing was sent.');
    return;
  }

  const profiles = await new AudienceRepository(db).loadProfiles(tenantId, ids);
  const now = new Date();
  const seeds: RecipientSeed[] = [];
  for (const id of ids) {
    const profile = profiles.get(id);
    if (!profile) continue;
    for (const channel of campaign.channels) seeds.push(decideSeed(profile, channel, campaign.holdQuietHours, now));
  }
  await repo.seedRecipients(tenantId, campaignId, seeds);
  if (!campaign.startedAt) await repo.update(campaignId, { startedAt: now });
  await syncCampaignCounters(tenantId, campaignId);

  if (await repo.hasDispatchable(campaignId, new Date())) {
    await enqueueCampaignBatch(tenantId, campaignId);
  } else {
    // Everything was skipped or is held until morning: close now if nothing is waiting, else the minute sweeper releases held rows.
    await finishCampaignIfDone(tenantId, campaignId);
  }
}

/**
 * `batch` job: claim and hand over the next <= 200 ready messages. Each message is claimed (`dispatchedAt`) BEFORE any
 * side effect, so a crashed / retried job can never send the same message twice (at-most-once; the sweeper fails
 * claimed-but-never-finished rows after 30 minutes). Chains itself while more messages are ready.
 */
export async function runCampaignBatch(tenantId: string, campaignId: string): Promise<void> {
  const db = getTenantScopedClient(tenantId);
  const repo = new CampaignRepository(db);
  const campaign = await repo.findById(tenantId, campaignId);
  if (!campaign || campaign.status !== 'SENDING') return;

  const now = new Date();
  const rows = await repo.findDispatchable(campaignId, BATCH_SIZE, now);
  if (rows.length === 0) {
    await finishCampaignIfDone(tenantId, campaignId);
    return;
  }

  const profiles = await new AudienceRepository(db).loadProfiles(tenantId, [...new Set(rows.map((r) => r.memberId))]);
  const branding = await loadEmailBranding(tenantId);
  const inboxViaPush = !campaign.channels.includes('IN_APP');

  let processed = 0;
  for (const row of rows) {
    // Stop quickly if the campaign was cancelled while this batch was running.
    if (processed > 0 && processed % 25 === 0) {
      // eslint-disable-next-line no-await-in-loop -- cheap re-read every 25 messages
      const fresh = await repo.findById(tenantId, campaignId);
      if (!fresh || fresh.status !== 'SENDING') return;
    }
    processed += 1;

    // eslint-disable-next-line no-await-in-loop -- strictly sequential: the claim must precede the side effect
    if (!(await repo.claimRecipient(row.id))) continue;

    const profile = profiles.get(row.memberId);
    if (!profile) {
      // eslint-disable-next-line no-await-in-loop
      await finalizeCampaignRecipient(tenantId, row.id, { status: 'FAILED', error: 'The member no longer exists.' });
      continue;
    }
    if (isOptedOut(profile, row.channel)) {
      // eslint-disable-next-line no-await-in-loop
      await finalizeCampaignRecipient(tenantId, row.id, { status: 'SKIPPED_OPTED_OUT', error: 'Member opted out of promotions on this channel.' });
      continue;
    }
    if (campaign.holdQuietHours && QUIET_HOLD_CHANNELS.includes(row.channel)) {
      const until = quietHoldUntil(now, profile.timezone);
      if (until) {
        // Quiet hours began while the campaign was running: put it back on hold instead of texting someone at night.
        // eslint-disable-next-line no-await-in-loop
        await repo.hold(row.id, until);
        continue;
      }
    }

    const vars = buildMemberVars(profile, branding.tenantName);
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await sendToMember({
        tenantId,
        channel: row.channel,
        member: profile,
        title: renderPlaceholders(campaign.title, vars),
        body: renderPlaceholders(campaign.body, vars),
        category: 'GENERAL',
        campaignRecipientId: row.id,
        inboxViaPush,
        branding,
      });
      if (result.outcome === 'SENT') {
        // eslint-disable-next-line no-await-in-loop
        await finalizeCampaignRecipient(tenantId, row.id, { status: 'SENT' });
      } else if (result.outcome === 'SKIPPED') {
        // eslint-disable-next-line no-await-in-loop
        await finalizeCampaignRecipient(tenantId, row.id, { status: result.status, error: result.error, deliveryLogId: result.deliveryLogId });
      }
      // HANDED_OVER: the channel worker finalises the row once the provider answers.
    } catch (error) {
      logger.error('Campaign message could not be handed over', { tenantId, campaignId, recipientId: row.id, channel: row.channel, error: error instanceof Error ? error.message : String(error) });
      // eslint-disable-next-line no-await-in-loop
      await finalizeCampaignRecipient(tenantId, row.id, { status: 'FAILED', error: humanizeDeliveryError(row.channel, error instanceof Error ? error.message : 'Unexpected error') });
    }
  }

  if (await repo.hasDispatchable(campaignId, new Date())) await enqueueCampaignBatch(tenantId, campaignId);
  else await finishCampaignIfDone(tenantId, campaignId);
}
