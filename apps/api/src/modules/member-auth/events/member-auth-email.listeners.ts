import { env } from '../../../config/env';
import { eventBus } from '../../../core/events/event-bus';
import { logger } from '../../../core/logging/logger';
import { memberPortalInviteEmail, passwordResetEmail } from '../../../infrastructure/mail/templates/auth-templates';
import type { EmailBranding } from '../../../infrastructure/mail/templates/base-layout';
import { enqueueEmail } from '../../../infrastructure/queue/email.queue';
import { tenantService } from '../../tenants/service/tenant.service';
import { MemberAuthEvents } from '../services/member-auth.service';

/** Member-portal links point at `/portal/*`, not `/staff-activation`/`/reset-password` — those are the staff plane's paths. */
function portalUrl(tenantSlug: string, path: string): string {
  return `http://${tenantSlug}.${env.platformDomain}${path}`;
}

export function registerMemberAuthEmailListeners(): void {
  eventBus.onEvent<{ tenantId: string; email: string; name: string; token: string }>(MemberAuthEvents.ActivationRequested, async (payload) => {
    const tenant = await tenantService.resolveById(payload.tenantId);
    if (!tenant) {
      logger.warn('Member portal activation email requested for unknown tenant', { tenantId: payload.tenantId });
      return;
    }
    const branding: EmailBranding = { tenantName: tenant.name, primaryColor: tenant.branding.primaryColor, logoUrl: tenant.branding.emailLogoUrl ?? tenant.branding.logoUrl };
    const acceptUrl = portalUrl(tenant.slug, `/portal/activate/${payload.token}`);
    const template = memberPortalInviteEmail(branding, payload.name, acceptUrl);
    await enqueueEmail({ to: payload.email, subject: template.subject, html: template.html });
  });

  eventBus.onEvent<{ tenantId: string; email: string; name: string; token: string }>(MemberAuthEvents.PasswordResetRequested, async (payload) => {
    const tenant = await tenantService.resolveById(payload.tenantId);
    if (!tenant) {
      logger.warn('Member portal password reset email requested for unknown tenant', { tenantId: payload.tenantId });
      return;
    }
    const branding: EmailBranding = { tenantName: tenant.name, primaryColor: tenant.branding.primaryColor, logoUrl: tenant.branding.emailLogoUrl ?? tenant.branding.logoUrl };
    const resetUrl = portalUrl(tenant.slug, `/portal/reset-password?token=${payload.token}`);
    const template = passwordResetEmail(branding, payload.name, resetUrl);
    await enqueueEmail({ to: payload.email, subject: template.subject, html: template.html });
  });
}
