import {
  actionButton,
  alertBox,
  checklist,
  detailRow,
  detailTable,
  escapeHtml,
  formatDate,
  iconStrip,
  keyFacts,
  paragraph,
  renderEmailLayout,
  secondaryLink,
  sectionTitle,
  signature,
  statusBadge,
  stepList,
  strong,
  toneAccent,
  type EmailBranding,
} from './base-layout';

export function onboardingWelcomeEmail(
  branding: EmailBranding,
  ownerName: string,
  planName: string,
  isTrial: boolean,
  trialEndsAt: string | null,
  portalUrl: string,
) {
  const trialEnd = isTrial && trialEndsAt ? formatDate(trialEndsAt) : null;
  return {
    subject: `${branding.tenantName} is ready on FitCloud!`,
    html: renderEmailLayout(
      branding,
      {
        icon: '🎉',
        title: `Welcome, ${ownerName}!`,
        subtitle: `${branding.tenantName} is live and ready to use.`,
        categoryLabel: 'Welcome',
        preheader: `${branding.tenantName} is ready — sign in to get started.`,
      },
      `${paragraph(`Your gym portal for ${strong(branding.tenantName)} has been created and is ready right now. Sign in with the email and password you just set.`)}
       ${keyFacts([
         { icon: '🏷️', label: 'Plan', value: planName },
         trialEnd ? { icon: '🎁', label: 'Free trial until', value: trialEnd } : { icon: '✅', label: 'Status', value: 'Active', color: '#15803d' },
       ])}
       ${actionButton(portalUrl, 'Go to your portal', branding.primaryColor)}
       ${secondaryLink(portalUrl, 'Your portal')}
       ${trialEnd ? alertBox('info', 'No charge during your trial', `You won’t be billed until ${escapeHtml(trialEnd)}. Pick a plan any time from the billing page.`) : ''}
       ${sectionTitle('Get set up in 10 minutes')}
       ${stepList(
         [
           { title: 'Add your branches', body: 'Locations, opening hours and contact details.' },
           { title: 'Create membership plans', body: 'Prices, durations and what’s included.' },
           { title: 'Add staff and trainers', body: 'Invite your team with the right roles.' },
           { title: 'Enrol your first members', body: 'Start collecting attendance and payments.' },
         ],
         branding.primaryColor,
       )}
       ${sectionTitle('Checklist')}
       ${checklist([{ label: 'Create your gym account', done: true }, { label: 'Add a branch' }, { label: 'Create a membership plan' }, { label: 'Add your first member' }])}
       ${iconStrip([
         { icon: '📋', label: 'Manage members' },
         { icon: '💳', label: 'Track billing' },
         { icon: '📈', label: 'Grow your gym' },
       ])}
       ${signature(branding, 'Happy training,')}`,
    ),
  };
}

export function paymentSuccessEmail(
  branding: EmailBranding,
  ownerName: string,
  amount: string,
  planName: string,
  opts?: { billingUrl?: string },
) {
  return {
    subject: 'Payment received — thank you!',
    html: renderEmailLayout(
      branding,
      {
        icon: '✅',
        title: 'Payment successful',
        subtitle: `${amount} received for the ${planName} plan.`,
        categoryLabel: 'Payment',
        tone: 'success',
        preheader: `Payment of ${amount} received for the ${planName} plan.`,
      },
      `${paragraph(`Hi ${escapeHtml(ownerName)}, we’ve received your payment for ${strong(branding.tenantName)}. Thank you for staying with us!`)}
       ${detailTable(
         detailRow('💰', 'Amount paid', escapeHtml(amount), { emphasize: true, color: toneAccent(branding, 'success') }) +
           detailRow('🏷️', 'Plan', escapeHtml(planName)) +
           detailRow('📌', 'Status', statusBadge('Paid', 'success')),
       )}
       ${opts?.billingUrl ? actionButton(opts.billingUrl, 'View billing', branding.primaryColor) : ''}
       ${sectionTitle('What happens next')}
       ${stepList([{ title: 'Your subscription continues without interruption' }, { title: 'The receipt is available in your billing page' }])}
       ${signature(branding, 'Thank you,')}`,
    ),
  };
}
