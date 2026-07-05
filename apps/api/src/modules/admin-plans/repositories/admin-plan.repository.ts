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
      include: { features: { orderBy: { sortOrder: 'asc' } }, _count: { select: { subscriptions: true } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findById(id: string) {
    return prisma.subscriptionPlan.findUnique({ where: { id }, include: { features: { orderBy: { sortOrder: 'asc' } } } });
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
    await prisma.subscriptionPlan.update({ where: { id }, data: rest });

    if (features) {
      await prisma.subscriptionPlanFeature.deleteMany({ where: { planId: id } });
      await prisma.subscriptionPlanFeature.createMany({
        data: features.map((f, index) => ({ planId: id, key: f.key, label: f.label, included: f.included, sortOrder: index })),
      });
    }
    return this.findById(id);
  }

  async setActive(id: string, isActive: boolean) {
    return prisma.subscriptionPlan.update({ where: { id }, data: { isActive } });
  }

  async remove(id: string) {
    await prisma.subscriptionPlan.delete({ where: { id } });
  }

  async countActiveSubscriptions(id: string): Promise<number> {
    return prisma.subscription.count({ where: { planId: id, status: { in: ['ACTIVE', 'TRIALING'] } } });
  }
}

export const adminPlanRepository = new AdminPlanRepository();
