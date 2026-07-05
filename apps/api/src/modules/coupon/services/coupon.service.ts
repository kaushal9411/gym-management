import type { Coupon } from '@prisma/client';

import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { CouponRedemptionRepository } from '../repositories/coupon-redemption.repository';
import { couponRepository } from '../repositories/coupon.repository';

export interface CouponValidationResult {
  code: string;
  type: Coupon['type'];
  scope: Coupon['scope'];
  discountAmount: number;
  trialExtensionDays: number;
  finalAmount: number;
}

export class CouponService {
  private readonly redemptionRepository: CouponRedemptionRepository;

  constructor(db: TenantScopedPrisma) {
    this.redemptionRepository = new CouponRedemptionRepository(db);
  }

  /** Read-only check — does NOT consume a redemption. Call `redeem` only after payment succeeds. */
  async validate(code: string, tenantId: string, amount: number): Promise<CouponValidationResult> {
    const coupon = await this.assertUsable(code, tenantId);
    return this.priceWith(coupon, amount);
  }

  /** Called once, immediately after a successful checkout charge — records the redemption and bumps counters. */
  async redeem(code: string, tenantId: string): Promise<Coupon> {
    const coupon = await this.assertUsable(code, tenantId);
    await this.redemptionRepository.create(tenantId, coupon.id);
    await couponRepository.incrementRedemptionCount(coupon.id);
    return coupon;
  }

  /** Re-applies a RECURRING coupon's discount at renewal time — ONE_TIME/REFERRAL coupons only ever apply once. */
  priceWith(coupon: Coupon, amount: number): CouponValidationResult {
    let discountAmount = 0;
    if (coupon.type === 'PERCENTAGE' && coupon.percentOff) {
      discountAmount = Math.round(amount * (Number(coupon.percentOff) / 100) * 100) / 100;
    } else if (coupon.type === 'FIXED_AMOUNT' && coupon.amountOff) {
      discountAmount = Math.min(Number(coupon.amountOff), amount);
    }

    return {
      code: coupon.code,
      type: coupon.type,
      scope: coupon.scope,
      discountAmount,
      trialExtensionDays: coupon.type === 'TRIAL_EXTENSION' ? (coupon.trialExtensionDays ?? 0) : 0,
      finalAmount: Math.max(amount - discountAmount, 0),
    };
  }

  private async assertUsable(code: string, tenantId: string): Promise<Coupon> {
    const coupon = await couponRepository.findByCode(code);
    if (!coupon || !coupon.isActive) {
      throw new AppError(ErrorCode.COUPON_INVALID, 'This coupon code is not valid.', 422);
    }
    if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
      throw new AppError(ErrorCode.COUPON_INVALID, 'This coupon code has expired.', 422);
    }
    if (coupon.maxRedemptions !== null && coupon.timesRedeemed >= coupon.maxRedemptions) {
      throw new AppError(ErrorCode.COUPON_INVALID, 'This coupon has reached its redemption limit.', 422);
    }

    const tenantRedemptions = await this.redemptionRepository.countForTenant(tenantId, coupon.id);
    if (tenantRedemptions >= coupon.maxRedemptionsPerTenant) {
      throw new AppError(ErrorCode.COUPON_INVALID, 'This coupon has already been used on this account.', 422);
    }

    return coupon;
  }
}
