import { env } from '../../../config/env';
import { eventBus } from '../../../core/events/event-bus';
import { logger } from '../../../core/logging/logger';
import { loadEmailBranding } from '../../../infrastructure/mail/branding';
import { memberPortalInviteEmail, otpCodeEmail, passwordResetEmail } from '../../../infrastructure/mail/templates/auth-templates';
import { enqueueEmail } from '../../../infrastructure/queue/email.queue';
import { enqueueSms } from '../../../infrastructure/queue/sms.queue';
import { toE164 } from '../../../infrastructure/sms/phone.util';
import { sendGatedEmail } from '../../tenant-notifications/services/channel-gate.service';
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
    const branding = await loadEmailBranding(payload.tenantId);
    const acceptUrl = portalUrl(tenant.slug, `/portal/activate/${payload.token}`);
    const template = memberPortalInviteEmail(branding, payload.name, acceptUrl);
    await sendGatedEmail(payload.tenantId, { to: payload.email, subject: template.subject, html: template.html });
  });

  eventBus.onEvent<{ tenantId: string; email: string; name: string; token: string }>(MemberAuthEvents.PasswordResetRequested, async (payload) => {
    const tenant = await tenantService.resolveById(payload.tenantId);
    if (!tenant) {
      logger.warn('Member portal password reset email requested for unknown tenant', { tenantId: payload.tenantId });
      return;
    }
    const branding = await loadEmailBranding(payload.tenantId);
    const resetUrl = portalUrl(tenant.slug, `/portal/reset-password?token=${payload.token}`);
    const template = passwordResetEmail(branding, payload.name, resetUrl);
    await enqueueEmail({ to: payload.email, subject: template.subject, html: template.html });
  });

  eventBus.onEvent<{ tenantId: string; memberId: string; name: string; email: string; phone?: string | null; code: string; expiresInMinutes: number }>(
    MemberAuthEvents.OtpIssued,
    async (payload) => {
      const branding = await loadEmailBranding(payload.tenantId);
      const template = otpCodeEmail(branding, payload.name, payload.code, payload.expiresInMinutes);
      await enqueueEmail({ to: payload.email, subject: template.subject, html: template.html });
      // Never gated by the tenant's SMS quota/toggle (same reasoning as the email leg above) — an OTP must always attempt to go out.
      if (payload.phone) {
        await enqueueSms({
          tenantId: payload.tenantId,
          to: toE164(payload.phone),
          body: `${branding.tenantName}: your verification code is ${payload.code}. Valid for ${payload.expiresInMinutes} minutes.`,
          skipDeliveryLog: true,
        });
      }
    },
  );
}
