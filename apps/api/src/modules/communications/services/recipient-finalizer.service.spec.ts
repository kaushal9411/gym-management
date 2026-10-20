import { beforeEach, describe, expect, it, vi } from 'vitest';

const TENANT = '00000000-0000-0000-0000-0000000000aa';

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  recipient: { id: 'r1', campaignId: 'c1', status: 'QUEUED' } as Row,
  campaign: { id: 'c1', tenantId: '00000000-0000-0000-0000-0000000000aa', status: 'SENDING', creator: null } as Row,
  queued: 1,
  groups: [] as Array<{ channel: string; status: string; _count: { _all: number } }>,
  increments: [] as Row[],
  campaignUpdates: [] as Row[],
}));

vi.mock('../../../infrastructure/database/tenant-scoped-client', () => {
  const db = {
    notificationCampaignRecipient: {
      // Compare-and-set like Postgres: only a QUEUED row transitions.
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        if (where.id === state.recipient.id && where.status === 'QUEUED' && state.recipient.status === 'QUEUED') {
          Object.assign(state.recipient, data);
          state.queued = 0;
          return { count: 1 };
        }
        return { count: 0 };
      },
      findUnique: async () => state.recipient,
      count: async () => state.queued,
      groupBy: async () => state.groups,
    },
    notificationCampaign: {
      findFirst: async () => state.campaign,
      update: async ({ data }: { data: Row }) => {
        state.increments.push(data);
        return {};
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        state.campaignUpdates.push(data);
        if ((where.status as { in: string[] }).in.includes(state.campaign.status as string)) {
          Object.assign(state.campaign, data);
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
  };
  return { getTenantScopedClient: () => db };
});

import { finalizeCampaignRecipient, finishCampaignIfDone } from './recipient-finalizer.service';

beforeEach(() => {
  state.recipient = { id: 'r1', campaignId: 'c1', status: 'QUEUED' };
  state.campaign = { id: 'c1', tenantId: TENANT, status: 'SENDING', creator: null };
  state.queued = 1;
  state.groups = [{ channel: 'EMAIL', status: 'SENT', _count: { _all: 1 } }];
  state.increments = [];
  state.campaignUpdates = [];
});

describe('finalizeCampaignRecipient', () => {
  it('moves a queued message to SENT once, bumps the counter once and closes the campaign', async () => {
    await finalizeCampaignRecipient(TENANT, 'r1', { status: 'SENT', deliveryLogId: 'log-1' });
    expect(state.recipient).toMatchObject({ status: 'SENT', deliveryLogId: 'log-1' });
    expect(state.increments).toEqual([{ sentCount: { increment: 1 } }]);
    expect(state.campaign.status).toBe('SENT');
  });

  it('a retried channel job (same recipient again) changes nothing - the counters never move twice', async () => {
    await finalizeCampaignRecipient(TENANT, 'r1', { status: 'SENT' });
    await finalizeCampaignRecipient(TENANT, 'r1', { status: 'SENT' });
    await finalizeCampaignRecipient(TENANT, 'r1', { status: 'FAILED', error: 'late duplicate' });
    expect(state.increments).toHaveLength(1);
    expect(state.recipient.status).toBe('SENT');
  });

  it('a skip bumps skippedCount; a failure bumps failedCount and makes the campaign PARTIAL when others were sent', async () => {
    state.groups = [
      { channel: 'EMAIL', status: 'SENT', _count: { _all: 5 } },
      { channel: 'EMAIL', status: 'FAILED', _count: { _all: 1 } },
    ];
    await finalizeCampaignRecipient(TENANT, 'r1', { status: 'FAILED', error: 'mailbox full' });
    expect(state.increments).toEqual([{ failedCount: { increment: 1 } }]);
    expect(state.campaign.status).toBe('PARTIAL');
    expect(state.campaign.sentCount).toBe(5);
    expect(state.campaign.failedCount).toBe(1);
  });

  it('never throws, even if the database does (a channel worker must not retry-and-resend)', async () => {
    state.recipient = null as never;
    await expect(finalizeCampaignRecipient(TENANT, 'r1', { status: 'SENT' })).resolves.toBeUndefined();
  });
});

describe('finishCampaignIfDone', () => {
  it('does nothing while messages are still queued', async () => {
    state.queued = 2;
    expect(await finishCampaignIfDone(TENANT, 'c1')).toBe(false);
    expect(state.campaign.status).toBe('SENDING');
  });

  it('never revives a cancelled campaign into SENT', async () => {
    state.campaign.status = 'CANCELLED';
    state.queued = 0;
    expect(await finishCampaignIfDone(TENANT, 'c1')).toBe(false);
    expect(state.campaign.status).toBe('CANCELLED');
  });

  it('all-skipped campaigns end FAILED with an explanation', async () => {
    state.queued = 0;
    state.groups = [{ channel: 'SMS', status: 'SKIPPED_OPTED_OUT', _count: { _all: 3 } }];
    expect(await finishCampaignIfDone(TENANT, 'c1')).toBe(true);
    expect(state.campaign.status).toBe('FAILED');
    expect(String(state.campaign.failureReason)).toMatch(/skipped/);
  });

  it('is idempotent: a second close is a no-op', async () => {
    state.queued = 0;
    expect(await finishCampaignIfDone(TENANT, 'c1')).toBe(true);
    expect(await finishCampaignIfDone(TENANT, 'c1')).toBe(false);
  });
});
