import { describe, expect, it } from 'vitest';

import {
  applyMemoryFilters,
  atRiskReason,
  buildGrowth,
  buildPlanMix,
  buildRenewals,
  computeCounts,
  csvCell,
  csvRow,
  escapeLike,
  lastMonths,
  matchesView,
  runBulk,
  scoreTenant,
  sortTenants,
  tenantCsvRow,
  toListItem,
  toSqlFilters,
  type TenantFact,
} from './tenant-list.util';

const now = new Date('2026-10-04T12:00:00Z');
const d = (days: number) => new Date(now.getTime() + days * 86_400_000);

let n = 0;
const fact = (o: Partial<TenantFact> = {}): TenantFact => ({
  id: `00000000-0000-0000-0000-${String(++n).padStart(12, '0')}`,
  slug: `t${n}`,
  name: `Tenant ${n}`,
  status: 'ACTIVE',
  trialEndsAt: null,
  suspendedAt: null,
  maintenanceMode: false,
  createdAt: d(-100),
  ownerName: 'Own',
  ownerEmail: `o${n}@x.com`,
  planId: 'p1',
  planName: 'Pro',
  subscriptionStatus: 'ACTIVE',
  currentPeriodEnd: d(10),
  graceEndsAt: null,
  mrr: 100,
  members: 50,
  membersLimit: 100,
  branches: 1,
  country: 'IN',
  maxUtilisation: 0.5,
  lastActiveAt: d(-1),
  attendanceRecent: 100,
  paymentFailed: false,
  openTickets: 0,
  ...o,
});

describe('toSqlFilters', () => {
  it('escapes LIKE wildcards and wraps in %', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
    expect(toSqlFilters({ search: ' a%b ' }).searchPattern).toBe('%a\\%b%');
    expect(toSqlFilters({}).searchPattern).toBeNull();
  });
  it('plan: uuid -> planId, otherwise lower-cased name', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(toSqlFilters({ plan: id })).toMatchObject({ planId: id, planName: null });
    expect(toSqlFilters({ plan: 'Pro Plus' })).toMatchObject({
      planId: null,
      planName: 'pro plus',
    });
  });
  it('country upper-cased; createdTo is inclusive via exclusive next-day bound', () => {
    const f = toSqlFilters({ country: 'in', createdFrom: '2026-01-01', createdTo: '2026-01-31' });
    expect(f.country).toBe('IN');
    expect(f.createdFrom?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(f.createdToExclusive?.toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });
});

describe('views', () => {
  it('trials_ending: TRIAL ending within 14 days, not lapsed', () => {
    expect(matchesView(fact({ status: 'TRIAL', trialEndsAt: d(5) }), 'trials_ending', now)).toBe(
      true,
    );
    expect(matchesView(fact({ status: 'TRIAL', trialEndsAt: d(15) }), 'trials_ending', now)).toBe(
      false,
    );
    expect(matchesView(fact({ status: 'TRIAL', trialEndsAt: d(-1) }), 'trials_ending', now)).toBe(
      false,
    );
    expect(matchesView(fact({ status: 'ACTIVE', trialEndsAt: d(5) }), 'trials_ending', now)).toBe(
      false,
    );
  });
  it('past_due / suspended / near_limits', () => {
    expect(matchesView(fact({ status: 'PAST_DUE' }), 'past_due', now)).toBe(true);
    expect(matchesView(fact({ status: 'SUSPENDED' }), 'suspended', now)).toBe(true);
    expect(matchesView(fact({ maxUtilisation: 0.9 }), 'near_limits', now)).toBe(true);
    expect(matchesView(fact({ maxUtilisation: 0.89 }), 'near_limits', now)).toBe(false);
  });
  it('at_risk reasons with precedence', () => {
    expect(atRiskReason(fact({ paymentFailed: true, subscriptionStatus: 'GRACE' }), now)).toBe(
      'PAYMENT_FAILED',
    );
    expect(atRiskReason(fact({ subscriptionStatus: 'GRACE' }), now)).toBe('GRACE');
    expect(atRiskReason(fact({ subscriptionStatus: 'PAST_DUE' }), now)).toBe('PAST_DUE');
    expect(atRiskReason(fact({ status: 'SUSPENDED', suspendedAt: d(-3) }), now)).toBe(
      'SUSPENDED_RECENTLY',
    );
    expect(atRiskReason(fact({ status: 'SUSPENDED', suspendedAt: d(-30) }), now)).toBeNull();
    expect(atRiskReason(fact({ maxUtilisation: 0.95 }), now)).toBe('NEAR_LIMIT');
    expect(atRiskReason(fact(), now)).toBeNull();
  });
});

describe('filters + counts', () => {
  const rows = [
    fact({ status: 'ACTIVE' }),
    fact({ status: 'TRIAL', trialEndsAt: d(3), subscriptionStatus: 'TRIALING', mrr: null }),
    fact({ status: 'PAST_DUE', subscriptionStatus: 'PAST_DUE' }),
    fact({ status: 'SUSPENDED', suspendedAt: d(-2) }),
    fact({ status: 'CANCELLED', subscriptionStatus: 'CANCELED', mrr: null }),
    fact({ status: 'ACTIVE', maxUtilisation: 0.97 }),
  ].map((r) => scoreTenant(r, now));

  it('counts ignore status/view/health and cover every card', () => {
    expect(computeCounts(rows, now)).toEqual({
      all: 6,
      active: 2,
      trial: 1,
      pastDue: 1,
      suspended: 1,
      cancelled: 1,
      trialsEnding: 1,
      atRisk: 3, // past due, suspended recently, near limit
      nearLimits: 1,
    });
  });
  it('status + view + health combine (AND)', () => {
    expect(applyMemoryFilters(rows, { status: 'ACTIVE' }, now)).toHaveLength(2);
    expect(applyMemoryFilters(rows, { view: 'at_risk' }, now)).toHaveLength(3);
    expect(applyMemoryFilters(rows, { status: 'ACTIVE', view: 'near_limits' }, now)).toHaveLength(
      1,
    );
    const bucket = rows[0]!.healthBucket;
    expect(
      applyMemoryFilters(rows, { health: bucket }, now).every((r) => r.healthBucket === bucket),
    ).toBe(true);
  });
});

describe('sortTenants', () => {
  const rows = [
    fact({ name: 'bravo', mrr: 50, members: 10, lastActiveAt: d(-5), createdAt: d(-3) }),
    fact({ name: 'Alpha', mrr: null, members: null, lastActiveAt: null, createdAt: d(-1) }),
    fact({ name: 'charlie', mrr: 200, members: 30, lastActiveAt: d(-1), createdAt: d(-2) }),
  ].map((r) => scoreTenant(r, now));
  const names = (s: Parameters<typeof sortTenants>[1], dir?: 'asc' | 'desc') =>
    sortTenants(rows, s, dir).map((r) => r.name);

  it('mrr/members/lastActiveAt put nulls last in both directions', () => {
    expect(names('mrr', 'desc')).toEqual(['charlie', 'bravo', 'Alpha']);
    expect(names('mrr', 'asc')).toEqual(['bravo', 'charlie', 'Alpha']);
    expect(names('members', 'desc')).toEqual(['charlie', 'bravo', 'Alpha']);
    expect(names('lastActiveAt', 'desc')).toEqual(['charlie', 'bravo', 'Alpha']);
  });
  it('name is case-insensitive; createdAt default desc', () => {
    expect(names('name', 'asc')).toEqual(['Alpha', 'bravo', 'charlie']);
    expect(names(undefined)).toEqual(['Alpha', 'charlie', 'bravo']);
  });
  it('health sorts by score', () => {
    const s = sortTenants(rows, 'health', 'desc').map((r) => r.healthScore);
    expect([...s].sort((a, b) => b - a)).toEqual(s);
  });
});

describe('toListItem / csv', () => {
  it('maps additive fields; mrr formatted; renewsAt only for ACTIVE', () => {
    const item = toListItem(scoreTenant(fact({ mrr: 99.5, subscriptionStatus: 'ACTIVE' }), now));
    expect(item).toMatchObject({
      mrr: '99.50',
      planName: 'Pro',
      plan: 'Pro',
      members: 50,
      membersLimit: 100,
    });
    expect(item.renewsAt).toEqual(d(10));
    expect(
      toListItem(scoreTenant(fact({ subscriptionStatus: 'TRIALING', mrr: null }), now)).renewsAt,
    ).toBeNull();
  });
  it('csvCell quotes, doubles quotes, handles newlines/null', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('l1\nl2')).toBe('"l1\nl2"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(42)).toBe('42');
  });
  it('csvCell neutralises spreadsheet formulas', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell(-5)).toBe('-5');
  });
  it('tenantCsvRow has 12 columns, CRLF terminated', () => {
    const row = tenantCsvRow(scoreTenant(fact({ name: 'A, "B"' }), now));
    expect(row.endsWith('\r\n')).toBe(true);
    expect(row.startsWith('"A, ""B""",')).toBe(true);
    expect(csvRow(['a', 'b'])).toBe('a,b\r\n');
  });
});

describe('tags', () => {
  it('list item carries tags; CSV has a ; joined Tags column', () => {
    const t = scoreTenant(fact(), now);
    expect(toListItem(t, ['vip', 'key-account']).tags).toEqual(['vip', 'key-account']);
    expect(toListItem(t).tags).toEqual([]);
    expect(tenantCsvRow(t, ['vip', 'key-account']).trimEnd().endsWith(',vip;key-account')).toBe(
      true,
    );
  });
  it('tag filter restricts to the id set and counts are unaffected', () => {
    const rows = [fact(), fact(), fact()].map((r) => scoreTenant(r, now));
    const ids = new Set([rows[1]!.id]);
    expect(applyMemoryFilters(rows, {}, now, ids).map((r) => r.id)).toEqual([rows[1]!.id]);
    expect(computeCounts(rows, now).all).toBe(3);
  });
  it('paid = ACTIVE subscription (same as the detail overview)', () => {
    const a = scoreTenant(
      fact({ mrr: 0, membersLimit: 100, members: 1, maxUtilisation: 0.01 }),
      now,
    );
    expect(a.healthComponents.utilisation).toBe(30);
  });
});

describe('insights helpers', () => {
  it('lastMonths + cumulative growth', () => {
    const months = lastMonths(3, now);
    expect(months).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(
      buildGrowth(
        months,
        new Map([
          ['2026-09', 2],
          ['2026-10', 1],
        ]),
        10,
      ),
    ).toEqual([
      { month: '2026-08', total: 10, new: 0 },
      { month: '2026-09', total: 12, new: 2 },
      { month: '2026-10', total: 13, new: 1 },
    ]);
  });
  it('plan mix groups by plan and sums mrr', () => {
    const mix = buildPlanMix([
      scoreTenant(fact({ mrr: 10 }), now),
      scoreTenant(fact({ mrr: 5 }), now),
      scoreTenant(fact({ planId: 'p2', planName: 'Basic', mrr: null }), now),
      scoreTenant(fact({ planId: null, planName: null }), now),
    ]);
    expect(mix).toEqual([
      { planId: 'p1', planName: 'Pro', tenants: 2, mrr: '15.00' },
      { planId: 'p2', planName: 'Basic', tenants: 1, mrr: '0.00' },
    ]);
  });
  it('renewals: 8 zero-filled rolling weeks from today', () => {
    const r = buildRenewals(
      [
        { currentPeriodEnd: d(1), monthly: 100 },
        { currentPeriodEnd: d(2), monthly: 50 },
        { currentPeriodEnd: d(8), monthly: 10 },
        { currentPeriodEnd: d(-3), monthly: 999 },
        { currentPeriodEnd: d(80), monthly: 999 },
      ],
      8,
      now,
    );
    expect(r).toHaveLength(8);
    expect(r[0]).toEqual({ weekStart: '2026-10-04', tenants: 2, expectedMrr: '150.00' });
    expect(r[1]).toMatchObject({ weekStart: '2026-10-11', tenants: 1, expectedMrr: '10.00' });
    expect(r[7]!.tenants).toBe(0);
  });
});

describe('runBulk', () => {
  it('continues past failures, dedupes ids, aggregates counts', async () => {
    const seen: string[] = [];
    const out = await runBulk(
      ['a', 'b', 'a', 'c'],
      async (id) => {
        seen.push(id);
        if (id === 'b') throw new Error('boom');
      },
      (e) => (e as Error).message,
    );
    expect(seen).toEqual(['a', 'b', 'c']);
    expect(out).toEqual({
      results: [
        { tenantId: 'a', ok: true },
        { tenantId: 'b', ok: false, error: 'boom' },
        { tenantId: 'c', ok: true },
      ],
      succeeded: 2,
      failed: 1,
    });
  });
});
