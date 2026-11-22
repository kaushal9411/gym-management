import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Feature flags x automation sweeps. Hermetic: prisma, the engine, redis and the tenant flag read are mocked. For every
 * sweep: the tenant with the governing module OFF is skipped (nothing dispatched), the tenant with it ON is processed
 * IN THE SAME RUN (the skip is per tenant, never global), and a flag read that fails opens (the sweep still runs).
 */

const OFF = 'tenant-off';
const ON = 'tenant-on';
const BROKEN = 'tenant-broken';

const state = vi.hoisted(() => ({
  flags: {} as Record<string, string[] | 'throw'>,
  dispatched: [] as Array<{ tenantId: string; ruleKey: string; memberId: string }>,
  rows: {} as Record<string, unknown[]>,
}));

vi.mock('../../../core/logging/logger', () => ({ logger: { warn: () => undefined, debug: () => undefined, info: () => undefined, error: () => undefined } }));
vi.mock('../../../infrastructure/cache/redis', () => ({ cache: { get: async () => null, set: async () => undefined, del: async () => undefined } }));
vi.mock('../../tenants/service/tenant.service', () => ({
  tenantService: {
    resolveById: async (tenantId: string) => {
      const flags = state.flags[tenantId];
      if (flags === 'throw') throw new Error('redis down');
      return { id: tenantId, featureFlags: flags ?? [] };
    },
  },
}));
vi.mock('../../../infrastructure/database/prisma', () => {
  const find = (name: string) => async () => state.rows[name] ?? [];
  return {
    prisma: {
      membership: { findMany: find('membership') },
      memberInvoice: { findMany: find('memberInvoice') },
      memberPayment: { findMany: find('memberPayment') },
      member: { findMany: find('member') },
      classSession: { findMany: find('classSession') },
      notificationAutomationRule: { findMany: find('rules') },
    },
  };
});
vi.mock('./automation-engine.service', () => {
  class FakeEngine {
    constructor(private readonly tenantId: string) {}
    async rule(key: string) {
      const offsets: Record<string, number[]> = {
        MEMBERSHIP_EXPIRING: [7, 3, 1],
        MEMBERSHIP_EXPIRED: [1],
        INVOICE_DUE_SOON: [3],
        PAYMENT_OVERDUE: [1, 7, 14],
        PAYMENT_FAILED: [1],
        CLASS_REMINDER: [24, 2],
        BIRTHDAY: [0],
        WE_MISS_YOU: [14],
      };
      return { key, enabled: true, offsets: offsets[key] ?? [1], channels: ['PUSH'], def: {} };
    }
    async markHandled() {}
    async dispatch(params: { rule: { key: string }; memberId: string }) {
      state.dispatched.push({ tenantId: this.tenantId, ruleKey: params.rule.key, memberId: params.memberId });
      return 'SENT' as const;
    }
  }
  class EngineCache {
    for(tenantId: string) {
      return new FakeEngine(tenantId);
    }
  }
  return { EngineCache };
});

import {
  sweepBirthdays,
  sweepClassReminders,
  sweepInvoiceDueSoon,
  sweepMembershipExpired,
  sweepMembershipExpiring,
  sweepPaymentFailed,
  sweepPaymentOverdue,
  sweepWeMissYou,
} from './automation-sweeps.service';

const DAY = 86_400_000;
const todayStart = (): Date => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};
const inDays = (n: number): Date => new Date(todayStart().getTime() + n * DAY);

const invoice = (tenantId: string, dueInDays: number) => ({
  id: `inv-${tenantId}`,
  tenantId,
  memberId: `m-${tenantId}`,
  invoiceNumber: 'INV-1',
  dueDate: inDays(dueInDays),
  totalAmount: 1000,
  member: { firstName: 'A' },
  items: [],
  payments: [],
});

beforeEach(() => {
  state.flags = { [OFF]: ['attendance'], [ON]: ['notifications', 'payments', 'live_classes', 'attendance', 'reports'], [BROKEN]: 'throw' };
  state.dispatched = [];
  state.rows = {};
});

const tenantsDispatched = (): string[] => [...new Set(state.dispatched.map((d) => d.tenantId))].sort();

describe('notifications-governed sweeps', () => {
  it('membership expiring: skips the tenant with notifications off, processes the one with it on, same run', async () => {
    const m = (tenantId: string) => ({ id: `ms-${tenantId}`, tenantId, memberId: `m-${tenantId}`, endDate: inDays(3), plan: { name: 'Gold' } });
    state.rows.membership = [m(OFF), m(ON)];
    const result = await sweepMembershipExpiring();
    expect(tenantsDispatched()).toEqual([ON]);
    expect(result.scanned).toBe(1);
    expect(result.sent).toBe(1);
  });

  it('membership expired: same per-tenant skip', async () => {
    const m = (tenantId: string) => ({ id: `ms-${tenantId}`, tenantId, memberId: `m-${tenantId}`, endDate: inDays(-1), plan: { name: 'Gold' } });
    state.rows.membership = [m(OFF), m(ON)];
    await sweepMembershipExpired();
    expect(tenantsDispatched()).toEqual([ON]);
  });

  it('birthdays: skips the tenant with notifications off', async () => {
    const dob = todayStart();
    state.rows.member = [
      { id: 'b-off', tenantId: OFF, dateOfBirth: dob },
      { id: 'b-on', tenantId: ON, dateOfBirth: dob },
    ];
    await sweepBirthdays();
    expect(state.dispatched.map((d) => d.memberId)).toEqual(['b-on']);
  });
});

describe('payments-governed sweeps (member invoice reminders)', () => {
  it('invoice due soon: skips payments-off, processes payments-on', async () => {
    state.rows.memberInvoice = [invoice(OFF, 3), invoice(ON, 3)];
    await sweepInvoiceDueSoon();
    expect(tenantsDispatched()).toEqual([ON]);
  });

  it('payment overdue: skips payments-off, processes payments-on', async () => {
    state.rows.memberInvoice = [invoice(OFF, -1), invoice(ON, -1)];
    await sweepPaymentOverdue();
    expect(tenantsDispatched()).toEqual([ON]);
  });

  it('payment failed: skips payments-off, processes payments-on', async () => {
    const p = (tenantId: string) => ({ id: `p-${tenantId}`, tenantId, memberId: `m-${tenantId}`, finalAmount: 500, createdAt: inDays(-1) });
    state.rows.memberPayment = [p(OFF), p(ON)];
    await sweepPaymentFailed();
    expect(tenantsDispatched()).toEqual([ON]);
  });
});

describe('live_classes-governed sweep', () => {
  it('class reminders: skips live_classes-off, processes live_classes-on', async () => {
    const start = new Date(Date.now() + 1.5 * 3_600_000);
    const hh = String(start.getUTCHours()).padStart(2, '0');
    const mm = String(start.getUTCMinutes()).padStart(2, '0');
    const session = (tenantId: string) => ({
      id: `s-${tenantId}`,
      tenantId,
      sessionDate: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())),
      startTime: `${hh}:${mm}`,
      groupClass: { name: 'Yoga' },
      branch: { timezone: 'UTC' },
      bookings: [{ memberId: `m-${tenantId}` }],
    });
    state.rows.classSession = [session(OFF), session(ON)];
    await sweepClassReminders();
    expect(tenantsDispatched()).toEqual([ON]);
  });
});

describe('attendance-governed sweep', () => {
  it('we-miss-you: only tenants with attendance on are scanned', async () => {
    state.flags[OFF] = ['notifications'];
    state.rows.rules = [{ tenantId: OFF }, { tenantId: ON }];
    state.rows.member = [{ id: 'quiet-member', attendances: [] }];
    await sweepWeMissYou();
    expect(tenantsDispatched()).toEqual([ON]);
  });
});

describe('fail open', () => {
  it('a tenant whose flags cannot be read is still processed (a flag-read failure must not stop reminders)', async () => {
    state.rows.memberInvoice = [invoice(BROKEN, 3), invoice(OFF, 3)];
    await sweepInvoiceDueSoon();
    expect(tenantsDispatched()).toEqual([BROKEN]);
  });
});
