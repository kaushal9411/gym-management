import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TENANT = '00000000-0000-0000-0000-0000000000aa';

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  campaign: {} as Row,
  rows: [] as Row[],
  members: [] as Row[],
  sends: [] as Array<{ recipientId: string; channel: string; title: string }>,
  batches: [] as string[],
  counters: [] as Row[],
}));

function recipient(id: string, memberId: string, channel: string, over: Row = {}): Row {
  return { id, tenantId: TENANT, campaignId: 'c1', memberId, channel, status: 'QUEUED', error: null, dispatchedAt: null, deliverAfter: null, createdAt: new Date('2026-10-19T00:00:00Z'), ...over };
}

function member(id: string, over: Row = {}): Row {
  return {
    id,
    memberId: `MEM-${id}`,
    firstName: `First${id}`,
    lastName: 'Last',
    email: null,
    phone: null,
    branchId: 'b1',
    status: 'ACTIVE',
    deletedAt: null,
    branch: { name: 'Main', timezone: 'Asia/Kolkata' },
    memberships: [],
    invoices: [],
    deviceTokens: [{ token: 'tok' }],
    channelPreferences: [],
    ...over,
  };
}

vi.mock('../../../infrastructure/database/tenant-scoped-client', () => {
  const dispatchable = (now: Date) =>
    state.rows.filter((r) => r.status === 'QUEUED' && r.dispatchedAt === null && (r.deliverAfter === null || (r.deliverAfter as Date).getTime() <= now.getTime()));
  const db = {
    notificationCampaign: {
      findFirst: async () => ({ ...state.campaign, creator: null }),
      update: async ({ data }: { data: Row }) => void state.counters.push(data),
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        if ((where.status as { in: string[] }).in.includes(state.campaign.status as string)) {
          Object.assign(state.campaign, data);
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    notificationCampaignRecipient: {
      findMany: async ({ take }: { take?: number }) => dispatchable(new Date()).slice(0, take),
      count: async ({ where }: { where: Row }) => (where.dispatchedAt === null ? dispatchable(new Date()).length : state.rows.filter((r) => r.status === 'QUEUED').length),
      findUnique: async ({ where }: { where: { id: string } }) => state.rows.find((r) => r.id === where.id) ?? null,
      groupBy: async () => {
        const out = new Map<string, number>();
        for (const r of state.rows) out.set(`${r.channel}|${r.status}`, (out.get(`${r.channel}|${r.status}`) ?? 0) + 1);
        return [...out.entries()].map(([k, n]) => ({ channel: k.split('|')[0], status: k.split('|')[1], _count: { _all: n } }));
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const row = state.rows.find((r) => r.id === where.id);
        if (!row || row.status !== 'QUEUED') return { count: 0 };
        if ('dispatchedAt' in where && where.dispatchedAt === null && row.dispatchedAt !== null) return { count: 0 }; // claim lost
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    member: { findMany: async ({ where }: { where: { id: { in: string[] } } }) => state.members.filter((m) => where.id.in.includes(m.id as string)) },
  };
  return { getTenantScopedClient: () => db };
});

vi.mock('../../../infrastructure/mail/branding', () => ({ loadEmailBranding: async () => ({ tenantName: 'Kaushal Fitness' }) }));
vi.mock('../../../infrastructure/queue/communications.queue', () => ({
  enqueueCampaignBatch: vi.fn(async (_t: string, id: string) => void state.batches.push(id)),
  enqueueCampaignStart: vi.fn(),
}));
vi.mock('./channel-sender.service', () => ({
  sendToMember: vi.fn(async (args: { channel: string; title: string; campaignRecipientId: string }) => {
    state.sends.push({ recipientId: args.campaignRecipientId, channel: args.channel, title: args.title });
    return args.channel === 'PUSH' || args.channel === 'IN_APP' ? { outcome: 'SENT' } : { outcome: 'HANDED_OVER' };
  }),
}));

import { runCampaignBatch } from './campaign-dispatch.service';

beforeEach(() => {
  state.campaign = { id: 'c1', tenantId: TENANT, status: 'SENDING', title: 'Hi {{firstName}}', body: 'Timings changed', channels: ['SMS', 'EMAIL'], holdQuietHours: true, startedAt: new Date(), scopeBranchIds: null, audienceMode: 'FILTERS', audienceFilter: {}, pickedMemberIds: null };
  state.rows = [];
  state.members = [];
  state.sends = [];
  state.batches = [];
  state.counters = [];
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-19T06:30:00Z')); // 12:00 IST - daytime
});

afterEach(() => vi.useRealTimers());

describe('runCampaignBatch', () => {
  it('hands each ready message over exactly once, with placeholders filled per member', async () => {
    state.members = [member('1'), member('2')];
    state.rows = [recipient('r1', '1', 'EMAIL'), recipient('r2', '2', 'EMAIL')];
    await runCampaignBatch(TENANT, 'c1');
    expect(state.sends.map((s) => s.title)).toEqual(['Hi First1', 'Hi First2']);
    expect(state.rows.every((r) => r.dispatchedAt !== null)).toBe(true);
  });

  it('a retried or concurrent batch never double-sends: claimed rows are skipped', async () => {
    state.members = [member('1'), member('2'), member('3')];
    state.rows = [recipient('r1', '1', 'EMAIL'), recipient('r2', '2', 'EMAIL'), recipient('r3', '3', 'SMS')];
    await Promise.all([runCampaignBatch(TENANT, 'c1'), runCampaignBatch(TENANT, 'c1')]);
    await runCampaignBatch(TENANT, 'c1'); // and a later retry
    const perRecipient = state.sends.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.recipientId]: (acc[s.recipientId] ?? 0) + 1 }), {});
    expect(perRecipient).toEqual({ r1: 1, r2: 1, r3: 1 });
  });

  it('quiet hours that begin mid-campaign put SMS back on hold until 08:00 member-local, while email still goes', async () => {
    vi.setSystemTime(new Date('2026-10-19T16:30:00Z')); // 22:00 IST
    state.members = [member('1')];
    state.rows = [recipient('r1', '1', 'SMS'), recipient('r2', '1', 'EMAIL')];
    await runCampaignBatch(TENANT, 'c1');
    expect(state.sends.map((s) => s.channel)).toEqual(['EMAIL']);
    const held = state.rows.find((r) => r.id === 'r1')!;
    expect(held.status).toBe('QUEUED');
    expect(held.dispatchedAt).toBeNull();
    expect((held.deliverAfter as Date).toISOString()).toBe('2026-10-20T02:30:00.000Z');
  });

  it('a held message is released once its hold ends', async () => {
    state.members = [member('1')];
    state.rows = [recipient('r1', '1', 'SMS', { deliverAfter: new Date('2026-10-20T02:30:00Z') })];
    await runCampaignBatch(TENANT, 'c1');
    expect(state.sends).toHaveLength(0); // still 12:00 IST on the 19th

    vi.setSystemTime(new Date('2026-10-20T02:31:00Z')); // 08:01 IST next day
    await runCampaignBatch(TENANT, 'c1');
    expect(state.sends.map((s) => s.channel)).toEqual(['SMS']);
  });

  it('with quiet hours off an SMS goes out at night', async () => {
    state.campaign.holdQuietHours = false;
    vi.setSystemTime(new Date('2026-10-19T16:30:00Z'));
    state.members = [member('1')];
    state.rows = [recipient('r1', '1', 'SMS')];
    await runCampaignBatch(TENANT, 'c1');
    expect(state.sends.map((s) => s.channel)).toEqual(['SMS']);
  });

  it('a member who opted out after the audience was built is skipped at send time', async () => {
    state.members = [member('1', { channelPreferences: [{ channel: 'EMAIL' }] })];
    state.rows = [recipient('r1', '1', 'EMAIL')];
    await runCampaignBatch(TENANT, 'c1');
    expect(state.sends).toHaveLength(0);
    expect(state.rows[0]).toMatchObject({ status: 'SKIPPED_OPTED_OUT' });
    expect(state.counters).toContainEqual({ skippedCount: { increment: 1 } });
  });

  it('a cancelled campaign sends nothing', async () => {
    state.campaign.status = 'CANCELLED';
    state.members = [member('1')];
    state.rows = [recipient('r1', '1', 'EMAIL')];
    await runCampaignBatch(TENANT, 'c1');
    expect(state.sends).toHaveLength(0);
  });

  it('push is finalised as SENT immediately; email stays queued for its worker to confirm', async () => {
    state.campaign.channels = ['PUSH', 'EMAIL'];
    state.members = [member('1')];
    state.rows = [recipient('r1', '1', 'PUSH'), recipient('r2', '1', 'EMAIL')];
    await runCampaignBatch(TENANT, 'c1');
    expect(state.rows.find((r) => r.id === 'r1')).toMatchObject({ status: 'SENT' });
    expect(state.rows.find((r) => r.id === 'r2')).toMatchObject({ status: 'QUEUED' });
    expect(state.campaign.status).toBe('SENDING'); // the email is still in flight
  });

  it('closes the campaign once the last message is finished', async () => {
    state.campaign.channels = ['PUSH'];
    state.members = [member('1')];
    state.rows = [recipient('r1', '1', 'PUSH')];
    await runCampaignBatch(TENANT, 'c1');
    expect(state.campaign.status).toBe('SENT');
  });
});
