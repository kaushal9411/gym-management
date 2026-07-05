import { prisma } from '../../../infrastructure/database/prisma';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';

/**
 * "Company Information, SMTP, SMS Gateway, Payment Gateway Keys, Storage
 * Provider, Cloudflare, AWS, Redis, Queue Settings, Maintenance Mode" — all
 * modeled as one key-value table (`system_settings`), grouped by
 * `category`, rather than one column-per-setting migration each time a new
 * integration needs a config slot.
 */
export class AdminSettingsService {
  async list(category?: string) {
    return prisma.systemSetting.findMany({ where: category ? { category } : {}, orderBy: [{ category: 'asc' }, { key: 'asc' }] });
  }

  async get(key: string) {
    return prisma.systemSetting.findUnique({ where: { key } });
  }

  async upsert(key: string, category: string, value: unknown, adminUserId: string, adminRole: string) {
    const setting = await prisma.systemSetting.upsert({
      where: { key },
      create: { key, category, value: value as object },
      update: { value: value as object, category },
    });
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.system_setting_updated', entityType: 'SystemSetting', entityId: key });
    return setting;
  }
}

export const adminSettingsService = new AdminSettingsService();
