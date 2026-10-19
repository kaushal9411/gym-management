import { describe, expect, it } from 'vitest';

import {
  buildPlanBenefits,
  parseAccessBranchIds,
  pickCurrentMembership,
  planDurationLabel,
  type PlanBenefitsInput,
} from './member-plan-benefits.util';

const fullPlan: PlanBenefitsInput['plan'] = {
  gymAccessAllBranches: true,
  accessBranchIds: null,
  ptSessionsIncluded: 4,
  groupClassesIncluded: 10,
  dietConsultationIncluded: true,
  lockerAccess: true,
  guestPasses: 2,
  freezeAllowed: true,
  freezeDaysLimit: 15,
};
const noUsage = { ptSessions: 0, groupClasses: 0, guestPasses: 0, freezeDays: 0 };

const build = (
  plan: Partial<PlanBenefitsInput['plan']> = {},
  usage: Partial<PlanBenefitsInput['usage']> = {},
  branchNames: string[] = [],
) =>
  buildPlanBenefits({
    plan: { ...fullPlan, ...plan },
    usage: { ...noUsage, ...usage },
    branchNames,
  });
const by = (list: ReturnType<typeof build>, key: string) => list.find((b) => b.key === key)!;

describe('buildPlanBenefits', () => {
  it('always returns the same 7 benefits in order', () => {
    expect(build().map((b) => b.key)).toEqual([
      'gym_access',
      'pt_sessions',
      'group_classes',
      'diet_consultation',
      'locker',
      'guest_passes',
      'freeze',
    ]);
  });

  it('a fully-loaded plan with nothing used', () => {
    const list = build();
    expect(by(list, 'pt_sessions')).toMatchObject({
      included: true,
      quota: 4,
      used: 0,
      remaining: 4,
      unit: 'sessions',
      note: null,
    });
    expect(by(list, 'group_classes')).toMatchObject({ quota: 10, used: 0, remaining: 10 });
    expect(by(list, 'guest_passes')).toMatchObject({ quota: 2, used: 0, remaining: 2, unit: 'passes' });
    expect(by(list, 'diet_consultation')).toMatchObject({ included: true, quota: null, used: null });
    expect(by(list, 'locker')).toMatchObject({ included: true, quota: null });
    expect(by(list, 'freeze')).toMatchObject({ included: true, quota: 15, used: 0, remaining: 15, unit: 'days' });
  });

  it('zero quotas are "not included" with no usage numbers', () => {
    const list = build(
      { ptSessionsIncluded: 0, groupClassesIncluded: 0, guestPasses: 0 },
      { ptSessions: 3, groupClasses: 5, guestPasses: 1 },
    );
    for (const key of ['pt_sessions', 'group_classes', 'guest_passes']) {
      expect(by(list, key)).toMatchObject({
        included: false,
        quota: null,
        used: null,
        remaining: null,
      });
    }
  });

  it('flags off => diet and locker not included', () => {
    const list = build({ dietConsultationIncluded: false, lockerAccess: false });
    expect(by(list, 'diet_consultation').included).toBe(false);
    expect(by(list, 'locker').included).toBe(false);
  });

  it('partial usage reports remaining', () => {
    const list = build({}, { ptSessions: 1, groupClasses: 7, guestPasses: 1, freezeDays: 4 });
    expect(by(list, 'pt_sessions')).toMatchObject({ used: 1, remaining: 3 });
    expect(by(list, 'group_classes')).toMatchObject({ used: 7, remaining: 3 });
    expect(by(list, 'guest_passes')).toMatchObject({ used: 1, remaining: 1 });
    expect(by(list, 'freeze')).toMatchObject({ used: 4, remaining: 11 });
  });

  it('used == quota => remaining 0 and "All used"', () => {
    const b = by(build({}, { ptSessions: 4 }), 'pt_sessions');
    expect(b).toMatchObject({ used: 4, remaining: 0, note: 'All used', included: true });
  });

  it('used > quota never goes negative (quota lowered after use)', () => {
    const list = build({}, { ptSessions: 9, freezeDays: 40 });
    expect(by(list, 'pt_sessions')).toMatchObject({ quota: 4, used: 9, remaining: 0, note: 'All used' });
    expect(by(list, 'freeze')).toMatchObject({ quota: 15, used: 40, remaining: 0, note: 'All used' });
  });

  it('freeze: uncapped => "No limit" with no numbers', () => {
    expect(by(build({ freezeDaysLimit: null }, { freezeDays: 12 }), 'freeze')).toMatchObject({
      included: true,
      quota: null,
      used: null,
      remaining: null,
      note: 'No limit',
    });
  });

  it('freeze: not allowed (or a 0-day cap) => not included', () => {
    expect(by(build({ freezeAllowed: false }), 'freeze')).toMatchObject({
      included: false,
      quota: null,
      note: 'Not allowed',
    });
    expect(by(build({ freezeDaysLimit: 0 }), 'freeze')).toMatchObject({
      included: false,
      note: 'Not allowed',
    });
  });

  it('gym access: all branches', () => {
    expect(by(build(), 'gym_access')).toMatchObject({
      included: true,
      note: 'All branches',
      items: [],
    });
  });

  it('gym access: branch subset lists sorted, de-duplicated names', () => {
    const b = by(
      build({ gymAccessAllBranches: false }, {}, ['Thane', 'Bandra', 'Thane', ' ']),
      'gym_access',
    );
    expect(b).toMatchObject({ included: true, note: '2 branches', items: ['Bandra', 'Thane'] });
  });

  it('gym access: single branch and unresolved branches', () => {
    expect(by(build({ gymAccessAllBranches: false }, {}, ['Main']), 'gym_access').note).toBe(
      '1 branch',
    );
    expect(by(build({ gymAccessAllBranches: false }, {}, []), 'gym_access')).toMatchObject({
      note: 'Selected branches',
      items: [],
    });
  });

  it('an everything-off plan only keeps gym access', () => {
    const list = build({
      ptSessionsIncluded: 0,
      groupClassesIncluded: 0,
      dietConsultationIncluded: false,
      lockerAccess: false,
      guestPasses: 0,
      freezeAllowed: false,
    });
    expect(list.filter((b) => b.included).map((b) => b.key)).toEqual(['gym_access']);
  });
});

describe('parseAccessBranchIds', () => {
  it('keeps unique non-empty strings only', () => {
    expect(parseAccessBranchIds(['a', 'b', 'a', '', 5, null, ' '])).toEqual(['a', 'b']);
  });
  it('tolerates non-arrays', () => {
    expect(parseAccessBranchIds(null)).toEqual([]);
    expect(parseAccessBranchIds({ a: 1 })).toEqual([]);
  });
});

describe('planDurationLabel', () => {
  it('singular and plural', () => {
    expect(planDurationLabel(1, 'MONTHS')).toBe('1 Month');
    expect(planDurationLabel(3, 'MONTHS')).toBe('3 Months');
    expect(planDurationLabel(1, 'YEARS')).toBe('1 Year');
    expect(planDurationLabel(45, 'DAYS')).toBe('45 Days');
    expect(planDurationLabel(2, 'WEEKS')).toBe('2 Weeks');
  });
});

describe('pickCurrentMembership', () => {
  const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
  const row = (id: string, status: string, start: string, end: string) => ({
    id,
    status,
    startDate: d(start),
    endDate: d(end),
  });
  it('prefers ACTIVE', () => {
    const rows = [
      row('exp', 'EXPIRED', '2026-01-01', '2026-02-01'),
      row('act', 'ACTIVE', '2026-09-01', '2026-12-01'),
      row('pen', 'PENDING', '2026-12-02', '2027-03-01'),
    ];
    expect(pickCurrentMembership(rows)!.id).toBe('act');
  });
  it('else the soonest PENDING', () => {
    const rows = [
      row('p2', 'PENDING', '2027-01-01', '2027-02-01'),
      row('p1', 'PENDING', '2026-12-01', '2027-06-01'),
      row('exp', 'EXPIRED', '2026-01-01', '2026-02-01'),
    ];
    expect(pickCurrentMembership(rows)!.id).toBe('p1');
  });
  it('else the most recently ended EXPIRED', () => {
    const rows = [
      row('old', 'EXPIRED', '2025-01-01', '2025-02-01'),
      row('new', 'EXPIRED', '2026-01-01', '2026-02-01'),
    ];
    expect(pickCurrentMembership(rows)!.id).toBe('new');
  });
  it('null when nothing qualifies', () => {
    expect(pickCurrentMembership([])).toBeNull();
    expect(pickCurrentMembership([row('c', 'CANCELLED', '2026-01-01', '2026-02-01')])).toBeNull();
  });
});
