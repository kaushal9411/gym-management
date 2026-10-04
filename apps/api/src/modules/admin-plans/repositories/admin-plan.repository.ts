import { prisma } from '../../../infrastructure/database/prisma';

export interface PlanFeatureInput {
  key: string;
  label: string;
  included: boolean;
}

export interface UpsertPlanInput {
  slug: string;
  name: string;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  trialDays: number;
  maxBranches: number;
  maxManagers: number;
  maxTrainers: number;
  maxReceptionists: number;
  maxStaff: number;
  maxMembers: number;
  maxStorageMb: number;
  sortOrder: number;
  features: PlanFeatureInput[];
}

export class AdminPlanRepository {
  async list() {
    return prisma.subscriptionPlan.findMany({
      include: {
        features: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { subscriptions: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findById(id: string) {
    return prisma.subscriptionPlan.findUnique({
      where: { id },
      include: { features: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async create(input: UpsertPlanInput) {
    return prisma.subscriptionPlan.create({
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description,
        priceMonthly: input.priceMonthly,
        priceYearly: input.priceYearly,
        currency: input.currency,
        trialDays: input.trialDays,
        maxBranches: input.maxBranches,
        maxManagers: input.maxManagers,
        maxTrainers: input.maxTrainers,
        maxReceptionists: input.maxReceptionists,
        maxStaff: input.maxStaff,
        maxMembers: input.maxMembers,
        maxStorageMb: input.maxStorageMb,
        sortOrder: input.sortOrder,
        features: { create: input.features.map((f, index) => ({ ...f, sortOrder: index })) },
      },
      include: { features: true },
    });
  }

  async update(id: string, input: Partial<UpsertPlanInput>) {
    const { features, ...rest } = input;
    // Plan fields + feature replacement commit together (a failed createMany must not leave the plan feature-less).
    await prisma.$transaction(async (tx) => {
      await tx.subscriptionPlan.update({ where: { id }, data: rest });
      if (features) {
        await tx.subscriptionPlanFeature.deleteMany({ where: { planId: id } });
        await tx.subscriptionPlanFeature.createMany({
          data: features.map((f, index) => ({
            planId: id,
            key: f.key,
            label: f.label,
            included: f.included,
            sortOrder: index,
          })),
        });
      }
    });
    return this.findById(id);
  }

  async setActive(id: string, isActive: boolean) {
    return prisma.subscriptionPlan.update({ where: { id }, data: { isActive } });
  }

  async remove(id: string) {
    await prisma.subscriptionPlan.delete({ where: { id } });
  }

  async countActiveSubscriptions(id: string): Promise<number> {
    return prisma.subscription.count({
      where: { planId: id, status: { in: ['ACTIVE', 'TRIALING'] } },
    });
  }

  /** Subscription counts per status for a plan (every status, incl. terminal ones). */
  async subscriptionCountsByStatus(id: string): Promise<Record<string, number>> {
    const rows = await prisma.subscription.groupBy({
      by: ['status'],
      where: { planId: id },
      _count: { _all: true },
    });
    return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
  }

  /** Tenants currently on this plan — one Subscription row per tenant (upgrade/downgrade mutates the existing row's planId rather than inserting a new one, see `SubscriptionService.checkout()`), so this is genuinely "who's on this plan right now," not history. */
  async subscribers(planId: string, skip: number, take: number) {
    const where = { planId };
    const [total, items] = await Promise.all([
      prisma.subscription.count({ where }),
      prisma.subscription.findMany({
        where,
        include: { tenant: { select: { id: true, name: true, slug: true, status: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    return { total, items };
  }
}

export const adminPlanRepository = new AdminPlanRepository();
