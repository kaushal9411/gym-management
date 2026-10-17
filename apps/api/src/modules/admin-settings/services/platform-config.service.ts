import { cache } from '../../../infrastructure/cache/redis';
import { prisma } from '../../../infrastructure/database/prisma';
import type { EmailBranding } from '../../../infrastructure/mail/templates/base-layout';

export const PLATFORM_IDENTITY_SETTING_KEY = 'platform_identity';
export const PLATFORM_NAME_CACHE_KEY = 'platform:identity:app-name';
const PLATFORM_NAME_CACHE_TTL_SECONDS = 30;
const DEFAULT_PLATFORM_NAME = 'FitCloud';

/**
 * The super-admin-configurable product name, shown everywhere there's no
 * specific tenant to brand as (and alongside tenant branding where the
 * SaaS itself still needs naming — e.g. "Powered by <platform>"). Cached
 * briefly since this is read on nearly every page load/email send and
 * changes rarely; `admin-settings.service.ts` invalidates it on write.
 */
export async function getPlatformName(): Promise<string> {
  const cached = await cache.get<string>(PLATFORM_NAME_CACHE_KEY);
  if (cached) return cached;

  const setting = await prisma.systemSetting.findUnique({ where: { key: PLATFORM_IDENTITY_SETTING_KEY } });
  const value = setting?.value as { appName?: unknown } | null;
  const appName = typeof value?.appName === 'string' && value.appName.trim() ? value.appName.trim() : DEFAULT_PLATFORM_NAME;

  await cache.set(PLATFORM_NAME_CACHE_KEY, appName, PLATFORM_NAME_CACHE_TTL_SECONDS);
  return appName;
}

/** Platform-originated `EmailBranding` (no tenant to brand as) — the single source every mail call site should use instead of its own hardcoded fallback. */
export async function getPlatformBranding(): Promise<EmailBranding> {
  const appName = await getPlatformName();
  return { tenantName: appName, isPlatform: true, platformName: appName };
}
