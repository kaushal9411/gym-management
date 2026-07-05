import type { CouponScope, CouponType } from '@prisma/client';

import { prisma } from '../../../infrastructure/database/prisma';

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
  expiresAt?: Date | null;
  isActive: boolean;
}

export class AdminCouponRepository {
  async list() {
    return prisma.coupon.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { redemptions: true } } } });
  }

  async findById(id: string) {
    return prisma.coupon.findUnique({ where: { id }, include: { redemptions: { orderBy: { redeemedAt: 'desc' }, take: 50, include: { tenant: { select: { name: true, slug: true } } } } } });
  }

  async create(input: UpsertCouponInput) {
    return prisma.coupon.create({ data: { ...input, code: input.code.toUpperCase() } });
  }

  async update(id: string, input: Partial<UpsertCouponInput>) {
    return prisma.coupon.update({ where: { id }, data: input.code ? { ...input, code: input.code.toUpperCase() } : input });
  }

  async remove(id: string): Promise<void> {
    await prisma.coupon.delete({ where: { id } });
  }
}

export const adminCouponRepository = new AdminCouponRepository();
