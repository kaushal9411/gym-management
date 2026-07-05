import { env } from '../../../config/env';
import { AuthEvents, eventBus } from '../../../core/events/event-bus';
import { logger } from '../../../core/logging/logger';
import {
  invitationEmail as buildInvitationEmail,
  otpCodeEmail,
  passwordChangedEmail,
  passwordResetEmail,
  verifyEmailEmail,
  welcomeEmail,
} from '../../../infrastructure/mail/templates/auth-templates';
import type { EmailBranding } from '../../../infrastructure/mail/templates/base-layout';
import { enqueueEmail } from '../../../infrastructure/queue/email.queue';
import { tenantService } from '../../tenants/service/tenant.service';

/** Public tenant-web URL a given tenant's links should point at. */
function portalUrl(tenantSlug: string, path: string): string {
  return `http://${tenantSlug}.${env.platformDomain}${path}`;
}

/** Real per-tenant branding for emails, resolved by id and cached (see TenantService). */
async function brandingFor(tenantId: string): Promise<{ branding: EmailBranding; slug: string }> {
  const tenant = await tenantService.resolveById(tenantId);
  if (!tenant) {
    logger.warn('Email branding requested for unknown tenant — using platform defaults', { tenantId });
    return { branding: { tenantName: 'FitCloud' }, slug: '' };
  }
  return {
    branding: { tenantName: tenant.name, primaryColor: tenant.branding.primaryColor, logoUrl: tenant.branding.logoUrl },
    slug: tenant.slug,
  };
}

/**
 * Wires AuthService's domain events to actual email sends, entirely
 * decoupled from the service that raised them (see core/events/event-bus.ts
 * for why this is an in-process bus rather than the full transactional
 * outbox described in the architecture doc).
 */
export function registerAuthEmailListeners(): void {
  eventBus.onEvent<{
    tenantId: string;
    tenantSlug: string;
    userId: string;
    name: string;
    email: string;
    verificationToken: string;
    isResend?: boolean;
  }>(AuthEvents.UserRegistered, async (payload) => {
    // tenantSlug is already known at registration time (fresher than any cache read).
    const branding: EmailBranding = { tenantName: payload.tenantSlug || 'FitCloud' };
    const verifyUrl = portalUrl(payload.tenantSlug, `/verify-email?token=${payload.verificationToken}`);
    const template = payload.isResend
      ? verifyEmailEmail(branding, payload.name, verifyUrl)
      : welcomeEmail(branding, payload.name, verifyUrl);
    await enqueueEmail({ to: payload.email, subject: template.subject, html: template.html });
  });

  eventBus.onEvent<{ tenantId: string; userId: string; name: string; email: string; resetToken: string }>(
    AuthEvents.PasswordResetRequested,
    async (payload) => {
      const { branding, slug } = await brandingFor(payload.tenantId);
      const resetUrl = portalUrl(slug, `/reset-password?token=${payload.resetToken}`);
      const template = passwordResetEmail(branding, payload.name, resetUrl);
      await enqueueEmail({ to: payload.email, subject: template.subject, html: template.html });
    },
  );

  eventBus.onEvent<{ tenantId: string; userId: string; name: string; email: string }>(
    AuthEvents.PasswordChanged,
    async (payload) => {
      const { branding } = await brandingFor(payload.tenantId);
      const template = passwordChangedEmail(branding, payload.name);
      await enqueueEmail({ to: payload.email, subject: template.subject, html: template.html });
    },
  );

  eventBus.onEvent<{
    tenantId: string;
    userId: string;
    name: string;
    email: string;
    code: string;
    expiresInMinutes: number;
  }>('auth.otp_issued', async (payload) => {
    const { branding } = await brandingFor(payload.tenantId);
    const template = otpCodeEmail(branding, payload.name, payload.code, payload.expiresInMinutes);
    await enqueueEmail({ to: payload.email, subject: template.subject, html: template.html });
  });
}

/** Exported for the (future) staff-invitation module to reuse without duplicating template wiring. */
export { buildInvitationEmail };
