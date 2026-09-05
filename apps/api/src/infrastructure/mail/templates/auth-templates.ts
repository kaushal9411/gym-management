import { actionButton, codeBlock, footnote, infoBox, renderEmailLayout, secondaryLink, toneAccent, type EmailBranding, type HeroTone } from './base-layout';

export function welcomeEmail(branding: EmailBranding, ownerName: string, verifyUrl: string) {
  return {
    subject: `Welcome to ${branding.tenantName} on FitCloud`,
    html: renderEmailLayout(
      branding,
      { icon: '🎉', title: `Welcome, ${ownerName}!`, categoryLabel: 'Welcome', preheader: `Verify your email to activate ${branding.tenantName} and start your free trial.` },
      `<p>Your gym <strong>${branding.tenantName}</strong> is set up and ready on FitCloud. Verify your email to activate your account and kick off your 14-day free trial — full access, no card charged until it ends.</p>
       ${actionButton(verifyUrl, 'Verify email address', branding.primaryColor)}
       ${secondaryLink(verifyUrl, 'Or paste this link into your browser')}
       ${footnote('This link expires in 24 hours. If you didn’t create this account, you can safely ignore this email.')}`,
    ),
  };
}

export function verifyEmailEmail(branding: EmailBranding, name: string, verifyUrl: string) {
  return {
    subject: 'Verify your email address',
    html: renderEmailLayout(
      branding,
      { icon: '✉️', title: 'Verify Your Email', categoryLabel: 'Account Security', preheader: 'Confirm your email address to activate your account.' },
      `<p>Hi ${name}, please confirm your email address to activate your ${branding.tenantName} account.</p>
       ${actionButton(verifyUrl, 'Verify email address', branding.primaryColor)}
       ${secondaryLink(verifyUrl, 'Or paste this link into your browser')}
       ${footnote('This link expires in 24 hours. If you didn’t create this account, you can safely ignore this email.')}`,
    ),
  };
}

export function passwordResetEmail(branding: EmailBranding, name: string, resetUrl: string) {
  return {
    subject: 'Reset your password',
    html: renderEmailLayout(
      branding,
      { icon: '🔒', title: 'Reset Your Password', categoryLabel: 'Account Security', preheader: 'Reset your password — this link expires in 30 minutes.' },
      `<p>Hi ${name}, we received a request to reset your ${branding.tenantName} password. Click below to choose a new one.</p>
       ${actionButton(resetUrl, 'Reset password', branding.primaryColor)}
       ${secondaryLink(resetUrl, 'Or paste this link into your browser')}
       ${footnote('This link expires in 30 minutes. If you didn’t request this, your password won’t change.')}`,
    ),
  };
}

export function passwordChangedEmail(branding: EmailBranding, name: string) {
  return {
    subject: 'Your password was changed',
    html: renderEmailLayout(
      branding,
      { icon: '✅', title: 'Password Changed', categoryLabel: 'Account Security', tone: 'success', preheader: 'Your password was just changed.' },
      `<p>Hi ${name}, this confirms your ${branding.tenantName} password was just changed. For your security, every other device has been signed out.</p>
       ${footnote('If you didn’t make this change, contact your gym owner immediately.')}`,
    ),
  };
}

export function otpCodeEmail(branding: EmailBranding, name: string, code: string, expiresInMinutes: number) {
  return {
    subject: `Your verification code: ${code}`,
    html: renderEmailLayout(
      branding,
      { icon: '🔑', title: 'Your Verification Code', categoryLabel: 'Verification', preheader: `Your verification code is ${code}.` },
      `<p>Hi ${name}, use this code to continue signing in to ${branding.tenantName}:</p>
       ${codeBlock(code, branding.primaryColor)}
       <p style="font-size:13px;color:#6b7280;">This code expires in <strong>${expiresInMinutes} minutes</strong>. Never share it with anyone.</p>`,
    ),
  };
}

export function invitationEmail(
  branding: EmailBranding,
  inviterName: string,
  roleLabel: string,
  acceptUrl: string,
) {
  return {
    subject: `You're invited to join ${branding.tenantName}`,
    html: renderEmailLayout(
      branding,
      { icon: '👋', title: 'You’re Invited!', categoryLabel: 'Team Invite', preheader: `${inviterName} invited you to join ${branding.tenantName} as a ${roleLabel}.` },
      `<p><strong>${inviterName}</strong> invited you to join <strong>${branding.tenantName}</strong> on FitCloud as a <strong>${roleLabel}</strong>.</p>
       ${actionButton(acceptUrl, 'Accept invitation', branding.primaryColor)}
       ${secondaryLink(acceptUrl, 'Or paste this link into your browser')}
       ${footnote('This invitation expires in 48 hours.')}`,
    ),
  };
}

/** Member self-service portal activation invite — distinct copy from `invitationEmail` (that one's staff-onboarding phrasing, "X invited you as a Y", doesn't read naturally for a gym member). */
export function memberPortalInviteEmail(branding: EmailBranding, memberName: string, acceptUrl: string) {
  return {
    subject: `Activate your ${branding.tenantName} member portal`,
    html: renderEmailLayout(
      branding,
      { icon: '👋', title: 'You’re Invited!', categoryLabel: 'Member Portal', preheader: `${branding.tenantName} enabled your member portal access — activate it now.` },
      `<p>Hi ${memberName}, <strong>${branding.tenantName}</strong> has enabled portal access for you — set a password to check your own attendance, workout &amp; diet plans, invoices, and class bookings any time.</p>
       ${actionButton(acceptUrl, 'Activate my account', branding.primaryColor)}
       ${secondaryLink(acceptUrl, 'Or paste this link into your browser')}
       ${footnote('This invitation expires in 72 hours.')}`,
    ),
  };
}

export function subscriptionAlertEmail(
  branding: EmailBranding,
  name: string,
  kind: 'trial_ending' | 'renewal_reminder' | 'payment_failed' | 'suspended',
) {
  const copy = {
    trial_ending: {
      subject: 'Your free trial ends soon',
      icon: '⏳',
      title: 'Your Trial Ends Soon',
      categoryLabel: 'Subscription',
      tone: 'warning' as HeroTone,
      body: `Hi ${name}, your ${branding.tenantName} free trial ends in <strong>3 days</strong>. Choose a plan to keep everything running without interruption.`,
    },
    renewal_reminder: {
      subject: 'Your subscription renews soon',
      icon: '🔄',
      title: 'Renewal Reminder',
      categoryLabel: 'Subscription',
      tone: 'brand' as HeroTone,
      body: `Hi ${name}, ${branding.tenantName}'s subscription renews in <strong>3 days</strong>. No action needed if your payment details are up to date.`,
    },
    payment_failed: {
      subject: 'Payment failed — action needed',
      icon: '⚠️',
      title: 'Payment Failed',
      categoryLabel: 'Billing',
      tone: 'danger' as HeroTone,
      body: `Hi ${name}, we couldn't process your last payment for ${branding.tenantName}. Please update your billing details to avoid a service interruption.`,
    },
    suspended: {
      subject: 'Your account has been suspended',
      icon: '🚫',
      title: 'Account Suspended',
      categoryLabel: 'Account Status',
      tone: 'danger' as HeroTone,
      body: `Hi ${name}, ${branding.tenantName}'s FitCloud subscription has been suspended. Contact billing support to restore access.`,
    },
  }[kind];

  return {
    subject: copy.subject,
    html: renderEmailLayout(
      branding,
      { icon: copy.icon, title: copy.title, categoryLabel: copy.categoryLabel, tone: copy.tone, preheader: copy.subject },
      infoBox(`<p style="margin:0;">${copy.body}</p>`, toneAccent(branding, copy.tone)),
    ),
  };
}
