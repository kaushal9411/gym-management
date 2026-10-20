import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const TENANT = '00000000-0000-0000-0000-0000000000aa';
const MEMBER = '11111111-1111-4111-8111-111111111111';

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  dispatchKeys: new Set<string>(),
  deleted: [] as string[],
  sends: [] as Array<{ channel: string; title: string; body: string }>,
  optedOut: [] as string[],
  memberFails: false,
  savedRules: [] as Row[],
  template: { isActive: true, isCustomized: false, channels: ['IN_APP', 'EMAIL', 'PUSH'], titleTemplate: 'T', bodyTemplate: 'B' },
  staffFeed: [] as string[],
}));

vi.mock('../../../infrastructure/database/tenant-scoped-client', () => {
  const db = {
    notificationAutomationRule: { findMany: async () => state.savedRules },
    automationDispatch: {
      create: async ({ data }: { data: Row }) => {
        const key = [data.tenantId, data.ruleKey, data.memberId, data.subjectId, data.offsetKey].join('|');
        if (state.dispatchKeys.has(key)) throw new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' });
        state.dispatchKeys.add(key);
        return { id: key };
      },
      deleteMany: async ({ where }: { where: { id: string } }) => {
        state.deleted.push(where.id);
        state.dispatchKeys.delete(where.id);
        return { count: 1 };
      },
    },
    member: {
      findMany: async () => {
        if (state.memberFails) throw new Error('db down');
        return [
          {
            id: MEMBER,
            memberId: 'MEM-0001',
            firstName: 'Aarav',
            lastName: 'Kapoor',
            email: null,
            phone: null,
            branchId: 'b1',
            status: 'ACTIVE',
            deletedAt: null,
            branch: { name: 'Main', timezone: 'Asia/Kolkata' },
            memberships: [{ endDate: new Date('2026-10-26T00:00:00Z'), plan: { name: 'Monthly' } }],
            invoices: [],
            deviceTokens: [{ token: 't1' }],
            channelPreferences: state.optedOut.map((channel) => ({ channel })),
          },
        ];
      },
    },
  };
  return { getTenantScopedClient: () => db };
});

vi.mock('../../../infrastructure/mail/branding', () => ({ loadEmailBranding: async () => ({ tenantName: 'Kaushal Fitness' }) }));
vi.mock('../../tenant-notifications/services/notification-template.service', () => ({
  notificationTemplateService: { getEffective: async () => state.template },
}));
vi.mock('../../tenant-notifications/services/tenant-notification.service', () => ({
  tenantNotificationService: { notifyTenant: async (_t: string, _c: string, title: string) => void state.staffFeed.push(title) },
}));
vi.mock('./channel-sender.service', () => ({
  sendToMember: vi.fn(async (args: { channel: string; title: string; body: string }) => {
    state.sends.push({ channel: args.channel, title: args.title, body: args.body });
    return { outcome: 'HANDED_OVER' };
  }),
}));

import { AutomationEngine } from './automation-engine.service';

beforeEach(() => {
  state.dispatchKeys.clear();
  state.deleted = [];
  state.sends = [];
  state.optedOut = [];
  state.memberFails = false;
  state.savedRules = [];
  state.staffFeed = [];
  state.template = { isActive: true, isCustomized: false, channels: ['IN_APP', 'EMAIL', 'PUSH'], titleTemplate: 'T', bodyTemplate: 'B' };
});

describe('dedupe ledger', () => {
  it('the same rule + member + subject + timing is sent exactly once', async () => {
    const engine = new AutomationEngine(TENANT);
    const rule = await engine.rule('MEMBERSHIP_EXPIRING');
    const params = { rule, memberId: MEMBER, subjectId: 'membership-1', offsetKey: '7', vars: { daysLeft: '7' } };

    expect(await engine.dispatch(params)).toBe('SENT');
    const afterFirst = state.sends.length;
    expect(afterFirst).toBe(rule.channels.length);

    expect(await engine.dispatch(params)).toBe('DEDUPED');
    expect(await engine.dispatch(params)).toBe('DEDUPED');
    expect(state.sends).toHaveLength(afterFirst);
  });

  it('a different timing, subject or rule is a new send (7 -> 3 -> 1 days)', async () => {
    const engine = new AutomationEngine(TENANT);
    const rule = await engine.rule('MEMBERSHIP_EXPIRING');
    const base = { rule, memberId: MEMBER, subjectId: 'membership-1' };
    expect(await engine.dispatch({ ...base, offsetKey: '7' })).toBe('SENT');
    expect(await engine.dispatch({ ...base, offsetKey: '3' })).toBe('SENT');
    expect(await engine.dispatch({ ...base, offsetKey: '1' })).toBe('SENT');
    expect(await engine.dispatch({ ...base, subjectId: 'membership-2', offsetKey: '7' })).toBe('SENT');
    expect(await engine.dispatch({ ...base, offsetKey: '1' })).toBe('DEDUPED');
  });

  it('markHandled records a timing without sending (legacy Redis-dedupe carry-over)', async () => {
    const engine = new AutomationEngine(TENANT);
    const rule = await engine.rule('MEMBERSHIP_EXPIRING');
    await engine.markHandled(rule, MEMBER, 'membership-1', '7');
    expect(state.sends).toHaveLength(0);
    expect(await engine.dispatch({ rule, memberId: MEMBER, subjectId: 'membership-1', offsetKey: '7' })).toBe('DEDUPED');
  });

  it('gives the claim back when nothing could be handed over because of an error, so the next run retries', async () => {
    const engine = new AutomationEngine(TENANT);
    const rule = await engine.rule('PAYMENT_OVERDUE');
    state.memberFails = true;
    await expect(engine.dispatch({ rule, memberId: MEMBER, subjectId: 'inv-1', offsetKey: '7' })).rejects.toThrow('db down');
    expect(state.deleted).toHaveLength(1);
    state.memberFails = false;
    expect(await engine.dispatch({ rule, memberId: MEMBER, subjectId: 'inv-1', offsetKey: '7' })).toBe('SENT');
  });
});

describe('opt-out rules', () => {
  it("own-account reminders (overdue, expiring, class) ignore a member's promotional opt-out", async () => {
    state.optedOut = ['PUSH', 'EMAIL', 'SMS', 'WHATSAPP'];
    const engine = new AutomationEngine(TENANT);
    const rule = await engine.rule('PAYMENT_OVERDUE');
    expect(rule.def.kind).toBe('TRANSACTIONAL');
    await engine.dispatch({ rule, memberId: MEMBER, subjectId: 'inv-1', offsetKey: '1' });
    expect(state.sends.map((s) => s.channel).sort()).toEqual(['PUSH', 'SMS']);
  });

  it('promotional rules (birthday) respect it, per channel', async () => {
    state.optedOut = ['EMAIL'];
    const engine = new AutomationEngine(TENANT);
    const rule = await engine.rule('BIRTHDAY');
    expect(rule.def.kind).toBe('PROMOTIONAL');
    await engine.dispatch({ rule, memberId: MEMBER, subjectId: MEMBER, offsetKey: 'y2026' });
    expect(state.sends.map((s) => s.channel)).toEqual(['PUSH']);
  });

  it('a one-off override makes a transactional rule respect opt-out (new-class announcement)', async () => {
    state.optedOut = ['PUSH'];
    const engine = new AutomationEngine(TENANT);
    const rule = await engine.rule('CLASS_SCHEDULED_OR_CHANGED');
    await engine.dispatch({ rule, memberId: MEMBER, subjectId: 'class-1', offsetKey: 'NEW_CLASS-1', respectOptOut: true });
    expect(state.sends.map((s) => s.channel)).toEqual(['IN_APP']);
  });
});

describe('rule resolution', () => {
  it('uses the documented defaults when no row exists', async () => {
    const engine = new AutomationEngine(TENANT);
    const expiring = await engine.rule('MEMBERSHIP_EXPIRING');
    expect(expiring).toMatchObject({ enabled: true, isDefault: true, offsets: [7, 3, 1], channels: ['PUSH', 'EMAIL'] });
    expect((await engine.rule('PAYMENT_OVERDUE')).offsets).toEqual([1, 7, 14]);
    expect((await engine.rule('CLASS_REMINDER')).offsets).toEqual([24, 2]);
    expect((await engine.rule('WE_MISS_YOU')).enabled).toBe(false);
  });

  it('a saved row wins over the defaults', async () => {
    state.savedRules = [{ key: 'MEMBERSHIP_EXPIRING', enabled: false, offsets: [10, 2], channels: ['SMS'], titleTemplate: 'Custom', bodyTemplate: null, updatedAt: new Date() }];
    const rule = await new AutomationEngine(TENANT).rule('MEMBERSHIP_EXPIRING');
    expect(rule).toMatchObject({ enabled: false, isDefault: false, offsets: [2, 10], channels: ['SMS'], titleOverride: 'Custom' });
  });

  it('a legacy template switched off keeps the rule off, even when staff saved it enabled', async () => {
    state.template = { ...state.template, isActive: false, isCustomized: true };
    expect((await new AutomationEngine(TENANT).rule('BIRTHDAY')).enabled).toBe(false);
    state.savedRules = [{ key: 'BIRTHDAY', enabled: true, offsets: [], channels: ['PUSH'], titleTemplate: null, bodyTemplate: null, updatedAt: new Date() }];
    expect((await new AutomationEngine(TENANT).rule('BIRTHDAY')).enabled).toBe(false);
    state.template = { ...state.template, isActive: true };
    expect((await new AutomationEngine(TENANT).rule('BIRTHDAY')).enabled).toBe(true);
  });

  it('message text: override > customised legacy template > built-in default, with placeholders filled', async () => {
    const engine = new AutomationEngine(TENANT);
    const rule = await engine.rule('MEMBERSHIP_EXPIRING');
    await engine.dispatch({ rule, memberId: MEMBER, subjectId: 'm1', offsetKey: '7', vars: { daysLeft: '7', endDate: '26 Oct 2026', planName: 'Monthly' } });
    expect(state.sends[0]!.title).toBe('Aarav, your Monthly plan ends 26 Oct 2026');

    state.sends = [];
    state.template = { isActive: true, isCustomized: true, channels: ['IN_APP'], titleTemplate: '{{memberName}} - {{planName}} {{expiryStatus}}', bodyTemplate: 'Hello' };
    const engine2 = new AutomationEngine(TENANT);
    await engine2.dispatch({ rule: await engine2.rule('MEMBERSHIP_EXPIRING'), memberId: MEMBER, subjectId: 'm2', offsetKey: '7', vars: { expiryStatus: 'expires in 7 day(s)' } });
    expect(state.sends[0]!.title).toBe('Aarav Kapoor - Monthly expires in 7 day(s)');
  });

  it('only template-linked rules also write the staff Notification Center entry, and only when asked', async () => {
    const engine = new AutomationEngine(TENANT);
    await engine.dispatch({ rule: await engine.rule('MEMBERSHIP_EXPIRING'), memberId: MEMBER, subjectId: 'm1', offsetKey: '7', staffFeed: true });
    expect(state.staffFeed).toHaveLength(1);
    await engine.dispatch({ rule: await engine.rule('PAYMENT_OVERDUE'), memberId: MEMBER, subjectId: 'i1', offsetKey: '1', staffFeed: true });
    expect(state.staffFeed).toHaveLength(1);
  });
});
