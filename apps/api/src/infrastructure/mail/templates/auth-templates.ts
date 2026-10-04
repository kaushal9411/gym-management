import {
  actionButton,
  alertBox,
  codeBlock,
  detailRow,
  detailTable,
  escapeHtml,
  footnote,
  formatDate,
  paragraph,
  renderEmailLayout,
  secondaryLink,
  sectionTitle,
  signature,
  stepList,
  strong,
  toneAccent,
  type EmailBranding,
  type HeroTone,
} from './base-layout';

const hi = (name: string) => `Hi ${escapeHtml(name)},`;

export function welcomeEmail(branding: EmailBranding, ownerName: string, verifyUrl: string) {
  return {
    subject: `Welcome to ${branding.tenantName} on FitCloud`,
    html: renderEmailLayout(
      branding,
      {
        icon: '🎉',
        title: `Welcome, ${ownerName}!`,
        subtitle: `${branding.tenantName} is almost ready to go.`,
        categoryLabel: 'Welcome',
        preheader: `Verify your email to activate ${branding.tenantName} and start your free trial.`,
      },
      `${paragraph(`${hi(ownerName)} your gym ${strong(branding.tenantName)} has been created on FitCloud. One quick step left: confirm your email address to activate the account and start your 14-day free trial (full access, no card charged until it ends).`)}
       ${actionButton(verifyUrl, 'Verify email address', branding.primaryColor)}
       ${secondaryLink(verifyUrl, 'Or paste this link into your browser')}
       ${sectionTitle('What happens next')}
       ${stepList(
         [
           { title: 'Verify your email', body: 'Click the button above to activate your account.' },
           { title: 'Sign in to your portal', body: 'Use the email and password you just created.' },
           { title: 'Set up your gym', body: 'Add your branches, plans and first members.' },
         ],
         branding.primaryColor,
       )}
       ${alertBox('info', 'Link expires in 24 hours', 'If it expires you can request a fresh verification email from the sign-in page.')}
       ${signature(branding)}
       ${footnote('Didn’t create this account? You can safely ignore this email — nothing will be activated.')}`,
    ),
  };
}

export function verifyEmailEmail(branding: EmailBranding, name: string, verifyUrl: string) {
  return {
    subject: 'Verify your email address',
    html: renderEmailLayout(
      branding,
      {
        icon: '✉️',
        title: 'Verify your email',
        subtitle: 'Confirm it’s really you to activate your account.',
        categoryLabel: 'Account Security',
        preheader: 'Confirm your email address to activate your account.',
        footerHint: 'security',
      },
      `${paragraph(`${hi(name)} please confirm your email address to activate your ${strong(branding.tenantName)} account.`)}
       ${actionButton(verifyUrl, 'Verify email address', branding.primaryColor)}
       ${secondaryLink(verifyUrl, 'Or paste this link into your browser')}
       ${sectionTitle('Details')}
       ${detailTable(detailRow('', 'Account', escapeHtml(name)) + detailRow('', 'Gym', escapeHtml(branding.tenantName)) + detailRow('', 'Link valid for', '24 hours'))}
       ${sectionTitle('What happens next')}
       ${stepList([{ title: 'Click “Verify email address”', body: 'Your account is activated immediately.' }, { title: 'Sign in', body: 'Use your email and password as usual.' }])}
       ${alertBox('info', 'Link expired?', 'Request a new verification email from the sign-in page.')}
       ${alertBox('warning', 'Didn’t create this account?', 'Ignore this email — nothing is activated unless the link is used.')}
       ${signature(branding)}`,
    ),
  };
}

export function passwordResetEmail(branding: EmailBranding, name: string, resetUrl: string, opts?: { byAdmin?: boolean }) {
  const lead = opts?.byAdmin
    ? `a FitCloud administrator started a password reset for your ${strong(branding.tenantName)} account. Choose a new password using the button below.`
    : `we received a request to reset the password for your ${strong(branding.tenantName)} account. Click below to choose a new one.`;
  return {
    subject: 'Reset your password',
    html: renderEmailLayout(
      branding,
      {
        icon: '🔒',
        title: 'Reset your password',
        subtitle: 'This link works once and expires in 30 minutes.',
        categoryLabel: 'Account Security',
        tone: 'warning',
        preheader: 'Reset your password — this link expires in 30 minutes.',
        footerHint: 'security',
      },
      `${paragraph(`${hi(name)} ${lead}`)}
       ${actionButton(resetUrl, 'Reset password', branding.primaryColor)}
       ${secondaryLink(resetUrl, 'Or paste this link into your browser')}
       ${alertBox('warning', 'Didn’t request this?', 'Ignore this email — your password stays exactly as it is. If you keep getting these, tell your gym owner.')}
       ${sectionTitle('Details')}
       ${detailTable(detailRow('', 'Account', escapeHtml(name)) + detailRow('', 'Gym', escapeHtml(branding.tenantName)) + detailRow('', 'Requested by', opts?.byAdmin ? 'A FitCloud administrator' : 'You (via “Forgot password”)') + detailRow('', 'Link valid for', '30 minutes'))}
       ${sectionTitle('What happens next')}
       ${stepList([{ title: 'Click “Reset password”', body: 'The link opens a page where you choose a new password.' }, { title: 'Choose a strong, unique password', body: 'Use a long passphrase you don’t use anywhere else.' }, { title: 'Sign in with the new password', body: 'Other devices are signed out once the password is changed.' }])}
       ${sectionTitle('Security tips')}
       ${stepList([{ title: 'Never share this link or your password with anyone' }, { title: 'Staff will never ask for your password' }])}
       ${signature(branding)}`,
    ),
  };
}

export function passwordChangedEmail(branding: EmailBranding, name: string) {
  return {
    subject: 'Your password was changed',
    html: renderEmailLayout(
      branding,
      {
        icon: '✅',
        title: 'Password changed',
        subtitle: 'Your account is secured with the new password.',
        categoryLabel: 'Account Security',
        tone: 'success',
        preheader: 'Your password was just changed.',
        footerHint: 'security',
      },
      `${paragraph(`${hi(name)} this confirms the password for your ${strong(branding.tenantName)} account was just changed. For your safety, every other signed-in device has been signed out.`)}
       ${detailTable(detailRow('🔐', 'Account', escapeHtml(branding.tenantName)) + detailRow('📱', 'Other devices', 'Signed out'))}
       ${sectionTitle('What happens next')}
       ${stepList([{ title: 'Use the new password the next time you sign in' }, { title: 'Sign in again on any other device you use', body: 'They were signed out for your safety.' }])}
       ${alertBox('danger', 'Wasn’t you?', 'Contact your gym owner immediately and reset your password again — someone else may have access to your account.')}
       ${signature(branding)}`,
    ),
  };
}

export function otpCodeEmail(branding: EmailBranding, name: string, code: string, expiresInMinutes: number) {
  return {
    subject: `Your verification code: ${code}`,
    html: renderEmailLayout(
      branding,
      {
        icon: '🔑',
        title: 'Your verification code',
        subtitle: `Valid for ${expiresInMinutes} minutes.`,
        categoryLabel: 'Verification',
        preheader: `Your verification code is ${code}.`,
        footerHint: 'security',
      },
      `${paragraph(`${hi(name)} enter this code to continue with ${strong(branding.tenantName)}:`)}
       ${codeBlock(code, branding.primaryColor)}
       <p class="fc-muted" style="margin:0 0 16px;text-align:center;font-size:13.5px;color:#667085;">Expires in <strong>${escapeHtml(expiresInMinutes)} minutes</strong> &middot; can be used once.</p>
       ${detailTable(detailRow('', 'Sent to', escapeHtml(name)) + detailRow('', 'For', escapeHtml(branding.tenantName)) + detailRow('', 'Valid for', `${escapeHtml(expiresInMinutes)} minutes`))}
       ${sectionTitle('What happens next')}
       ${stepList([{ title: 'Return to the page where you asked for the code' }, { title: 'Type the code exactly as shown', body: 'Request a new one if it has expired.' }])}
       ${alertBox('warning', 'Keep this code private', 'No one from FitCloud or the gym will ask you for it. If you didn’t request it, you can ignore this email.')}
       ${signature(branding)}`,
    ),
  };
}

export function invitationEmail(branding: EmailBranding, inviterName: string, roleLabel: string, acceptUrl: string) {
  return {
    subject: `You're invited to join ${branding.tenantName}`,
    html: renderEmailLayout(
      branding,
      {
        icon: '👋',
        title: 'You’re invited!',
        subtitle: `${inviterName} wants you on the ${branding.tenantName} team.`,
        categoryLabel: 'Team Invite',
        preheader: `${inviterName} invited you to join ${branding.tenantName} as ${roleLabel}.`,
      },
      `${paragraph(`${strong(inviterName)} invited you to join ${strong(branding.tenantName)} on FitCloud. Accept to set your password and sign in.`)}
       ${detailTable(
         detailRow('🏢', 'Gym', escapeHtml(branding.tenantName)) +
           detailRow('🪪', 'Your role', escapeHtml(roleLabel), { emphasize: true, color: toneAccent(branding) }) +
           detailRow('👤', 'Invited by', escapeHtml(inviterName)) +
           detailRow('⏳', 'Invitation valid for', '48 hours'),
       )}
       ${actionButton(acceptUrl, 'Accept invitation', branding.primaryColor)}
       ${secondaryLink(acceptUrl, 'Or paste this link into your browser')}
       ${sectionTitle('How it works')}
       ${stepList(
         [
           { title: 'Open the invitation', body: 'Use the button above.' },
           { title: 'Create your password', body: 'You’ll use it with this email address to sign in.' },
           { title: 'Start working', body: `You’ll land in ${branding.tenantName}’s dashboard with your ${roleLabel} access.` },
         ],
         branding.primaryColor,
       )}
       ${footnote('If you weren’t expecting this invitation, ignore this email — no account is created until you accept.')}`,
    ),
  };
}

/** Member self-service portal activation invite — member-facing copy, distinct from the staff `invitationEmail`. */
export function memberPortalInviteEmail(branding: EmailBranding, memberName: string, acceptUrl: string) {
  return {
    subject: `Activate your ${branding.tenantName} member portal`,
    html: renderEmailLayout(
      branding,
      {
        icon: '🏃',
        title: 'Your member portal is ready',
        subtitle: `${branding.tenantName} has set you up with online access.`,
        categoryLabel: 'Member Portal',
        preheader: `${branding.tenantName} enabled your member portal access — activate it now.`,
      },
      `${paragraph(`${hi(memberName)} ${strong(branding.tenantName)} has enabled portal access for you. Set a password to get started.`)}
       ${actionButton(acceptUrl, 'Activate my account', branding.primaryColor)}
       ${secondaryLink(acceptUrl, 'Or paste this link into your browser')}
       ${sectionTitle('What you can do')}
       ${stepList(
         [
           { title: 'Track attendance and progress' },
           { title: 'See your workout and diet plans' },
           { title: 'View invoices and payments' },
           { title: 'Book classes' },
         ],
         branding.primaryColor,
       )}
       ${alertBox('info', 'Invitation valid for 72 hours', 'If it expires, ask the front desk to send you a new one.')}
       ${signature(branding)}`,
    ),
  };
}

export type SubscriptionAlertKind = 'trial_ending' | 'renewal_reminder' | 'payment_failed' | 'suspended';

export function subscriptionAlertEmail(
  branding: EmailBranding,
  name: string,
  kind: SubscriptionAlertKind,
  opts?: { billingUrl?: string; date?: string | null },
) {
  const t = escapeHtml(branding.tenantName);
  const when = opts?.date ? `on <strong>${escapeHtml(formatDate(opts.date))}</strong>` : 'in <strong>3 days</strong>';
  const copy: Record<
    SubscriptionAlertKind,
    { subject: string; icon: string; title: string; subtitle: string; categoryLabel: string; tone: HeroTone; body: string; cta: string; tip: string }
  > = {
    trial_ending: {
      subject: 'Your free trial ends soon',
      icon: '⏳',
      title: 'Your trial ends soon',
      subtitle: 'Choose a plan to keep everything running.',
      categoryLabel: 'Subscription',
      tone: 'warning',
      body: `your ${t} free trial ends ${when}. Pick a plan before then to keep your members, data and settings available without interruption.`,
      cta: 'Choose a plan',
      tip: 'Your data is kept — nothing is deleted when a trial ends.',
    },
    renewal_reminder: {
      subject: 'Your subscription renews soon',
      icon: '🔄',
      title: 'Renewal reminder',
      subtitle: 'A heads-up before your next billing date.',
      categoryLabel: 'Subscription',
      tone: 'brand',
      body: `the FitCloud subscription for ${t} renews ${when}. No action is needed if your payment details are up to date.`,
      cta: 'Review billing',
      tip: 'Want to change plan before renewal? You can do that from the billing page.',
    },
    payment_failed: {
      subject: 'Payment failed — action needed',
      icon: '⚠️',
      title: 'Payment failed',
      subtitle: 'We couldn’t charge your last payment.',
      categoryLabel: 'Billing',
      tone: 'danger',
      body: `we couldn’t process the latest payment for ${t}. Please update your billing details to avoid any service interruption.`,
      cta: 'Update billing details',
      tip: 'Your account stays active during a short grace period while you fix this.',
    },
    suspended: {
      subject: 'Your account has been suspended',
      icon: '🚫',
      title: 'Account suspended',
      subtitle: 'Access is paused until billing is resolved.',
      categoryLabel: 'Account Status',
      tone: 'danger',
      body: `the FitCloud subscription for ${t} has been suspended. Resolve billing to restore access — your data is preserved.`,
      cta: 'Restore access',
      tip: 'Need a hand? Reply to your account manager or contact FitCloud billing support.',
    },
  };
  const c = copy[kind];
  const alertTone = c.tone === 'brand' ? 'info' : c.tone;

  return {
    subject: c.subject,
    html: renderEmailLayout(
      branding,
      { icon: c.icon, title: c.title, subtitle: c.subtitle, categoryLabel: c.categoryLabel, tone: c.tone, preheader: c.subject },
      `${paragraph(`${hi(name)} ${c.body}`)}
       ${alertBox(alertTone, null, escapeHtml(c.tip))}
       ${opts?.billingUrl ? actionButton(opts.billingUrl, c.cta, c.tone === 'brand' ? branding.primaryColor : toneAccent(branding, c.tone)) : ''}
       ${signature(branding, 'Thanks,')}`,
    ),
  };
}

/** Sent to the PREVIOUS address when a member changes their own email — informational, no action link. */
export function memberEmailChangedEmail(branding: EmailBranding, name: string) {
  return {
    subject: 'Your email address was changed',
    html: renderEmailLayout(
      branding,
      {
        icon: '✉️',
        title: 'Email address changed',
        subtitle: 'The email on your member profile was updated.',
        categoryLabel: 'Account Security',
        tone: 'warning',
        preheader: 'The email on your gym profile was just changed.',
        footerHint: 'security',
      },
      `${paragraph(`${hi(name)} the email address on your ${strong(branding.tenantName)} member profile was just changed. You will no longer receive messages at this address.`)}
       ${alertBox('danger', 'Wasn’t you?', `Contact ${escapeHtml(branding.tenantName)} straight away so they can secure your profile.`)}`,
    ),
  };
}
