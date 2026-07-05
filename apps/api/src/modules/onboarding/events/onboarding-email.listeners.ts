import { eventBus } from '../../../core/events/event-bus';
import { otpCodeEmail } from '../../../infrastructure/mail/templates/auth-templates';
import { onboardingWelcomeEmail } from '../../../infrastructure/mail/templates/onboarding-templates';
import { enqueueEmail } from '../../../infrastructure/queue/email.queue';

const PLATFORM_BRANDING = { tenantName: 'FitCloud' };

/**
 * Onboarding's own event listeners — separate from
 * authentication/events/auth-email.listeners.ts because the semantics
 * differ: these fire BEFORE any tenant/user exists (the OTP email) or
 * carry onboarding-specific copy (welcome + trial info, no verify link —
 * the wizard's OTP step already proved email ownership).
 */
export function registerOnboardingEmailListeners(): void {
  eventBus.onEvent<{ email: string; code: string; expiresInMinutes: number }>(
    'onboarding.otp_issued',
    async (payload) => {
      const template = otpCodeEmail(PLATFORM_BRANDING, 'there', payload.code, payload.expiresInMinutes);
      await enqueueEmail({ to: payload.email, subject: template.subject, html: template.html });
    },
  );

  eventBus.onEvent<{
    tenantSlug: string;
    email: string;
    name: string;
    gymName: string;
    planName: string;
    isTrial: boolean;
    trialEndsAt: string | null;
    portalUrl: string;
  }>('onboarding.tenant_provisioned', async (payload) => {
    const branding = { tenantName: payload.gymName };
    const template = onboardingWelcomeEmail(
      branding,
      payload.name,
      payload.planName,
      payload.isTrial,
      payload.trialEndsAt,
      payload.portalUrl,
    );
    await enqueueEmail({ to: payload.email, subject: template.subject, html: template.html });
  });
}
