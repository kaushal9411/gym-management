export type CouponType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'TRIAL_EXTENSION';
export type CouponScope = 'ONE_TIME' | 'RECURRING' | 'REFERRAL';

export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  scope: CouponScope;
  percentOff: string | null;
  amountOff: string | null;
  currency: string | null;
  trialExtensionDays: number | null;
  maxRedemptions: number | null;
  maxRedemptionsPerTenant: number;
  timesRedeemed: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { redemptions: number };
  /** Added by the list/detail endpoints (insights). */
  computed?: CouponComputed;
}

export type CouponStatus = 'active' | 'disabled' | 'expired' | 'exhausted' | 'scheduled';

export interface CouponComputed {
  status: CouponStatus;
  /** CouponRedemption rows (can drift from `timesRedeemed`, which is what validate enforces). */
  redemptions: number;
  remaining: number | null;
  usagePct: number | null;
  discountGiven: string;
  lastRedeemedAt: string | null;
}

export interface UpsertCouponInput {
  code: string;
  type: CouponType;
  scope: CouponScope;
  percentOff?: number;
  amountOff?: number;
  currency?: string;
  trialExtensionDays?: number;
  maxRedemptions?: number;
  maxRedemptionsPerTenant: number;
  expiresAt?: string;
  isActive: boolean;
}
