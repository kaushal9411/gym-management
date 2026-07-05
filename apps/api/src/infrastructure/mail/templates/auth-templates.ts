import { actionButton, renderEmailLayout, type EmailBranding } from './base-layout';

export function welcomeEmail(branding: EmailBranding, ownerName: string, verifyUrl: string) {
  return {
    subject: `Welcome to ${branding.tenantName} on FitCloud`,
    html: renderEmailLayout(
      branding,
      `<h1 style="font-size:20px;margin:0 0 12px;">Welcome, ${ownerName}!</h1>
       <p>Your gym <strong>${branding.tenantName}</strong> is ready on FitCloud. Verify your email to activate your account and start your 14-day free trial.</p>
       ${actionButton(verifyUrl, 'Verify email address', branding.primaryColor)}
       <p style="margin-top:20px;font-size:13px;color:#6b7280;">This link expires in 24 hours.</p>`,
    ),
  };
}

export function verifyEmailEmail(branding: EmailBranding, name: string, verifyUrl: string) {
  return {
    subject: 'Verify your email address',
    html: renderEmailLayout(
      branding,
      `<h1 style="font-size:20px;margin:0 0 12px;">Verify your email</h1>
       <p>Hi ${name}, please confirm your email address to activate your account.</p>
       ${actionButton(verifyUrl, 'Verify email address', branding.primaryColor)}
       <p style="margin-top:20px;font-size:13px;color:#6b7280;">This link expires in 24 hours. If you didn't create this account, you can ignore this email.</p>`,
    ),
  };
}

export function passwordResetEmail(branding: EmailBranding, name: string, resetUrl: string) {
  return {
    subject: 'Reset your password',
    html: renderEmailLayout(
      branding,
      `<h1 style="font-size:20px;margin:0 0 12px;">Reset your password</h1>
       <p>Hi ${name}, we received a request to reset your ${branding.tenantName} password.</p>
       ${actionButton(resetUrl, 'Reset password', branding.primaryColor)}
       <p style="margin-top:20px;font-size:13px;color:#6b7280;">This link expires in 30 minutes. If you didn't request this, you can safely ignore this email — your password won't change.</p>`,
    ),
  };
}

export function passwordChangedEmail(branding: EmailBranding, name: string) {
  return {
    subject: 'Your password was changed',
    html: renderEmailLayout(
      branding,
      `<h1 style="font-size:20px;margin:0 0 12px;">Password changed</h1>
       <p>Hi ${name}, this confirms your ${branding.tenantName} password was just changed. All other sessions have been signed out.</p>
       <p style="margin-top:20px;font-size:13px;color:#6b7280;">If you didn't make this change, contact your gym owner immediately.</p>`,
    ),
  };
}

export function otpCodeEmail(branding: EmailBranding, name: string, code: string, expiresInMinutes: number) {
  return {
    subject: `Your verification code: ${code}`,
    html: renderEmailLayout(
      branding,
      `<h1 style="font-size:20px;margin:0 0 12px;">Your verification code</h1>
       <p>Hi ${name}, use this code to continue signing in to ${branding.tenantName}:</p>
       <div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;padding:16px;background:#f4f4f7;border-radius:8px;margin:16px 0;">${code}</div>
       <p style="font-size:13px;color:#6b7280;">This code expires in ${expiresInMinutes} minutes. Never share it with anyone — FitCloud staff will never ask for it.</p>`,
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
      `<h1 style="font-size:20px;margin:0 0 12px;">You're invited!</h1>
       <p>${inviterName} invited you to join <strong>${branding.tenantName}</strong> on FitCloud as a <strong>${roleLabel}</strong>.</p>
       ${actionButton(acceptUrl, 'Accept invitation', branding.primaryColor)}
       <p style="margin-top:20px;font-size:13px;color:#6b7280;">This invitation expires in 48 hours.</p>`,
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
      body: `Hi ${name}, your ${branding.tenantName} free trial ends in 3 days. Choose a plan to keep everything running without interruption.`,
    },
    renewal_reminder: {
      subject: 'Your subscription renews soon',
      body: `Hi ${name}, ${branding.tenantName}'s subscription renews in 3 days. No action needed if your payment details are up to date.`,
    },
    payment_failed: {
      subject: 'Payment failed — action needed',
      body: `Hi ${name}, we couldn't process your last payment for ${branding.tenantName}. Please update your billing details to avoid service interruption.`,
    },
    suspended: {
      subject: 'Your account has been suspended',
      body: `Hi ${name}, ${branding.tenantName}'s FitCloud subscription has been suspended. Contact billing support to restore access.`,
    },
  }[kind];

  return {
    subject: copy.subject,
    html: renderEmailLayout(branding, `<h1 style="font-size:20px;margin:0 0 12px;">${copy.subject}</h1><p>${copy.body}</p>`),
  };
}
