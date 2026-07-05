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
