import { prisma } from '../../../infrastructure/database/prisma';

/**
 * `coupons` is a global, tenant-agnostic catalog (same treatment as
 * `subscription_plans`) — reads/writes go through the raw client. Only
 * `coupon_redemptions` (see coupon-redemption.repository.ts) is
 * tenant-scoped and RLS-protected.
 */
export class CouponRepository {
  async findByCode(code: string) {
    return prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
  }

  async incrementRedemptionCount(couponId: string): Promise<void> {
    await prisma.coupon.update({ where: { id: couponId }, data: { timesRedeemed: { increment: 1 } } });
  }
}

export const couponRepository = new CouponRepository();
