/**
 * Server-side port of `apps/tenant-web/src/features/members/utils/plan-pricing.ts#computePlanPrice`
 * (discount-then-tax, documented in BACKEND-GUIDE.md §Membership Plan Pricing). That frontend
 * version is fine for a STAFF-trusted flow (the Add Member wizard) where the client only ever
 * displays the number before a staff member manually records the payment — nothing here is
 * charged automatically. Member self-service renewal is different: the member is an external,
 * untrusted actor paying for themselves, so the amount a Razorpay Order is created for must be
 * computed HERE, server-side, never accepted from the client. Deliberately excludes
 * `joiningFee` — a renewal never re-charges the registration fee (same as `MemberService`'s
 * existing `priceAtAssignment: plan.price` behavior on both `assignMembership` and `renewMembership`).
 */
export interface MembershipPriceBreakdown {
  basePrice: number;
  discountPercentage: number;
  discountAmount: number;
  taxPercentage: number;
  taxAmount: number;
  /** `(basePrice − discountAmount) + taxAmount` — discount applied before tax. */
  finalPrice: number;
}

export function computeFinalMembershipPrice(plan: { price: unknown; discountPercentage: unknown; taxPercentage: unknown }): MembershipPriceBreakdown {
  const basePrice = Number(plan.price) || 0;
  const discountPercentage = Number(plan.discountPercentage) || 0;
  const taxPercentage = Number(plan.taxPercentage) || 0;

  const discountAmount = (basePrice * discountPercentage) / 100;
  const taxable = basePrice - discountAmount;
  const taxAmount = (taxable * taxPercentage) / 100;
  const finalPrice = Math.max(taxable + taxAmount, 0);

  return { basePrice, discountPercentage, discountAmount, taxPercentage, taxAmount, finalPrice };
}
