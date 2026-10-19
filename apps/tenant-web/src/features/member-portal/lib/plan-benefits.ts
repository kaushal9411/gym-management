import type { PortalTone } from '../components/kit/tones';
import type { MemberPlan, MemberPlanBenefit, MemberPlanBenefitKey } from '../services/member-portal.service';

/** Accent tone per benefit (theme tokens only - follows tenant branding / dark mode). */
export const BENEFIT_TONE: Record<MemberPlanBenefitKey, PortalTone> = {
  gym_access: 'primary',
  pt_sessions: 'violet',
  group_classes: 'info',
  diet_consultation: 'success',
  locker: 'warning',
  guest_passes: 'orange',
  freeze: 'info',
};

/** "1 session" / "3 sessions" - the server sends the plural unit. */
export function unitLabel(unit: string | null, n: number): string {
  if (!unit) return '';
  return n === 1 && unit.endsWith('s') ? unit.slice(0, -1) : unit;
}

/** A benefit with a numeric allowance AND usage (what gets a progress bar). */
export function hasQuota(b: MemberPlanBenefit): b is MemberPlanBenefit & { quota: number; used: number; remaining: number } {
  return b.included && b.quota != null && b.used != null && b.remaining != null;
}

/** Share of the allowance still left, 0-100. */
export function remainingPercent(b: MemberPlanBenefit): number {
  if (!hasQuota(b) || b.quota <= 0) return 0;
  return Math.max(0, Math.min(100, (b.remaining / b.quota) * 100));
}

/** Bar tone: danger when everything is used, warning when a quarter or less is left, else the benefit's own tone. */
export function barTone(b: MemberPlanBenefit): PortalTone {
  if (!hasQuota(b)) return BENEFIT_TONE[b.key];
  if (b.remaining <= 0) return 'danger';
  return remainingPercent(b) <= 25 ? 'warning' : BENEFIT_TONE[b.key];
}

export function includedCount(plan: MemberPlan): number {
  return plan.benefits.filter((b) => b.included).length;
}

/** Share of the membership term still ahead, 0-100 (0 once expired). */
export function termRemainingPercent(plan: MemberPlan): number {
  if (plan.expired || plan.totalDays <= 0) return 0;
  return Math.max(0, Math.min(100, (plan.daysLeft / plan.totalDays) * 100));
}
