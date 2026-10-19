import type { DurationType } from '@prisma/client';

/**
 * Pure builder behind `GET /portal/plan` ("What's included in your plan"). Web and mobile render this list as-is, so
 * every rule lives here once and is unit tested.
 *
 * Quota convention (matches the staff `PlanUsageDto` / `MemberUsagePanel`): a quota of `0` means the benefit is
 * NOT part of the plan (`included: false`, no usage numbers). `freezeDaysLimit === null` means "no cap".
 */
export type PlanBenefitKey =
  | 'gym_access'
  | 'pt_sessions'
  | 'group_classes'
  | 'diet_consultation'
  | 'locker'
  | 'guest_passes'
  | 'freeze';

export interface PlanBenefit {
  key: PlanBenefitKey;
  label: string;
  included: boolean;
  /** Plan allowance; null when the benefit has no numeric allowance (gym access, locker, diet, uncapped freeze). */
  quota: number | null;
  /** Consumed so far in this membership period; null when `quota` is null or the benefit isn't included. */
  used: number | null;
  /** `max(0, quota - used)`; null whenever `used` is null. */
  remaining: number | null;
  /** 'sessions' | 'classes' | 'passes' | 'days' for quota benefits, else null. */
  unit: string | null;
  /** Short human context: 'All branches', 'No limit', 'Not allowed', 'All used'; null when there is nothing to add. */
  note: string | null;
  /** Gym access only: the branch names the plan covers when it is limited to selected branches; empty otherwise. */
  items: string[];
}

export interface PlanBenefitsInput {
  plan: {
    gymAccessAllBranches: boolean;
    accessBranchIds: unknown;
    ptSessionsIncluded: number;
    groupClassesIncluded: number;
    dietConsultationIncluded: boolean;
    lockerAccess: boolean;
    guestPasses: number;
    freezeAllowed: boolean;
    freezeDaysLimit: number | null;
  };
  usage: { ptSessions: number; groupClasses: number; guestPasses: number; freezeDays: number };
  /** Names of the branches in `accessBranchIds` that still exist (already resolved by the caller). */
  branchNames: string[];
}

/** Valid, de-duplicated uuid-ish strings from the stored JSON array (anything else is ignored). */
export function parseAccessBranchIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) if (typeof v === 'string' && v.trim() && !out.includes(v)) out.push(v);
  return out;
}

const DURATION_UNIT: Record<DurationType, [singular: string, plural: string]> = {
  DAYS: ['Day', 'Days'],
  WEEKS: ['Week', 'Weeks'],
  MONTHS: ['Month', 'Months'],
  YEARS: ['Year', 'Years'],
};

/** "1 Month", "3 Months", "1 Year", "45 Days". */
export function planDurationLabel(value: number, type: DurationType): string {
  const [one, many] = DURATION_UNIT[type] ?? DURATION_UNIT.MONTHS;
  return `${value} ${value === 1 ? one : many}`;
}

function quotaBenefit(
  key: PlanBenefitKey,
  label: string,
  unit: string,
  quota: number,
  used: number,
): PlanBenefit {
  if (quota <= 0) {
    return { key, label, included: false, quota: null, used: null, remaining: null, unit, note: null, items: [] };
  }
  const remaining = Math.max(0, quota - used);
  return {
    key,
    label,
    included: true,
    quota,
    used,
    remaining,
    unit,
    note: remaining === 0 ? 'All used' : null,
    items: [],
  };
}

const flag = (key: PlanBenefitKey, label: string, included: boolean): PlanBenefit => ({
  key,
  label,
  included,
  quota: null,
  used: null,
  remaining: null,
  unit: null,
  note: null,
  items: [],
});

function freezeBenefit(plan: PlanBenefitsInput['plan'], usedDays: number): PlanBenefit {
  const base = { key: 'freeze' as const, label: 'Membership freeze', unit: 'days', items: [] };
  const blocked = !plan.freezeAllowed || plan.freezeDaysLimit === 0;
  if (blocked) {
    return { ...base, included: false, quota: null, used: null, remaining: null, note: 'Not allowed' };
  }
  if (plan.freezeDaysLimit === null) {
    return { ...base, included: true, quota: null, used: null, remaining: null, note: 'No limit' };
  }
  const remaining = Math.max(0, plan.freezeDaysLimit - usedDays);
  return {
    ...base,
    included: true,
    quota: plan.freezeDaysLimit,
    used: usedDays,
    remaining,
    note: remaining === 0 ? 'All used' : null,
  };
}

function gymAccessBenefit(plan: PlanBenefitsInput['plan'], branchNames: string[]): PlanBenefit {
  const base = { key: 'gym_access' as const, label: 'Gym access', included: true, quota: null, used: null, remaining: null, unit: null };
  if (plan.gymAccessAllBranches) return { ...base, note: 'All branches', items: [] };
  const names = [...new Set(branchNames.map((n) => n.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
  return {
    ...base,
    note: names.length === 0 ? 'Selected branches' : names.length === 1 ? '1 branch' : `${names.length} branches`,
    items: names,
  };
}

/** Always the same 7 benefits in the same order. */
export function buildPlanBenefits(input: PlanBenefitsInput): PlanBenefit[] {
  const { plan, usage, branchNames } = input;
  return [
    gymAccessBenefit(plan, branchNames),
    quotaBenefit('pt_sessions', 'Personal training', 'sessions', plan.ptSessionsIncluded, usage.ptSessions),
    quotaBenefit('group_classes', 'Group classes', 'classes', plan.groupClassesIncluded, usage.groupClasses),
    flag('diet_consultation', 'Diet consultation', plan.dietConsultationIncluded),
    flag('locker', 'Locker', plan.lockerAccess),
    quotaBenefit('guest_passes', 'Guest passes', 'passes', plan.guestPasses, usage.guestPasses),
    freezeBenefit(plan, usage.freezeDays),
  ];
}

/**
 * ACTIVE first, else the soonest-starting PENDING, else the most recently ended EXPIRED one — the same pick the
 * dashboard's membership tile uses. `rows` may be in any order.
 */
export function pickCurrentMembership<T extends { status: string; startDate: Date; endDate: Date }>(
  rows: T[],
): T | null {
  const byEndDesc = [...rows].sort((a, b) => b.endDate.getTime() - a.endDate.getTime());
  const active = byEndDesc.find((r) => r.status === 'ACTIVE');
  if (active) return active;
  const pending = byEndDesc
    .filter((r) => r.status === 'PENDING')
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];
  return pending ?? byEndDesc.find((r) => r.status === 'EXPIRED') ?? null;
}
