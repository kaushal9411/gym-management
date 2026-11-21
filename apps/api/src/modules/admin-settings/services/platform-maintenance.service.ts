import { cache } from '../../../infrastructure/cache/redis';
import { prisma } from '../../../infrastructure/database/prisma';

export const PLATFORM_MAINTENANCE_SETTING_KEY = 'maintenance_mode';
export const PLATFORM_MAINTENANCE_CACHE_KEY = 'platform:maintenance';
const CACHE_TTL_SECONDS = 15;

export interface PlatformMaintenance {
  enabled: boolean;
  message: string | null;
}

const OFF: PlatformMaintenance = { enabled: false, message: null };

/**
 * The platform-wide Maintenance Mode switch from the super admin Settings page
 * (`system_settings.maintenance_mode` = `{ enabled, message }`). While on, every
 * gym portal answers 503 MAINTENANCE exactly as if that gym's own per-tenant
 * toggle were on; the super admin API is unaffected so it can be switched off.
 * Cached briefly (reads happen on every tenant request); `admin-settings.service`
 * invalidates it on write.
 */
export async function getPlatformMaintenance(): Promise<PlatformMaintenance> {
  const cached = await cache.get<PlatformMaintenance>(PLATFORM_MAINTENANCE_CACHE_KEY);
  if (cached) return cached;

  let result = OFF;
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: PLATFORM_MAINTENANCE_SETTING_KEY } });
    const value = row?.value as { enabled?: unknown; message?: unknown } | null;
    if (value?.enabled === true) {
      const message = typeof value.message === 'string' ? value.message.trim() : '';
      result = { enabled: true, message: message || null };
    }
  } catch {
    // Never take the platform down because the switch could not be read.
    return OFF;
  }
  await cache.set(PLATFORM_MAINTENANCE_CACHE_KEY, result, CACHE_TTL_SECONDS);
  return result;
}
