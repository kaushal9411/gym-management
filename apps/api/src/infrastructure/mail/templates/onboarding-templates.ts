import { actionButton, detailRow, detailTable, footnote, iconStrip, renderEmailLayout, secondaryLink, type EmailBranding } from './base-layout';

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
      { icon: '🎉', title: `Welcome, ${ownerName}!`, categoryLabel: 'Welcome', preheader: `${branding.tenantName} is ready — sign in to get started.` },
      `<p>Your gym portal has been created and is ready to use right now.</p>
       ${trialLine}
       ${actionButton(portalUrl, 'Go to your portal', branding.primaryColor)}
       ${secondaryLink(portalUrl, 'Your portal')}
       ${iconStrip([
         { icon: '📋', label: 'Manage members' },
         { icon: '💳', label: 'Track billing' },
         { icon: '📈', label: 'Grow your gym' },
       ])}
       ${footnote('Sign in with the email and password you just created.')}`,
    ),
  };
}

export function paymentSuccessEmail(branding: EmailBranding, ownerName: string, amount: string, planName: string) {
  return {
    subject: 'Payment received — thank you!',
    html: renderEmailLayout(
      branding,
      { icon: '✅', title: 'Payment Successful!', categoryLabel: 'Payment', tone: 'success', preheader: `Payment of ${amount} received for the ${planName} plan.` },
      `<p>Hi ${ownerName}, we've received your payment for ${branding.tenantName}. Thank you for continuing your journey with us!</p>
       ${detailTable(detailRow('💰', 'Amount paid', amount, { emphasize: true }) + detailRow('🏷️', 'Plan', planName))}
       ${footnote('A receipt has been generated for your records.')}`,
    ),
  };
}
