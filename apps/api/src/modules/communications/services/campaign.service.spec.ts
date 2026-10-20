import { beforeEach, describe, expect, it, vi } from 'vitest';

const TENANT_A = '00000000-0000-0000-0000-0000000000aa';
const TENANT_B = '00000000-0000-0000-0000-0000000000bb';
const USER = '99999999-9999-9999-9999-999999999999';
const MEMBER = '11111111-1111-4111-8111-111111111111';

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  campaigns: [] as Row[],
  groups: [] as Array<{ channel: string; status: string; _count: { _all: number } }>,
  updates: [] as Array<{ model: string; where: Row; data: Row }>,
  queued: [] as string[],
  audit: [] as Row[],
  memberCount: 3,
  smsEnabled: true,
}));

function campaignRow(over: Row = {}): Row {
  return {
    id: 'c1',
    tenantId: TENANT_A,
    name: 'Diwali',
    title: 'Hi {{firstName}}',
    body: 'Timings changed',
    channels: ['EMAIL'],
    audienceMode: 'FILTERS',
    audienceFilter: {},
    pickedMemberIds: null,
    scopeBranchIds: null,
    templateKey: null,
    status: 'DRAFT',
    scheduledAt: null,
    startedAt: null,
    finishedAt: null,
    holdQuietHours: true,
    recipientCount: 0,
    messageCount: 0,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    cancelledCount: 0,
    failureReason: null,
    idempotencyKey: null,
    createdBy: USER,
    creator: { id: USER, name: 'Asha' },
    createdAt: new Date('2026-10-19T09:00:00Z'),
    updatedAt: new Date('2026-10-19T09:00:00Z'),
    ...over,
  };
}

vi.mock('../../../infrastructure/database/tenant-scoped-client', () => {
  const matches = (row: Row, where: Row = {}): boolean =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && 'in' in (v as Row)) return ((v as { in: unknown[] }).in).includes(row[k]);
      if (v && typeof v === 'object') return true;
      return row[k] === v;
    });
  const db = {
    notificationCampaign: {
      findFirst: async ({ where }: { where: Row }) => state.campaigns.find((r) => matches(r, where)) ?? null,
      findMany: async () => state.campaigns,
      count: async () => 0,
      create: async ({ data }: { data: Row }) => {
        const row = campaignRow({ id: 'new-1', ...data, creator: { id: USER, name: 'Asha' } });
        state.campaigns.push(row);
        return row;
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        state.updates.push({ model: 'notificationCampaign', where, data });
        const hit = state.campaigns.filter((r) => matches(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        state.updates.push({ model: 'notificationCampaign.update', where, data });
        return {};
      },
    },
    notificationCampaignRecipient: {
      groupBy: async ({ by }: { by: string[] }) => (by.includes('memberId') ? [{ memberId: MEMBER }] : state.groups),
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        state.updates.push({ model: 'recipient', where, data });
        return { count: 4 };
      },
      count: async () => 0,
      findFirst: async () => null,
    },
    member: { count: async ({ where }: { where: Row }) => (JSON.stringify(where).includes('channelPreferences') ? 0 : state.memberCount), findMany: async () => [{ id: MEMBER, memberId: 'MEM-1', firstName: 'A', lastName: 'B' }] },
    deviceToken: {},
    tenantNotificationChannelLimit: { findUnique: async () => ({ emailEnabled: true, emailMonthlyLimit: 5000, smsEnabled: state.smsEnabled, smsMonthlyLimit: 1000, whatsappEnabled: true, whatsappMonthlyLimit: 500 }) },
    tenantSettings: { findUnique: async () => ({ emailNotificationsEnabled: true, smsNotificationsEnabled: true, whatsappNotificationsEnabled: true }) },
    tenantNotificationUsage: { findMany: async () => [{ channel: 'EMAIL', sentCount: 4990 }, { channel: 'SMS', sentCount: 100 }] },
    auditLog: { create: async ({ data }: { data: Row }) => state.audit.push(data) },
    user: { findFirst: async () => ({ allBranches: true, userBranches: [] }) },
  };
  return { getTenantScopedClient: () => db };
});

vi.mock('../../../infrastructure/queue/communications.queue', () => ({
  enqueueCampaignStart: vi.fn(async (_t: string, id: string) => void state.queued.push(`start:${id}`)),
  enqueueCampaignBatch: vi.fn(async (_t: string, id: string) => void state.queued.push(`batch:${id}`)),
}));

import type { AppError} from '../../../core/errors/app-error';
import { NotFoundError } from '../../../core/errors/app-error';

import { CampaignService } from './campaign.service';

const actor = { userId: USER, role: 'MANAGER' };

async function failure(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    return error as AppError;
  }
  throw new Error('expected a rejection');
}

beforeEach(() => {
  state.campaigns = [];
  state.groups = [];
  state.updates = [];
  state.queued = [];
  state.audit = [];
  state.memberCount = 3;
  state.smsEnabled = true;
});

describe('tenant isolation', () => {
  it("another gym's campaign is a 404 on every read and write", async () => {
    state.campaigns = [campaignRow({ id: 'c1', tenantId: TENANT_A })];
    const other = new CampaignService(TENANT_B);
    expect(await failure(other.getById('c1'))).toBeInstanceOf(NotFoundError);
    expect(await failure(other.cancel('c1', actor))).toBeInstanceOf(NotFoundError);
    expect(await failure(other.retryFailed('c1', actor))).toBeInstanceOf(NotFoundError);
    expect(await failure(other.update('c1', { title: 'x' }, actor))).toBeInstanceOf(NotFoundError);
    expect(await failure(other.listRecipients('c1', { page: 1, limit: 10 }))).toBeInstanceOf(NotFoundError);
    expect(state.updates).toHaveLength(0);
  });

  it('the owner gym can read it', async () => {
    state.campaigns = [campaignRow({ id: 'c1', tenantId: TENANT_A })];
    expect((await new CampaignService(TENANT_A).getById('c1')).id).toBe('c1');
  });
});

describe('state machine through the service', () => {
  it('cannot cancel a finished campaign (409 INVALID_STATE) and nothing is written', async () => {
    state.campaigns = [campaignRow({ status: 'SENT' })];
    const err = await failure(new CampaignService(TENANT_A).cancel('c1', actor));
    expect(err.httpStatus).toBe(409);
    expect(err.code).toBe('INVALID_STATE');
    expect(state.updates).toHaveLength(0);
  });

  it('cancelling a SENDING campaign cancels the not-yet-dispatched queue and writes an audit row without message text', async () => {
    state.campaigns = [campaignRow({ status: 'SENDING' })];
    const dto = await new CampaignService(TENANT_A).cancel('c1', actor);
    expect(dto.status).toBe('CANCELLED');
    const cancel = state.updates.find((u) => u.model === 'recipient');
    expect(cancel?.where).toMatchObject({ campaignId: 'c1', status: 'QUEUED', dispatchedAt: null });
    expect(cancel?.data).toMatchObject({ status: 'CANCELLED' });
    expect(state.audit[0]).toMatchObject({ action: 'communications.campaign_cancelled', entityId: 'c1' });
    expect(JSON.stringify(state.audit[0])).not.toContain('Timings changed');
  });

  it('cancelling a SCHEDULED campaign works; cancelling twice does not', async () => {
    state.campaigns = [campaignRow({ status: 'SCHEDULED', scheduledAt: new Date('2026-12-01T00:00:00Z') })];
    const svc = new CampaignService(TENANT_A);
    expect((await svc.cancel('c1', actor)).status).toBe('CANCELLED');
    expect((await failure(svc.cancel('c1', actor))).code).toBe('INVALID_STATE');
  });

  it('retry-failed needs a finished campaign that actually has failures', async () => {
    const svc = new CampaignService(TENANT_A);
    state.campaigns = [campaignRow({ status: 'SENDING' })];
    expect((await failure(svc.retryFailed('c1', actor))).code).toBe('INVALID_STATE');

    state.campaigns = [campaignRow({ status: 'SENT' })];
    state.groups = [{ channel: 'EMAIL', status: 'SENT', _count: { _all: 10 } }];
    const none = await failure(svc.retryFailed('c1', actor));
    expect(none.code).toBe('INVALID_STATE');
    expect(none.message).toMatch(/no failed messages/i);
  });

  it('retry-failed re-queues once: the second call finds nothing to retry (never double-sends)', async () => {
    state.campaigns = [campaignRow({ status: 'PARTIAL' })];
    state.groups = [
      { channel: 'EMAIL', status: 'SENT', _count: { _all: 8 } },
      { channel: 'EMAIL', status: 'FAILED', _count: { _all: 2 } },
    ];
    const svc = new CampaignService(TENANT_A);
    const first = await svc.retryFailed('c1', actor);
    expect(first.campaign.status).toBe('SENDING');
    expect(state.queued).toContain('batch:c1');
    // The campaign is SENDING now: a second retry is rejected before touching anything.
    const second = await failure(svc.retryFailed('c1', actor));
    expect(second.code).toBe('INVALID_STATE');
    expect(state.queued.filter((q) => q === 'batch:c1')).toHaveLength(1);
  });

  it('only DRAFT / SCHEDULED campaigns can be edited', async () => {
    state.campaigns = [campaignRow({ status: 'SENDING' })];
    const err = await failure(new CampaignService(TENANT_A).update('c1', { title: 'New title' }, actor));
    expect(err.code).toBe('INVALID_STATE');
    expect(state.updates).toHaveLength(0);
  });
});

describe('create guards', () => {
  const base = { title: 'Hello', body: 'Body', channels: ['EMAIL'] as const, audienceMode: 'FILTERS' as const, sendMode: 'NOW' as const, holdQuietHours: true, confirmLargeSend: false };

  it('a draft is saved without any audience / quota work and nothing is queued', async () => {
    const { campaign } = await new CampaignService(TENANT_A).create({ ...base, channels: ['EMAIL'], sendMode: 'DRAFT' }, actor);
    expect(campaign.status).toBe('DRAFT');
    expect(state.queued).toHaveLength(0);
    expect(state.audit[0]).toMatchObject({ action: 'communications.campaign_created' });
  });

  it('a send to more than 100 people needs confirmLargeSend (409 with the count)', async () => {
    state.memberCount = 250;
    const err = await failure(new CampaignService(TENANT_A).create({ ...base, channels: ['PUSH'] }, actor));
    expect(err.code).toBe('CONFIRMATION_REQUIRED');
    expect(err.httpStatus).toBe(409);
    expect(err.details?.responseData).toMatchObject({ recipientCount: 250, threshold: 100 });
    expect(state.queued).toHaveLength(0);
  });

  it('an empty audience is a 422 AUDIENCE_EMPTY', async () => {
    state.memberCount = 0;
    const err = await failure(new CampaignService(TENANT_A).create({ ...base, channels: ['PUSH'] }, actor));
    expect(err.code).toBe('AUDIENCE_EMPTY');
    expect(err.httpStatus).toBe(422);
  });

  it('more than 5000 recipients is a 422 RECIPIENT_LIMIT_EXCEEDED', async () => {
    state.memberCount = 5001;
    const err = await failure(new CampaignService(TENANT_A).create({ ...base, channels: ['PUSH'], confirmLargeSend: true }, actor));
    expect(err.code).toBe('RECIPIENT_LIMIT_EXCEEDED');
  });

  it('over-quota channels are named with the shortfall (409 QUOTA_EXCEEDED) and nothing is queued', async () => {
    state.memberCount = 50; // EMAIL has 10 left of 5000
    const err = await failure(new CampaignService(TENANT_A).create({ ...base, channels: ['EMAIL', 'PUSH'] }, actor));
    expect(err.code).toBe('QUOTA_EXCEEDED');
    expect(err.httpStatus).toBe(409);
    expect(err.details?.responseData).toEqual({ shortChannels: [{ channel: 'EMAIL', remaining: 10, wouldUse: 50, shortBy: 40 }] });
    expect(err.message).toContain('EMAIL: 10 left');
    expect(state.queued).toHaveLength(0);
  });

  it('a channel switched off for the gym is a 409 CHANNEL_DISABLED', async () => {
    state.memberCount = 5;
    state.smsEnabled = false;
    const err = await failure(new CampaignService(TENANT_A).create({ ...base, channels: ['SMS'] }, actor));
    expect(err.code).toBe('CHANNEL_DISABLED');
    expect(err.details?.responseData).toEqual({ channels: [{ channel: 'SMS', reason: 'disabled_platform' }] });
  });

  it('a send within quota queues the start job and records an audit row with counts only', async () => {
    state.memberCount = 5;
    const { campaign } = await new CampaignService(TENANT_A).create({ ...base, channels: ['PUSH'] }, actor);
    expect(campaign.status).toBe('SENDING');
    expect(state.queued).toEqual(['start:new-1']);
    expect(state.audit[0]).toMatchObject({ action: 'communications.campaign_created', after: expect.objectContaining({ recipientCount: 5 }) });
    expect(JSON.stringify(state.audit[0])).not.toContain('Body');
  });
});
