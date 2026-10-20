import type { MemberProfile } from '../repositories/audience.repository';

/** "26 Oct 2026" - dates are stored as UTC-midnight DATE values. */
export function formatDay(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

/** INR only: "₹1,500" (whole rupees without decimals, otherwise two). */
export function formatRupees(amount: number): string {
  const whole = Math.abs(amount - Math.round(amount)) < 0.005;
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** Per-member values for the campaign placeholder set (+ old-style aliases the legacy notification templates use). */
export function buildMemberVars(member: Pick<MemberProfile, 'firstName' | 'lastName' | 'memberCode' | 'planName' | 'endDate' | 'amountDue'>, gymName: string): Record<string, string> {
  const fullName = `${member.firstName} ${member.lastName}`.trim();
  const amountDue = formatRupees(member.amountDue);
  return {
    firstName: member.firstName,
    lastName: member.lastName,
    memberCode: member.memberCode,
    planName: member.planName ?? 'your plan',
    endDate: member.endDate ? formatDay(member.endDate) : 'your renewal date',
    amountDue,
    gymName,
    // aliases used by the pre-existing NotificationTemplate texts
    memberName: fullName,
    tenantName: gymName,
    amount: amountDue,
  };
}
