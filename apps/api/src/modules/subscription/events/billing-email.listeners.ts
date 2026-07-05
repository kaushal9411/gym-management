import { env } from '../../../config/env';
import { eventBus } from '../../../core/events/event-bus';
import { prisma } from '../../../infrastructure/database/prisma';
import { subscriptionAlertEmail } from '../../../infrastructure/mail/templates/auth-templates';
import { invoiceEmail, subscriptionActivatedEmail } from '../../../infrastructure/mail/templates/billing-templates';
import { enqueueEmail } from '../../../infrastructure/queue/email.queue';
import { tenantNotificationService } from '../../tenant-notifications/services/tenant-notification.service';

function portalPath(tenantSlug: string, path: string): string {
  return `http://${tenantSlug}.${env.platformDomain}${path}`;
}

/**
 * Fires alongside authentication/onboarding's own listeners — kept
 * separate because these are billing-specific events (checkout, webhook
 * outcomes) rather than identity/onboarding ones.
 */
export function registerBillingEmailListeners(): void {
  eventBus.onEvent<{
    tenantId: string;
    tenantName: string;
    email: string;
    planName: string;
    action: string;
    invoiceNumber: string;
    invoiceId: string;
    total: number;
    currency: string;
  }>('billing.subscription_activated', async (payload) => {
    const branding = { tenantName: payload.tenantName };
    const activated = subscriptionActivatedEmail(branding, 'there', payload.planName, payload.action);
    await enqueueEmail({ to: payload.email, subject: activated.subject, html: activated.html });

    const tenant = await prisma.tenant.findUnique({ where: { id: payload.tenantId } });
    const downloadUrl = tenant ? portalPath(tenant.slug, `/billing/invoices/${payload.invoiceId}`) : '#';
    const totalFormatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: payload.currency }).format(payload.total);
    const invoice = invoiceEmail(branding, 'there', payload.invoiceNumber, totalFormatted, downloadUrl);
    await enqueueEmail({ to: payload.email, subject: invoice.subject, html: invoice.html });

    await tenantNotificationService.notifyTenant(payload.tenantId, 'SUBSCRIPTION', activated.subject, `Your subscription is now on the ${payload.planName} plan.`);
  });

  eventBus.onEvent<{ tenantId: string; paymentId: string }>('billing.payment_failed', async (payload) => {
    const tenant = await prisma.tenant.findUnique({ where: { id: payload.tenantId } });
    if (!tenant) return;
    const owner = await prisma.user.findFirst({ where: { tenantId: payload.tenantId }, orderBy: { createdAt: 'asc' } });
    if (!owner) return;

    const template = subscriptionAlertEmail({ tenantName: tenant.name }, owner.name, 'payment_failed');
    await enqueueEmail({ to: owner.email, subject: template.subject, html: template.html });

    await tenantNotificationService.notifyTenant(payload.tenantId, 'SUBSCRIPTION', template.subject, 'We could not process your last payment. Please update your billing details.');
  });
}
