import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  membership: null as Record<string, unknown> | null,
  transferredIn: null as Record<string, unknown> | null,
  payments: [] as Array<{ finalAmount: number; refunds: Array<{ amount: number }> }>,
  lastPaymentWhere: undefined as Record<string, unknown> | undefined,
}));

vi.mock('../../../infrastructure/database/tenant-scoped-client', () => ({
  getTenantScopedClient: () => ({
    membership: { findFirst: vi.fn(async () => state.membership) },
    membershipTransfer: { findFirst: vi.fn(async () => state.transferredIn) },
    memberPayment: {
      findMany: vi.fn(async (args: { where: Record<string, unknown> }) => {
        state.lastPaymentWhere = args.where;
        return state.payments;
      }),
    },
  }),
}));
vi.mock('../repositories/member-invoice.repository', () => ({ MemberInvoiceRepository: class {} }));
vi.mock('./member-invoice.service', () => ({ MemberInvoiceService: class {} }));

import { MemberBalanceService } from './member-balance.service';

const membership = (overrides: Record<string, unknown> = {}) => ({
  id: 'ms-1',
  status: 'ACTIVE',
  priceAtAssignment: 2000,
  plan: { discountPercentage: 0, taxPercentage: 0 },
  ...overrides,
});

describe('MemberBalanceService#collectable — the "no double payment on one membership" guard', () => {
  const service = new MemberBalanceService('tenant-1');

  beforeEach(() => {
    state.membership = membership();
    state.transferredIn = null;
    state.payments = [];
    state.lastPaymentWhere = undefined;
  });

  it('the whole price is collectable on an unpaid membership', async () => {
    expect(await service.collectable('ms-1')).toEqual({ blocked: null, remaining: 2000 });
  });

  it('only the unpaid remainder is collectable after a part payment', async () => {
    state.payments = [{ finalAmount: 1500, refunds: [] }];
    expect((await service.collectable('ms-1')).remaining).toBe(500);
  });

  it('nothing is collectable once the membership is fully paid', async () => {
    state.payments = [{ finalAmount: 2000, refunds: [] }];
    expect((await service.collectable('ms-1')).remaining).toBe(0);
  });

  it('refunds are netted off, so a refunded mistake can be re-recorded', async () => {
    state.payments = [{ finalAmount: 2000, refunds: [{ amount: 2000 }] }];
    expect((await service.collectable('ms-1')).remaining).toBe(2000);
    state.payments = [{ finalAmount: 2000, refunds: [{ amount: 300 }] }];
    expect((await service.collectable('ms-1')).remaining).toBe(300);
  });

  it('uses the discount-then-tax price the balance invoice is built from', async () => {
    state.membership = membership({ plan: { discountPercentage: 10, taxPercentage: 18 } });
    // (2000 - 10%) * 1.18 = 2124
    expect((await service.collectable('ms-1')).remaining).toBe(2124);
  });

  it('excludes the payment being edited from what counts as already paid', async () => {
    await service.collectable('ms-1', 'pay-9');
    expect(state.lastPaymentWhere).toMatchObject({ id: { not: 'pay-9' } });
  });

  it('counts PENDING (an unpaid payment link) so a link and a cash payment cannot both cover the same balance', async () => {
    await service.collectable('ms-1');
    expect((state.lastPaymentWhere?.status as { in: string[] }).in).toContain('PENDING');
  });

  it.each(['CANCELLED', 'SUPERSEDED'])('blocks a %s membership outright', async (status) => {
    state.membership = membership({ status });
    const result = await service.collectable('ms-1');
    expect(result.blocked).toMatch(/no longer active/);
    expect(result.remaining).toBe(0);
  });

  it('blocks a membership received by transfer — the sender already paid for it', async () => {
    state.transferredIn = { id: 'transfer-1' };
    const result = await service.collectable('ms-1');
    expect(result.blocked).toMatch(/transferred from another member/);
  });

  it('an EXPIRED membership can still be paid — the member owes it', async () => {
    state.membership = membership({ status: 'EXPIRED' });
    expect((await service.collectable('ms-1')).blocked).toBeNull();
  });
});
