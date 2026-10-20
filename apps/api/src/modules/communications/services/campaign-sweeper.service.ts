import { logger } from '../../../core/logging/logger';
import { prisma } from '../../../infrastructure/database/prisma';
import { enqueueCampaignBatch, enqueueCampaignStart } from '../../../infrastructure/queue/communications.queue';
import { DISPATCH_STALE_MINUTES } from '../constants/limits';

import { finalizeCampaignRecipient, finishCampaignIfDone } from './recipient-finalizer.service';

export interface DispatchSweepResult extends Record<string, unknown> {
  started: number;
  released: number;
  restarted: number;
  closed: number;
  timedOut: number;
}

/**
 * The minute job behind campaigns (cross-tenant, raw `prisma` like every scheduler sweep):
 *  1. start SCHEDULED campaigns whose time has come (compare-and-set SCHEDULED -> SENDING, so two runs can't both start one);
 *  2. release quiet-hours-held messages whose hold has ended (and re-kick a batch chain that stalled);
 *  3. restart a SENDING campaign whose `start` job never produced any rows (crash between create and enqueue);
 *  4. close SENDING campaigns with nothing left in flight;
 *  5. fail messages handed to a channel queue but never confirmed within 30 minutes.
 */
export async function runCommunicationsDispatch(now = new Date()): Promise<DispatchSweepResult> {
  const result: DispatchSweepResult = { started: 0, released: 0, restarted: 0, closed: 0, timedOut: 0 };
  const minuteSlot = String(Math.floor(now.getTime() / 60_000));

  const due = await prisma.notificationCampaign.findMany({ where: { status: 'SCHEDULED', scheduledAt: { lte: now } }, select: { id: true, tenantId: true }, take: 100 });
  for (const campaign of due) {
    // eslint-disable-next-line no-await-in-loop -- small per-minute batch
    const claimed = await prisma.notificationCampaign.updateMany({ where: { id: campaign.id, status: 'SCHEDULED' }, data: { status: 'SENDING', startedAt: now } });
    if (claimed.count === 1) {
      // eslint-disable-next-line no-await-in-loop
      await enqueueCampaignStart(campaign.tenantId, campaign.id);
      result.started += 1;
    }
  }

  const sending = await prisma.notificationCampaign.findMany({ where: { status: 'SENDING' }, select: { id: true, tenantId: true, startedAt: true }, take: 500 });
  for (const campaign of sending) {
    // eslint-disable-next-line no-await-in-loop -- small per-minute batch
    const [rows, ready, queued] = await Promise.all([
      prisma.notificationCampaignRecipient.count({ where: { campaignId: campaign.id } }),
      prisma.notificationCampaignRecipient.count({
        where: { campaignId: campaign.id, status: 'QUEUED', dispatchedAt: null, OR: [{ deliverAfter: null }, { deliverAfter: { lte: now } }] },
      }),
      prisma.notificationCampaignRecipient.count({ where: { campaignId: campaign.id, status: 'QUEUED' } }),
    ]);
    if (rows === 0) {
      if (campaign.startedAt && now.getTime() - campaign.startedAt.getTime() > 2 * 60_000) {
        // eslint-disable-next-line no-await-in-loop
        await enqueueCampaignStart(campaign.tenantId, campaign.id);
        result.restarted += 1;
      }
      continue;
    }
    if (ready > 0) {
      // eslint-disable-next-line no-await-in-loop
      await enqueueCampaignBatch(campaign.tenantId, campaign.id, `sweep-${minuteSlot}`);
      result.released += 1;
    } else if (queued === 0) {
      // eslint-disable-next-line no-await-in-loop
      if (await finishCampaignIfDone(campaign.tenantId, campaign.id)) result.closed += 1;
    }
  }

  const staleBefore = new Date(now.getTime() - DISPATCH_STALE_MINUTES * 60_000);
  const stale = await prisma.notificationCampaignRecipient.findMany({ where: { status: 'QUEUED', dispatchedAt: { lt: staleBefore } }, select: { id: true, tenantId: true }, take: 500 });
  for (const row of stale) {
    // eslint-disable-next-line no-await-in-loop
    await finalizeCampaignRecipient(row.tenantId, row.id, {
      status: 'FAILED',
      error: `The message was handed to the delivery queue but was never confirmed within ${DISPATCH_STALE_MINUTES} minutes.`,
    });
    result.timedOut += 1;
  }

  if (result.started || result.released || result.restarted || result.closed || result.timedOut) logger.info('Communications dispatch sweep', result);
  return result;
}
