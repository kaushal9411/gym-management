import { actionButton, detailRow, detailTable, infoBox, renderEmailLayout, statusBadge, toneAccent, type EmailBranding } from './base-layout';

export function subscriptionActivatedEmail(branding: EmailBranding, ownerName: string, planName: string, action: string) {
  const verb = { CREATED: 'activated', UPGRADED: 'upgraded', DOWNGRADED: 'changed', RENEWED: 'renewed' }[action] ?? 'updated';
  return {
    subject: `Your ${planName} subscription is ${verb}`,
    html: renderEmailLayout(
      branding,
      { icon: '✨', title: `Subscription ${verb.charAt(0).toUpperCase()}${verb.slice(1)}`, categoryLabel: 'Subscription', tone: 'success', preheader: `Your subscription is now ${verb} to ${planName}.` },
      `<p>Hi ${ownerName}, your ${branding.tenantName} subscription has been ${verb} to the <strong>${planName}</strong> plan.</p>
       ${detailTable(detailRow('🏷️', 'Plan', planName, { emphasize: true }) + detailRow('✅', 'Status', statusBadge('Active', 'success')))}`,
    ),
  };
}

export function invoiceEmail(branding: EmailBranding, ownerName: string, invoiceNumber: string, total: string, downloadUrl: string) {
  return {
    subject: `Invoice ${invoiceNumber}`,
    html: renderEmailLayout(
      branding,
      { icon: '🧾', title: 'Your Invoice is Ready', categoryLabel: 'Billing', preheader: `Invoice ${invoiceNumber} — total ${total}.` },
      `<p>Hi ${ownerName}, here's your latest invoice for ${branding.tenantName}.</p>
       ${detailTable(detailRow('📄', 'Invoice number', invoiceNumber) + detailRow('💰', 'Total', total, { emphasize: true }))}
       ${actionButton(downloadUrl, 'Download invoice', branding.primaryColor)}`,
    ),
  };
}

export function subscriptionExpiredEmail(branding: EmailBranding, ownerName: string) {
  return {
    subject: 'Your FitCloud subscription has expired',
    html: renderEmailLayout(
      branding,
      { icon: '⏸️', title: 'Subscription Expired', categoryLabel: 'Subscription', tone: 'danger', preheader: 'Your subscription has expired — renew to restore access.' },
      infoBox(`<p style="margin:0;">Hi ${ownerName}, ${branding.tenantName}'s FitCloud subscription has expired after an extended grace period. Renew any time to restore access.</p>`, toneAccent(branding, 'danger')),
    ),
  };
}

export function gracePeriodReminderEmail(branding: EmailBranding, ownerName: string, daysRemaining: number) {
  const dayLabel = `${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`;
  return {
    subject: `Action needed — ${dayLabel} left before suspension`,
    html: renderEmailLayout(
      branding,
      { icon: '⚠️', title: 'Grace Period Active', categoryLabel: 'Billing', tone: 'warning', preheader: `${dayLabel} left to update billing before suspension.` },
      infoBox(`<p style="margin:0;">Hi ${ownerName}, we couldn't process your last payment for ${branding.tenantName}. You have <strong>${dayLabel}</strong> left to update your billing details before your account is suspended.</p>`, toneAccent(branding, 'warning')),
    ),
  };
}
