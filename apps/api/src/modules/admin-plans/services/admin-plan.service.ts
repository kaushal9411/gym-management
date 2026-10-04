import { Prisma } from '@prisma/client';

import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';
import { adminPlanRepository, type UpsertPlanInput } from '../repositories/admin-plan.repository';
import { deleteBlockers } from '../utils/plan-insights.util';

export class AdminPlanService {
  async list() {
    return adminPlanRepository.list();
  }

  async getById(id: string) {
    const plan = await adminPlanRepository.findById(id);
    if (!plan) throw new AppError(ErrorCode.NOT_FOUND, 'Plan not found', 404);
    return plan;
  }

  async create(input: UpsertPlanInput, adminUserId: string, adminRole: string) {
    const plan = await adminPlanRepository.create(input);
    await adminAuditLogRepository.record({
      adminUserId,
      actorRole: adminRole,
      action: 'admin.plan_created',
      entityType: 'SubscriptionPlan',
      entityId: plan.id,
      after: input,
    });
    return plan;
  }

  async update(
    id: string,
    input: Partial<UpsertPlanInput>,
    adminUserId: string,
    adminRole: string,
  ) {
    await this.getById(id);
    const plan = await adminPlanRepository.update(id, input);
    await adminAuditLogRepository.record({
      adminUserId,
      actorRole: adminRole,
      action: 'admin.plan_updated',
      entityType: 'SubscriptionPlan',
      entityId: id,
      after: input,
    });
    return plan;
  }

  async setActive(id: string, isActive: boolean, adminUserId: string, adminRole: string) {
    await this.getById(id);
    const plan = await adminPlanRepository.setActive(id, isActive);
    await adminAuditLogRepository.record({
      adminUserId,
      actorRole: adminRole,
      action: isActive ? 'admin.plan_enabled' : 'admin.plan_disabled',
      entityType: 'SubscriptionPlan',
      entityId: id,
    });
    return plan;
  }

  async subscribers(id: string, page: number, limit: number) {
    await this.getById(id);
    const skip = (page - 1) * limit;
    const { total, items } = await adminPlanRepository.subscribers(id, skip, limit);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async remove(id: string, adminUserId: string, adminRole: string): Promise<void> {
    await this.getById(id);
    const counts = await adminPlanRepository.subscriptionCountsByStatus(id);
    const blockers = deleteBlockers(counts);
    if (blockers.blocked) {
      throw new AppError(ErrorCode.CONFLICT, blockers.message, 409, {
        subscriptionsByStatus: counts,
      });
    }
    try {
      await adminPlanRepository.remove(id);
    } catch (error) {
      // Subscription.plan is onDelete: Restrict — a SUSPENDED/CANCELED/EXPIRED row (or a race) still references the plan.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2003' || error.code === 'P2014')
      ) {
        const fresh = await adminPlanRepository.subscriptionCountsByStatus(id);
        const detail = Object.entries(fresh)
          .map(([status, n]) => `${status}: ${n}`)
          .join(', ');
        throw new AppError(
          ErrorCode.CONFLICT,
          `Cannot delete a plan that still has subscription records (${detail || 'unknown'}). Disable it instead.`,
          409,
          { subscriptionsByStatus: fresh },
        );
      }
      throw error;
    }
    await adminAuditLogRepository.record({
      adminUserId,
      actorRole: adminRole,
      action: 'admin.plan_deleted',
      entityType: 'SubscriptionPlan',
      entityId: id,
    });
  }
}

export const adminPlanService = new AdminPlanService();
