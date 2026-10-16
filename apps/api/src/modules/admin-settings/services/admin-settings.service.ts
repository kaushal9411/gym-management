import { ValidationError } from '../../../core/errors/app-error';
import { cache } from '../../../infrastructure/cache/redis';
import { prisma } from '../../../infrastructure/database/prisma';
import { adminAuditLogRepository } from '../../admin-audit/repositories/admin-audit-log.repository';

import { PLATFORM_IDENTITY_SETTING_KEY, PLATFORM_NAME_CACHE_KEY } from './platform-config.service';

/** `platform_identity`'s value shape is the one key-value pair worth a dedicated check — everything else is intentionally free-form JSON. */
function validatePlatformIdentity(value: unknown): void {
  const appName = (value as { appName?: unknown } | null)?.appName;
  if (typeof appName !== 'string' || !appName.trim() || appName.trim().length > 60) {
    throw new ValidationError('appName must be a non-empty string of at most 60 characters', { key: PLATFORM_IDENTITY_SETTING_KEY });
  }
}

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
    if (key === PLATFORM_IDENTITY_SETTING_KEY) validatePlatformIdentity(value);

    const setting = await prisma.systemSetting.upsert({
      where: { key },
      create: { key, category, value: value as object },
      update: { value: value as object, category },
    });
    if (key === PLATFORM_IDENTITY_SETTING_KEY) await cache.del(PLATFORM_NAME_CACHE_KEY);
    await adminAuditLogRepository.record({ adminUserId, actorRole: adminRole, action: 'admin.system_setting_updated', entityType: 'SystemSetting', entityId: key });
    return setting;
  }
}

export const adminSettingsService = new AdminSettingsService();
