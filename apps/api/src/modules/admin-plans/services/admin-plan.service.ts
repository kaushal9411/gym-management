import { AppError, ConflictError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';
import { adminPlanRepository, type UpsertPlanInput } from '../repositories/admin-plan.repository';

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
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.plan_created', entityType: 'SubscriptionPlan', entityId: plan.id, after: input });
    return plan;
  }

  async update(id: string, input: Partial<UpsertPlanInput>, adminUserId: string, adminRole: string) {
    await this.getById(id);
    const plan = await adminPlanRepository.update(id, input);
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.plan_updated', entityType: 'SubscriptionPlan', entityId: id, after: input });
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

  async remove(id: string, adminUserId: string, adminRole: string): Promise<void> {
    await this.getById(id);
    const activeCount = await adminPlanRepository.countActiveSubscriptions(id);
    if (activeCount > 0) {
      throw new ConflictError(ErrorCode.CONFLICT, `Cannot delete a plan with ${activeCount} active subscription(s). Disable it instead.`);
    }
    await adminPlanRepository.remove(id);
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.plan_deleted', entityType: 'SubscriptionPlan', entityId: id });
  }
}

export const adminPlanService = new AdminPlanService();
