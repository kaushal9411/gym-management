import { logger } from '../../core/logging/logger';
import { getPlatformBranding, getPlatformName } from '../../modules/admin-settings/services/platform-config.service';
import { tenantService } from '../../modules/tenants/service/tenant.service';
import { prisma } from '../database/prisma';


import type { EmailBranding } from './templates/base-layout';

/**
 * Real per-tenant email branding: name, brand colour, logo (from the cached tenant record) plus the gym's own
 * contact email/phone from TenantProfile when it has been filled in. Falls back to the platform's own branding
 * for an unknown tenant; a failed profile lookup only drops the contact lines. `platformName` is set even for a
 * real tenant — some copy ("is ready on <platform>!", "Powered by <platform>") refers to the SaaS, not the gym.
 */
export async function loadEmailBranding(tenantId: string): Promise<EmailBranding> {
  const tenant = await tenantService.resolveById(tenantId);
  if (!tenant) return getPlatformBranding();
  let supportEmail: string | undefined;
  let supportPhone: string | undefined;
  try {
    const profile = await prisma.tenantProfile.findUnique({ where: { tenantId }, select: { email: true, phone: true } });
    supportEmail = profile?.email ?? undefined;
    supportPhone = profile?.phone ?? undefined;
  } catch (error) {
    logger.warn('Could not load tenant contact details for email', { tenantId, error: error instanceof Error ? error.message : String(error) });
  }
  return {
    tenantName: tenant.name,
    platformName: await getPlatformName(),
    primaryColor: tenant.branding.primaryColor,
    logoUrl: tenant.branding.emailLogoUrl ?? tenant.branding.logoUrl,
    supportEmail,
    supportPhone,
  };
}
