import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { prisma } from '../../../infrastructure/database/prisma';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';

export class AdminFeatureFlagService {
  async list() {
    return prisma.featureFlag.findMany({ orderBy: [{ category: 'asc' }, { label: 'asc' }] });
  }

  async setEnabled(key: string, enabled: boolean, adminUserId: string, adminRole: string) {
    const flag = await prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) throw new AppError(ErrorCode.NOT_FOUND, 'Feature flag not found', 404);

    const updated = await prisma.featureFlag.update({ where: { key }, data: { enabled } });
    await adminAuditLogRepository.record({
      adminUserId,
      actorRole: adminRole,
      action: enabled ? 'admin.feature_flag_enabled' : 'admin.feature_flag_disabled',
      entityType: 'FeatureFlag',
      entityId: key,
    });
    return updated;
  }
}

export const adminFeatureFlagService = new AdminFeatureFlagService();
