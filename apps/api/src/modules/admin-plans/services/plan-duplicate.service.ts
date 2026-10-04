import { Prisma } from '@prisma/client';

import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { prisma } from '../../../infrastructure/database/prisma';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';
import { nextCopySlug } from '../utils/plan-insights.util';

export class PlanDuplicateService {
  /** Creates an INACTIVE copy (features included) with a unique slug, ordered after the last plan. */
  async duplicate(
    id: string,
    input: { name?: string; slug?: string },
    adminUserId: string,
    adminRole: string,
  ) {
    const source = await prisma.subscriptionPlan.findUnique({
      where: { id },
      include: { features: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!source) throw new AppError(ErrorCode.NOT_FOUND, 'Plan not found', 404);

    let slug = input.slug;
    if (slug) {
      if (await prisma.subscriptionPlan.findUnique({ where: { slug }, select: { id: true } })) {
        throw new AppError(ErrorCode.CONFLICT, `A plan with slug "${slug}" already exists.`, 409);
      }
    } else {
      const taken = await prisma.subscriptionPlan.findMany({
        where: { slug: { startsWith: source.slug.slice(0, 20) } },
        select: { slug: true },
      });
      slug = nextCopySlug(source.slug, new Set(taken.map((p) => p.slug)));
    }
    const name = input.name ?? `${source.name} (Copy)`.slice(0, 80);
    const last = await prisma.subscriptionPlan.aggregate({ _max: { sortOrder: true } });

    let plan;
    try {
      plan = await prisma.subscriptionPlan.create({
        data: {
          slug,
          name,
          description: source.description,
          priceMonthly: source.priceMonthly,
          priceYearly: source.priceYearly,
          currency: source.currency,
          trialDays: source.trialDays,
          maxBranches: source.maxBranches,
          maxManagers: source.maxManagers,
          maxTrainers: source.maxTrainers,
          maxReceptionists: source.maxReceptionists,
          maxStaff: source.maxStaff,
          maxMembers: source.maxMembers,
          maxStorageMb: source.maxStorageMb,
          isActive: false,
          sortOrder: (last._max.sortOrder ?? 0) + 1,
          features: {
            create: source.features.map((f, index) => ({
              key: f.key,
              label: f.label,
              included: f.included,
              sortOrder: index,
            })),
          },
        },
        include: { features: { orderBy: { sortOrder: 'asc' } } },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(ErrorCode.CONFLICT, `A plan with slug "${slug}" already exists.`, 409);
      }
      throw error;
    }

    await adminAuditLogRepository.record({
      adminUserId,
      actorRole: adminRole,
      action: 'admin.plan_duplicated',
      entityType: 'SubscriptionPlan',
      entityId: plan.id,
      after: { sourcePlanId: source.id, sourceSlug: source.slug, slug: plan.slug, name: plan.name },
    });
    return plan;
  }
}

export const planDuplicateService = new PlanDuplicateService();
