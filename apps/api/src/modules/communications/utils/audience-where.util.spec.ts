import { describe, expect, it } from 'vitest';

import { buildMemberWhere, buildPickedWhere, describeFilter } from './audience-where.util';

const TENANT = '00000000-0000-0000-0000-0000000000aa';
const today = new Date('2026-10-19T00:00:00Z');
const ctx = { today, scopeBranchIds: null };

/** Flattens the AND list the builder returns. */
const clauses = (where: unknown): Array<Record<string, unknown>> => (where as { AND: Array<Record<string, unknown>> }).AND;
const has = (where: unknown, key: string): boolean => clauses(where).some((c) => key in c);

describe('buildMemberWhere', () => {
  it('always scopes to the tenant and excludes deleted / inactive members', () => {
    const base = clauses(buildMemberWhere(TENANT, {}, ctx))[0]!;
    expect(base).toMatchObject({ tenantId: TENANT, deletedAt: null, status: { in: ['ACTIVE', 'FROZEN'] } });
  });

  it('with no membership filter, lapsed members (memberships but none in force) are left out', () => {
    expect(has(buildMemberWhere(TENANT, {}, ctx), 'NOT')).toBe(true);
  });

  it('EXPIRED selects exactly the lapsed ones', () => {
    const where = buildMemberWhere(TENANT, { membershipStatus: 'EXPIRED' }, ctx);
    expect(has(where, 'NOT')).toBe(false);
    expect(JSON.stringify(where)).toContain('"memberships":{"none":{"status":{"in":["ACTIVE","PENDING"]}}}');
  });

  it('EXPIRING uses the window (default 7 days, custom when given)', () => {
    const seven = JSON.stringify(buildMemberWhere(TENANT, { membershipStatus: 'EXPIRING' }, ctx));
    expect(seven).toContain('2026-10-26T00:00:00.000Z');
    const thirty = JSON.stringify(buildMemberWhere(TENANT, { membershipStatus: 'EXPIRING', expiringWithinDays: 30 }, ctx));
    expect(thirty).toContain('2026-11-18T00:00:00.000Z');
  });

  it('FROZEN filters on member status, NO_PLAN on never having a membership', () => {
    expect(JSON.stringify(buildMemberWhere(TENANT, { membershipStatus: 'FROZEN' }, ctx))).toContain('{"status":"FROZEN"}');
    expect(JSON.stringify(buildMemberWhere(TENANT, { membershipStatus: 'NO_PLAN' }, ctx))).toContain('"memberships":{"none":{}}');
  });

  it('combines filters with AND (plan + branch + trainer + overdue + inactive + class)', () => {
    const where = buildMemberWhere(
      TENANT,
      { planIds: ['p1'], branchIds: ['b1'], trainerIds: ['t1'], hasOverdueInvoice: true, notVisitedDays: 14, bookedClassSessionId: 's1' },
      ctx,
    );
    const json = JSON.stringify(where);
    expect(json).toContain('"planId":{"in":["p1"]}');
    expect(json).toContain('"branchId":{"in":["b1"]}');
    expect(json).toContain('"trainerId":{"in":["t1"]}');
    expect(json).toContain('"dueDate":{"lt":"2026-10-19T00:00:00.000Z"}');
    expect(json).toContain('"classSessionId":"s1"');
    // not visited in 14 days: nobody who checked in since 2026-10-05, and joined on/before that date
    expect(json).toContain('"attendanceDate":{"gte":"2026-10-05T00:00:00.000Z"}');
    expect(json).toContain('"joiningDate":{"lte":"2026-10-05T00:00:00.000Z"}');
  });

  it('a branch-scoped actor can only ever reach their branches, even with no branch filter', () => {
    const where = buildMemberWhere(TENANT, {}, { today, scopeBranchIds: ['b-main'] });
    expect(clauses(where)[0]).toMatchObject({ branchId: { in: ['b-main'] } });
  });

  it('birthday filter restricts to the pre-resolved ids (empty list => nobody)', () => {
    expect(JSON.stringify(buildMemberWhere(TENANT, { birthdayThisWeek: true }, { ...ctx, birthdayMemberIds: ['m1', 'm2'] }))).toContain('"id":{"in":["m1","m2"]}');
    expect(JSON.stringify(buildMemberWhere(TENANT, { birthdayThisWeek: true }, ctx))).toContain('"id":{"in":[]}');
  });

  it('plan filter on EXPIRED looks at any membership status, otherwise only those in force', () => {
    expect(JSON.stringify(buildMemberWhere(TENANT, { membershipStatus: 'EXPIRED', planIds: ['p1'] }, ctx))).toContain('"memberships":{"some":{"planId":{"in":["p1"]}}}');
    expect(JSON.stringify(buildMemberWhere(TENANT, { planIds: ['p1'] }, ctx))).toContain('"planId":{"in":["p1"]},"status":{"in":["ACTIVE","PENDING"]}');
  });
});

describe('buildPickedWhere', () => {
  it('picked members are still tenant- and branch-scoped', () => {
    const where = buildPickedWhere(TENANT, ['m1', 'm2'], ['b1']) as { AND: Array<Record<string, unknown>> };
    expect(where.AND[0]).toMatchObject({ tenantId: TENANT, branchId: { in: ['b1'] } });
    expect(where.AND[1]).toEqual({ id: { in: ['m1', 'm2'] } });
  });
});

describe('describeFilter', () => {
  it('summarises filters without any personal data', () => {
    expect(describeFilter({ membershipStatus: 'EXPIRING', expiringWithinDays: 10, planIds: ['a', 'b'], hasOverdueInvoice: true })).toEqual(['status:EXPIRING(10d)', 'plans:2', 'overdue']);
  });
});
