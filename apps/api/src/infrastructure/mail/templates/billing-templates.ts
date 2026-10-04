import {
  actionButton,
  alertBox,
  detailRow,
  detailTable,
  escapeHtml,
  formatDate,
  keyFacts,
  paragraph,
  renderEmailLayout,
  sectionTitle,
  signature,
  statusBadge,
  stepList,
  strong,
  toneAccent,
  type EmailBranding,
} from './base-layout';

export function subscriptionActivatedEmail(
  branding: EmailBranding,
  ownerName: string,
  planName: string,
  action: string,
  opts?: { invoiceNumber?: string; total?: string; billingUrl?: string },
) {
  const verb = { CREATED: 'activated', UPGRADED: 'upgraded', DOWNGRADED: 'changed', RENEWED: 'renewed' }[action] ?? 'updated';
  const Verb = `${verb.charAt(0).toUpperCase()}${verb.slice(1)}`;
  return {
    subject: `Your ${planName} subscription is ${verb}`,
    html: renderEmailLayout(
      branding,
      {
        icon: '✨',
        title: `Subscription ${verb}`,
        subtitle: `${branding.tenantName} is on the ${planName} plan.`,
        categoryLabel: 'Subscription',
        tone: 'success',
        preheader: `Your subscription is now ${verb} — ${planName}.`,
      },
      `${paragraph(`Hi ${escapeHtml(ownerName)}, the FitCloud subscription for ${strong(branding.tenantName)} has been ${escapeHtml(verb)}. Everything included in your plan is available right now.`)}
       ${keyFacts([
         { icon: '🏷️', label: 'Plan', value: planName },
         { icon: '✅', label: 'Status', value: 'Active', color: '#15803d' },
         ...(opts?.total ? [{ icon: '💰', label: 'Charged', value: opts.total }] : []),
       ])}
       ${detailTable(
         detailRow('🔄', 'Change', Verb) +
           (opts?.invoiceNumber ? detailRow('📄', 'Invoice', escapeHtml(opts.invoiceNumber)) : '') +
           detailRow('📌', 'Status', statusBadge('Active', 'success')),
       )}
       ${opts?.billingUrl ? actionButton(opts.billingUrl, 'View billing', branding.primaryColor) : ''}
       ${sectionTitle('What happens next')}
       ${stepList([{ title: 'Your plan’s features are available now', body: 'No further action is needed.' }, { title: 'Your invoice is in your billing page', body: 'Download it any time under Billing.' }, { title: 'We’ll email you before renewal', body: 'You’ll get a reminder ahead of the next billing date.' }])}
       ${signature(branding, 'Thank you,')}`,
    ),
  };
}

export function invoiceEmail(branding: EmailBranding, ownerName: string, invoiceNumber: string, total: string, downloadUrl: string) {
  return {
    subject: `Invoice ${invoiceNumber}`,
    html: renderEmailLayout(
      branding,
      {
        icon: '🧾',
        title: 'Your invoice is ready',
        subtitle: `Invoice ${invoiceNumber}`,
        categoryLabel: 'Billing',
        preheader: `Invoice ${invoiceNumber} — total ${total}.`,
        footerHint: 'preferences',
      },
      `${paragraph(`Hi ${escapeHtml(ownerName)}, here’s the latest FitCloud invoice for ${strong(branding.tenantName)}.`)}
       ${detailTable(
         detailRow('🏢', 'Billed to', escapeHtml(branding.tenantName)) +
           detailRow('📄', 'Invoice number', escapeHtml(invoiceNumber)) +
           detailRow('💰', 'Total', escapeHtml(total), { emphasize: true, color: toneAccent(branding) }),
       )}
       ${actionButton(downloadUrl, 'View & download invoice', branding.primaryColor)}
       ${sectionTitle('What happens next')}
       ${stepList([{ title: 'Open the invoice', body: 'View or download it from your billing page.' }, { title: 'Keep it for your records', body: 'Every invoice stays available under Billing in your portal.' }])}
       ${signature(branding)}`,
    ),
  };
}

export function subscriptionExpiredEmail(branding: EmailBranding, ownerName: string, opts?: { billingUrl?: string }) {
  return {
    subject: 'Your FitCloud subscription has expired',
    html: renderEmailLayout(
      branding,
      {
        icon: '⏸️',
        title: 'Subscription expired',
        subtitle: 'Renew any time to restore access.',
        categoryLabel: 'Subscription',
        tone: 'danger',
        preheader: 'Your subscription has expired — renew to restore access.',
      },
      `${paragraph(`Hi ${escapeHtml(ownerName)}, the FitCloud subscription for ${strong(branding.tenantName)} has expired after an extended grace period, so portal access is paused.`)}
       ${alertBox('info', 'Your data is safe', 'Members, invoices and settings are preserved. They’ll be right where you left them as soon as you renew.')}
       ${sectionTitle('To get back up and running')}
       ${stepList([{ title: 'Open the billing page' }, { title: 'Choose a plan and complete payment' }, { title: 'Sign in — access is restored straight away' }], branding.primaryColor)}
       ${opts?.billingUrl ? actionButton(opts.billingUrl, 'Renew subscription', branding.primaryColor) : ''}
       ${signature(branding, 'Thanks,')}`,
    ),
  };
}

export function gracePeriodReminderEmail(
  branding: EmailBranding,
  ownerName: string,
  daysRemaining: number,
  opts?: { billingUrl?: string; graceEndsAt?: string },
) {
  const dayLabel = `${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`;
  return {
    subject: `Action needed — ${dayLabel} left before suspension`,
    html: renderEmailLayout(
      branding,
      {
        icon: '⚠️',
        title: 'Grace period active',
        subtitle: `${dayLabel} left to fix billing.`,
        categoryLabel: 'Billing',
        tone: 'warning',
        preheader: `${dayLabel} left to update billing before suspension.`,
      },
      `${paragraph(`Hi ${escapeHtml(ownerName)}, we couldn’t process the last payment for ${strong(branding.tenantName)}. Your account is still fully active during the grace period, but it will be suspended when it ends.`)}
       ${keyFacts([
         { icon: '⏱️', label: 'Time left', value: dayLabel, color: '#b45309' },
         ...(opts?.graceEndsAt ? [{ icon: '📅', label: 'Suspension on', value: formatDate(opts.graceEndsAt) }] : []),
       ])}
       ${alertBox('warning', 'What to do', 'Update your payment details so we can retry the charge automatically.')}
       ${opts?.billingUrl ? actionButton(opts.billingUrl, 'Update billing details', branding.primaryColor) : ''}
       ${signature(branding, 'Thanks,')}`,
    ),
  };
}
