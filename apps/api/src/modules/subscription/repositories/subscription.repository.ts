import type { SubscriptionHistoryAction, SubscriptionStatus } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';

export class SubscriptionRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async findCurrent(tenantId: string) {
    return this.db.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { plan: { include: { features: { orderBy: { sortOrder: 'asc' } } } }, coupon: true },
    });
  }

  async update(
    subscriptionId: string,
    data: Partial<{
      planId: string;
      couponId: string | null;
      status: SubscriptionStatus;
      billingCycle: 'MONTHLY' | 'YEARLY';
      currentPeriodStart: Date;
      currentPeriodEnd: Date | null;
      cancelAtPeriodEnd: boolean;
      graceEndsAt: Date | null;
      suspendedAt: Date | null;
      cancelledAt: Date | null;
      cancelReason: string | null;
      trialEndsAt: Date | null;
      gatewayProvider: string | null;
      gatewaySubscriptionId: string | null;
    }>,
  ) {
    return this.db.subscription.update({ where: { id: subscriptionId }, data });
  }

  async recordHistory(input: {
    tenantId: string;
    subscriptionId: string;
    fromPlanId: string | null;
    toPlanId: string | null;
    fromStatus: SubscriptionStatus | null;
    toStatus: SubscriptionStatus;
    action: SubscriptionHistoryAction;
    note?: string;
  }) {
    return this.db.subscriptionHistory.create({ data: input });
  }

  async listHistory(tenantId: string, subscriptionId: string) {
    return this.db.subscriptionHistory.findMany({
      where: { tenantId, subscriptionId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
