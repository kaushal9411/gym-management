import { cache } from '../../../infrastructure/cache/redis';
import { prisma } from '../../../infrastructure/database/prisma';
import type { EmailBranding } from '../../../infrastructure/mail/templates/base-layout';

export const PLATFORM_IDENTITY_SETTING_KEY = 'platform_identity';
export const PLATFORM_NAME_CACHE_KEY = 'platform:identity:app-name';
const PLATFORM_NAME_CACHE_TTL_SECONDS = 30;
const DEFAULT_PLATFORM_NAME = 'FitCloud';
export const COMPANY_INFO_SETTING_KEY = 'company_info';
export const COMPANY_INFO_CACHE_KEY = 'platform:company-info';

export interface CompanyInfo {
  name: string | null;
  supportEmail: string | null;
  website: string | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * The super-admin "Company Information" setting (`company_info`: name / supportEmail / website). The support email is shown in the footer of
 * every platform-originated email; cached briefly and invalidated on write by `admin-settings.service`.
 */
export async function getCompanyInfo(): Promise<CompanyInfo> {
  const cached = await cache.get<CompanyInfo>(COMPANY_INFO_CACHE_KEY);
  if (cached) return cached;
  let info: CompanyInfo = { name: null, supportEmail: null, website: null };
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: COMPANY_INFO_SETTING_KEY } });
    const v = (row?.value ?? {}) as Record<string, unknown>;
    const email = clean(v.supportEmail);
    info = { name: clean(v.name), supportEmail: email && EMAIL_PATTERN.test(email) ? email : null, website: clean(v.website) };
  } catch {
    return info;
  }
  await cache.set(COMPANY_INFO_CACHE_KEY, info, PLATFORM_NAME_CACHE_TTL_SECONDS);
  return info;
}

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
  const [appName, company] = await Promise.all([getPlatformName(), getCompanyInfo()]);
  return { tenantName: appName, isPlatform: true, platformName: appName, ...(company.supportEmail ? { supportEmail: company.supportEmail } : {}) };
}
