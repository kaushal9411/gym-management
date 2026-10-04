import { describe, expect, it } from 'vitest';

import {
  invitationEmail,
  memberEmailChangedEmail,
  memberPortalInviteEmail,
  otpCodeEmail,
  passwordChangedEmail,
  passwordResetEmail,
  subscriptionAlertEmail,
  verifyEmailEmail,
  welcomeEmail,
} from './auth-templates';
import { escapeHtml, htmlToText, parseColor, PLATFORM_BRANDING, safeUrl, type EmailBranding } from './base-layout';
import { gracePeriodReminderEmail, invoiceEmail, subscriptionActivatedEmail, subscriptionExpiredEmail } from './billing-templates';
import { memberInvoiceSummaryEmail, memberPaymentReceiptEmail, paymentDueReminderEmail, paymentOverdueReminderEmail } from './member-templates';
import { contactInquiryEmail, platformAnnouncementEmail, scheduledReportEmail, tenantNotificationEmail } from './notification-templates';
import { onboardingWelcomeEmail, paymentSuccessEmail } from './onboarding-templates';

const EVIL = '<script>alert(1)</script>';
const evilBrand: EmailBranding = { tenantName: `Gym ${EVIL}`, primaryColor: 'oklch(0.51 0.23 277)', supportEmail: 'help@gym.test' };
const URL = 'https://gym.test/x?a=1&b=2';

const build = (b: EmailBranding, n: string) =>
  ({
    welcome: welcomeEmail(b, n, URL),
    verify: verifyEmailEmail(b, n, URL),
    reset: passwordResetEmail(b, n, URL),
    resetAdmin: passwordResetEmail(b, n, URL, { byAdmin: true }),
    changed: passwordChangedEmail(b, n),
    otp: otpCodeEmail(b, n, '123456', 10),
    invite: invitationEmail(b, n, n, URL),
    portal: memberPortalInviteEmail(b, n, URL),
    emailChanged: memberEmailChangedEmail(b, n),
    alertTrial: subscriptionAlertEmail(b, n, 'trial_ending', { billingUrl: URL, date: '2026-10-08' }),
    alertRenew: subscriptionAlertEmail(b, n, 'renewal_reminder', { billingUrl: URL }),
    alertFail: subscriptionAlertEmail(b, n, 'payment_failed', { billingUrl: URL }),
    alertSusp: subscriptionAlertEmail(b, n, 'suspended'),
    activated: subscriptionActivatedEmail(b, n, n, 'CREATED', { invoiceNumber: 'INV-1', total: '₹1.00', billingUrl: URL }),
    invoice: invoiceEmail(b, n, 'INV-1', '₹1.00', URL),
    expired: subscriptionExpiredEmail(b, n, { billingUrl: URL }),
    grace: gracePeriodReminderEmail(b, n, 2, { billingUrl: URL, graceEndsAt: '2026-10-08' }),
    onboard: onboardingWelcomeEmail(b, n, n, true, '2026-10-19', URL),
    paySuccess: paymentSuccessEmail(b, n, '₹1.00', n, { billingUrl: URL }),
    memInv: memberInvoiceSummaryEmail(b, n, 'INV-7', '2026-10-01', '₹10.00', 'UNPAID', '2026-10-09', n, { lineItems: [{ description: n, quantity: 2, amount: '₹10.00' }] }),
    due: paymentDueReminderEmail(b, n, 'INV-7', '₹10.00', '2026-10-09', n),
    overdue: paymentOverdueReminderEmail(b, n, 'INV-7', '₹10.00', '2026-10-01', n),
    receipt: memberPaymentReceiptEmail(b, { memberName: n, paymentNumber: 'PAY-1', paymentDate: '2026-10-05', method: 'UPI', currencySymbol: '₹', amountPaid: 5, totalPaid: 5, dueAmount: 5, membershipPlanName: n }),
    notif: tenantNotificationEmail(b, n, `${n}\nline two`),
    announce: platformAnnouncementEmail(PLATFORM_BRANDING, n, n),
    contact: contactInquiryEmail(PLATFORM_BRANDING, { topic: 'sales', name: n, email: 'a@b.test', message: n }),
    report: scheduledReportEmail(b, { scheduleName: n, reportType: 'X', frequency: 'WEEKLY', csv: `a,b\n${n},1`, filename: 'r.csv' }),
  }) as Record<string, { subject: string; html: string }>;

describe('email templates', () => {
  const clean = build({ tenantName: 'Kaushal Fitness', primaryColor: '#4f46e5' }, 'Rohan Verma');
  const hostile = build(evilBrand, EVIL);

  it.each(Object.keys(clean))('%s returns subject + html without junk values', (key) => {
    const { subject, html } = clean[key]!;
    expect(subject.length).toBeGreaterThan(3);
    expect(html).toContain('<!doctype html>');
    for (const bad of ['undefined', 'NaN', '[object Object]', 'null']) expect(html).not.toContain(bad);
  });

  it.each(Object.keys(hostile))('%s escapes hostile input', (key) => {
    expect(hostile[key]!.html).not.toContain('<script>');
  });

  it('includes key facts', () => {
    expect(clean.receipt!.html).toContain('PAY-1');
    expect(clean.memInv!.html).toContain('INV-7');
    expect(clean.otp!.html).toContain('123456');
    expect(clean.memInv!.html).toContain('9 Oct 2026');
  });

  it('includes action links with escaped query strings', () => {
    for (const key of ['welcome', 'reset', 'invite', 'portal', 'invoice']) expect(clean[key]!.html).toContain('https://gym.test/x?a=1&#38;b=2');
  });

  it('uses the plain letter layout (no cards/gradients)', () => {
    expect(clean.welcome!.html).not.toContain('linear-gradient');
    expect(clean.welcome!.html).not.toContain('border-radius:20px');
  });

  it('helpers', () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe('&#60;a href=&#34;x&#34;&#62;&#38;&#39;');
    expect(safeUrl('javascript:alert(1)')).toBe('#');
    expect(parseColor('oklch(0.51 0.23 277)')).not.toBeNull();
    expect(parseColor('garbage')).toBeNull();
    const text = htmlToText(clean.reset!.html);
    expect(text).toContain('Reset password');
    expect(text).not.toContain('<');
  });
});
