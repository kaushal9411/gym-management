import { env } from '../../../config/env';
import { eventBus } from '../../../core/events/event-bus';
import { logger } from '../../../core/logging/logger';
import type { EmailBranding } from '../../../infrastructure/mail/templates/base-layout';
import { enqueueEmail } from '../../../infrastructure/queue/email.queue';
import { buildInvitationEmail } from '../../authentication/events/auth-email.listeners';
import { tenantService } from '../../tenants/service/tenant.service';
import { StaffEvents } from '../services/staff.service';

/**
 * Staff "activation" reuses the exact invitation email template (Prompt 11)
 * — same "you're invited, set your password" copy — but the accept link
 * points at `/staff-activation/{token}`, a token minted from the
 * PasswordReset table against an ALREADY-CREATED user row (unlike the
 * generic Users/Invitations flow, which creates the user only on accept).
 * This lets Create Staff collect the full profile up front while still
 * requiring the staff member to set their own password before logging in.
 */
export function registerStaffEmailListeners(): void {
  eventBus.onEvent<{ tenantId: string; email: string; invitedByName: string; roleLabel: string; token: string }>(
    StaffEvents.ActivationRequested,
    async (payload) => {
      const tenant = await tenantService.resolveById(payload.tenantId);
      if (!tenant) {
        logger.warn('Staff activation email requested for unknown tenant', { tenantId: payload.tenantId });
        return;
      }
      const branding: EmailBranding = {
        tenantName: tenant.name,
        primaryColor: tenant.branding.primaryColor,
        logoUrl: tenant.branding.logoUrl,
      };
      const acceptUrl = `http://${tenant.slug}.${env.platformDomain}/staff-activation/${payload.token}`;
      const template = buildInvitationEmail(branding, payload.invitedByName, payload.roleLabel, acceptUrl);
      await enqueueEmail({ to: payload.email, subject: template.subject, html: template.html });
    },
  );
}
