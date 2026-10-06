import { env } from '../../../config/env';
import { eventBus } from '../../../core/events/event-bus';
import { logger } from '../../../core/logging/logger';
import { loadEmailBranding } from '../../../infrastructure/mail/branding';
import { buildInvitationEmail } from '../../authentication/events/auth-email.listeners';
import { sendGatedEmail } from '../../tenant-notifications/services/channel-gate.service';
import { tenantService } from '../../tenants/service/tenant.service';
import { InvitationEvents } from '../services/invitation.service';

/** Wires the invitation-created domain event to the (previously unused) invitation email template. */
export function registerInvitationEmailListeners(): void {
  eventBus.onEvent<{ tenantId: string; email: string; inviterName: string; roleLabel: string; token: string }>(
    InvitationEvents.Created,
    async (payload) => {
      const tenant = await tenantService.resolveById(payload.tenantId);
      if (!tenant) {
        logger.warn('Invitation email requested for unknown tenant', { tenantId: payload.tenantId });
        return;
      }
      const branding = await loadEmailBranding(payload.tenantId);
      const acceptUrl = `http://${tenant.slug}.${env.platformDomain}/invitation/${payload.token}`;
      const template = buildInvitationEmail(branding, payload.inviterName, payload.roleLabel, acceptUrl);
      await sendGatedEmail(payload.tenantId, { to: payload.email, subject: template.subject, html: template.html });
    },
  );
}
