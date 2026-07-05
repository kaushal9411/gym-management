import { actionButton, renderEmailLayout, type EmailBranding } from './base-layout';

export function onboardingWelcomeEmail(
  branding: EmailBranding,
  ownerName: string,
  planName: string,
  isTrial: boolean,
  trialEndsAt: string | null,
  portalUrl: string,
) {
  const trialLine = isTrial && trialEndsAt
    ? `<p>Your <strong>${planName}</strong> free trial runs until <strong>${new Date(trialEndsAt).toLocaleDateString()}</strong> — no charge until then.</p>`
    : `<p>You're on the <strong>${planName}</strong> plan.</p>`;

  return {
    subject: `${branding.tenantName} is ready on FitCloud!`,
    html: renderEmailLayout(
      branding,
      `<h1 style="font-size:20px;margin:0 0 12px;">Welcome, ${ownerName}!</h1>
       <p>Your gym portal has been created and is ready to use right now.</p>
       ${trialLine}
       ${actionButton(portalUrl, 'Go to your portal', branding.primaryColor)}
       <p style="margin-top:20px;font-size:13px;color:#6b7280;">Your portal: <a href="${portalUrl}">${portalUrl}</a><br/>Sign in with the email and password you just created.</p>`,
    ),
  };
}

export function paymentSuccessEmail(branding: EmailBranding, ownerName: string, amount: string, planName: string) {
  return {
    subject: 'Payment received — thank you!',
    html: renderEmailLayout(
      branding,
      `<h1 style="font-size:20px;margin:0 0 12px;">Payment received</h1>
       <p>Hi ${ownerName}, we've received your payment of <strong>${amount}</strong> for the <strong>${planName}</strong> plan.</p>
       <p style="margin-top:20px;font-size:13px;color:#6b7280;">A receipt has been generated for your records.</p>`,
    ),
  };
}
