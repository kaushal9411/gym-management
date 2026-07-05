import { actionButton, renderEmailLayout, type EmailBranding } from './base-layout';

export function subscriptionActivatedEmail(branding: EmailBranding, ownerName: string, planName: string, action: string) {
  const verb = { CREATED: 'activated', UPGRADED: 'upgraded', DOWNGRADED: 'changed', RENEWED: 'renewed' }[action] ?? 'updated';
  return {
    subject: `Your ${planName} subscription is ${verb}`,
    html: renderEmailLayout(
      branding,
      `<h1 style="font-size:20px;margin:0 0 12px;">Subscription ${verb}</h1>
       <p>Hi ${ownerName}, your ${branding.tenantName} subscription has been ${verb} to the <strong>${planName}</strong> plan.</p>`,
    ),
  };
}

export function invoiceEmail(branding: EmailBranding, ownerName: string, invoiceNumber: string, total: string, downloadUrl: string) {
  return {
    subject: `Invoice ${invoiceNumber}`,
    html: renderEmailLayout(
      branding,
      `<h1 style="font-size:20px;margin:0 0 12px;">Invoice ${invoiceNumber}</h1>
       <p>Hi ${ownerName}, here's your invoice for ${branding.tenantName} — total <strong>${total}</strong>.</p>
       ${actionButton(downloadUrl, 'Download invoice', branding.primaryColor)}`,
    ),
  };
}

export function subscriptionExpiredEmail(branding: EmailBranding, ownerName: string) {
  return {
    subject: 'Your FitCloud subscription has expired',
    html: renderEmailLayout(
      branding,
      `<h1 style="font-size:20px;margin:0 0 12px;">Subscription expired</h1>
       <p>Hi ${ownerName}, ${branding.tenantName}'s FitCloud subscription has expired after an extended grace period. Renew any time to restore access.</p>`,
    ),
  };
}

export function gracePeriodReminderEmail(branding: EmailBranding, ownerName: string, daysRemaining: number) {
  return {
    subject: `Action needed — ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left before suspension`,
    html: renderEmailLayout(
      branding,
      `<h1 style="font-size:20px;margin:0 0 12px;">Your account is in a grace period</h1>
       <p>Hi ${ownerName}, we couldn't process your last payment for ${branding.tenantName}. You have <strong>${daysRemaining} day${daysRemaining === 1 ? '' : 's'}</strong> left to update your billing details before your account is suspended.</p>`,
    ),
  };
}
