import type { MembershipPlan } from '../types';

export interface PlanPriceBreakdown {
  basePrice: number;
  discountPercentage: number;
  discountAmount: number;
  taxPercentage: number;
  taxAmount: number;
  /** `(basePrice − discountAmount) + taxAmount` — discount applied before tax. */
  finalPrice: number;
  joiningFee: number;
  /** `finalPrice + joiningFee` — the full amount a plan on its own bills to, before any member-level registration fee or manual discount. */
  totalWithJoiningFee: number;
}

/** Discount-then-tax, applied to a plan's own `price`/`discountPercentage`/`taxPercentage`/`joiningFee` — see BACKEND-GUIDE.md §Membership Plan Pricing. */
export function computePlanPrice(plan: Pick<MembershipPlan, 'price' | 'discountPercentage' | 'taxPercentage' | 'joiningFee'>): PlanPriceBreakdown {
  const basePrice = Number(plan.price) || 0;
  const discountPercentage = Number(plan.discountPercentage) || 0;
  const taxPercentage = Number(plan.taxPercentage) || 0;
  const joiningFee = Number(plan.joiningFee) || 0;

  const discountAmount = (basePrice * discountPercentage) / 100;
  const taxable = basePrice - discountAmount;
  const taxAmount = (taxable * taxPercentage) / 100;
  const finalPrice = taxable + taxAmount;

  return {
    basePrice,
    discountPercentage,
    discountAmount,
    taxPercentage,
    taxAmount,
    finalPrice,
    joiningFee,
    totalWithJoiningFee: finalPrice + joiningFee,
  };
}
