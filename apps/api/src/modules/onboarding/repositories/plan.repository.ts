import { prisma } from '../../../infrastructure/database/prisma';

/**
 * Plans are a global, tenant-agnostic catalog (seeded once — see
 * prisma/seed.ts) — reads go through the raw client, same rationale as
 * `permissions`. There is no write path here: plan management is a
 * super-admin capability outside this onboarding-only scope.
 */
export class PlanRepository {
  async listActive() {
    return prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { features: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async findBySlug(slug: string) {
    return prisma.subscriptionPlan.findUnique({
      where: { slug },
      include: { features: { orderBy: { sortOrder: 'asc' } } },
    });
  }
}

export const planRepository = new PlanRepository();
