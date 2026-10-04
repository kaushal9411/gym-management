/**
 * Email preview harness — renders EVERY transactional template with realistic sample data and sends each one
 * through the real mailer/SMTP (Mailpit in dev, UI http://localhost:8025) to a clearly-labelled preview address.
 *
 * Safe by construction: no DB access, no queue, no real users. Run from apps/api:  pnpm email:preview
 * Subjects are prefixed "[Preview] ". A second pass renders everything for a tenant with NO logo and NO brand
 * colour to prove the fallbacks, prefixed "[Preview][fallback] ".
 */
import { mailer } from '../src/infrastructure/mail/mailer';
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
} from '../src/infrastructure/mail/templates/auth-templates';
import { PLATFORM_BRANDING, type EmailBranding } from '../src/infrastructure/mail/templates/base-layout';
import {
  gracePeriodReminderEmail,
  invoiceEmail,
  subscriptionActivatedEmail,
  subscriptionExpiredEmail,
} from '../src/infrastructure/mail/templates/billing-templates';
import {
  memberInvoiceSummaryEmail,
  memberPaymentReceiptEmail,
  paymentDueReminderEmail,
  paymentOverdueReminderEmail,
} from '../src/infrastructure/mail/templates/member-templates';
import {
  contactInquiryEmail,
  platformAnnouncementEmail,
  scheduledReportEmail,
  tenantNotificationEmail,
} from '../src/infrastructure/mail/templates/notification-templates';
import { onboardingWelcomeEmail, paymentSuccessEmail } from '../src/infrastructure/mail/templates/onboarding-templates';

const TO = 'email-preview@kaushal-fitness.test';
const BASE = 'http://kaushal-fitness.fitcloud.test';

interface Item {
  label: string;
  mail: { subject: string; html: string };
}

function catalog(b: EmailBranding): Item[] {
  const day = 86_400_000;
  const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString().slice(0, 10);
  const lineItems = [
    { description: 'Gold Membership — 3 months', quantity: 1, amount: '₹6,000.00' },
    { description: 'Registration fee', quantity: 1, amount: '₹500.00' },
    { description: 'Personal training session', quantity: 4, amount: '₹2,000.00' },
  ];
  const receipt = {
    memberName: 'Rohan Verma',
    paymentNumber: 'PAY-0042',
    paymentDate: iso(0),
    method: 'UPI',
    currencySymbol: '₹',
    amountPaid: 4000,
    discount: 250,
    tax: 180,
    totalPaid: 4000,
    dueAmount: 4500,
    membershipPlanName: 'Gold Membership — 3 months',
    membershipValidTill: iso(90),
    transactionReference: 'UPI-8842771',
  };
  return [
    { label: 'auth: welcome (signup)', mail: welcomeEmail(b, 'Kaushal Singh', `${BASE}/verify-email?token=sample`) },
    { label: 'auth: verify email (resend)', mail: verifyEmailEmail(b, 'Kaushal Singh', `${BASE}/verify-email?token=sample`) },
    { label: 'auth: password reset', mail: passwordResetEmail(b, 'Kaushal Singh', `${BASE}/reset-password?token=sample`) },
    { label: 'auth: password reset (by platform admin)', mail: passwordResetEmail(b, 'Kaushal Singh', `${BASE}/reset-password?token=sample`, { byAdmin: true }) },
    { label: 'auth: password changed', mail: passwordChangedEmail(b, 'Kaushal Singh') },
    { label: 'auth: OTP code', mail: otpCodeEmail(b, 'Kaushal Singh', '482913', 10) },
    { label: 'auth: OTP code (onboarding, platform)', mail: otpCodeEmail(PLATFORM_BRANDING, 'there', '730518', 10) },
    { label: 'staff: invitation / activation', mail: invitationEmail(b, 'Kaushal Singh', 'Branch Manager', `${BASE}/invitation/sample`) },
    { label: 'member: portal invite', mail: memberPortalInviteEmail(b, 'Rohan Verma', `${BASE}/portal/activate/sample`) },
    { label: 'member: email changed notice', mail: memberEmailChangedEmail(b, 'Rohan Verma') },
    { label: 'subscription alert: trial ending', mail: subscriptionAlertEmail(b, 'Kaushal Singh', 'trial_ending', { billingUrl: `${BASE}/billing`, date: iso(3) }) },
    { label: 'subscription alert: renewal reminder', mail: subscriptionAlertEmail(b, 'Kaushal Singh', 'renewal_reminder', { billingUrl: `${BASE}/billing`, date: iso(3) }) },
    { label: 'subscription alert: payment failed', mail: subscriptionAlertEmail(b, 'Kaushal Singh', 'payment_failed', { billingUrl: `${BASE}/billing` }) },
    { label: 'subscription alert: suspended', mail: subscriptionAlertEmail(b, 'Kaushal Singh', 'suspended', { billingUrl: `${BASE}/billing` }) },
    { label: 'billing: subscription activated', mail: subscriptionActivatedEmail(b, 'Kaushal Singh', 'Professional', 'CREATED', { invoiceNumber: 'INV-2026-0142', total: '₹4,999.00', billingUrl: `${BASE}/billing` }) },
    { label: 'billing: subscription upgraded', mail: subscriptionActivatedEmail(b, 'Kaushal Singh', 'Enterprise', 'UPGRADED', { invoiceNumber: 'INV-2026-0150', total: '₹9,999.00', billingUrl: `${BASE}/billing` }) },
    { label: 'billing: platform invoice', mail: invoiceEmail(b, 'Kaushal Singh', 'INV-2026-0142', '₹4,999.00', `${BASE}/billing/invoices/sample`) },
    { label: 'billing: grace period reminder', mail: gracePeriodReminderEmail(b, 'Kaushal Singh', 2, { billingUrl: `${BASE}/billing`, graceEndsAt: iso(2) }) },
    { label: 'billing: subscription expired', mail: subscriptionExpiredEmail(b, 'Kaushal Singh', { billingUrl: `${BASE}/billing` }) },
    { label: 'onboarding: welcome (trial)', mail: onboardingWelcomeEmail(b, 'Kaushal Singh', 'Professional', true, iso(14), `${BASE}/login`) },
    { label: 'onboarding: welcome (paid)', mail: onboardingWelcomeEmail(b, 'Kaushal Singh', 'Professional', false, null, `${BASE}/login`) },
    { label: 'billing: payment success', mail: paymentSuccessEmail(b, 'Kaushal Singh', '₹4,999.00', 'Professional', { billingUrl: `${BASE}/billing` }) },
    { label: 'member: invoice summary (unpaid)', mail: memberInvoiceSummaryEmail(b, 'Rohan Verma', 'INV-0007', iso(-2), '₹8,500.00', 'UNPAID', iso(5), 'Gold Membership — 3 months', { lineItems }) },
    { label: 'member: invoice summary (paid)', mail: memberInvoiceSummaryEmail(b, 'Rohan Verma', 'INV-0006', iso(-20), '₹6,500.00', 'PAID', iso(-10), 'Gold Membership — 3 months', { lineItems: lineItems.slice(0, 2) }) },
    { label: 'member: payment due reminder', mail: paymentDueReminderEmail(b, 'Rohan', 'INV-0007', '₹8,500.00', iso(2), 'Gold Membership — 3 months') },
    { label: 'member: payment overdue reminder', mail: paymentOverdueReminderEmail(b, 'Rohan', 'INV-0005', '₹8,500.00', iso(-9), 'Gold Membership — 3 months') },
    { label: 'member: payment receipt (partial)', mail: memberPaymentReceiptEmail(b, receipt) },
    { label: 'member: payment receipt (fully paid)', mail: memberPaymentReceiptEmail(b, { ...receipt, paymentNumber: 'PAY-0043', dueAmount: 0, totalPaid: 8500, amountPaid: 4500 }) },
    { label: 'notification: tenant notification', mail: tenantNotificationEmail(b, 'Your membership expires in 3 days', 'Hi Rohan,\nYour Gold Membership expires on 8 Oct. Renew at the front desk to keep your access without a break.') },
    { label: 'admin: platform announcement', mail: platformAnnouncementEmail(PLATFORM_BRANDING, 'Scheduled maintenance on Sunday', 'FitCloud will be briefly unavailable on Sunday 02:00-02:30 UTC while we upgrade our infrastructure.\nNo action is needed.') },
    { label: 'platform: contact inquiry (sales)', mail: contactInquiryEmail(PLATFORM_BRANDING, { topic: 'sales', name: 'Priya Nair', email: 'priya@zenith-gym.test', phone: '+91 98765 43210', gymSlug: 'zenith', message: 'Hi, we run 3 branches and would like a demo of the Enterprise plan.\nCould someone call us this week?' }) },
    { label: 'platform: contact inquiry (billing)', mail: contactInquiryEmail(PLATFORM_BRANDING, { topic: 'billing', name: 'Arjun Mehta', email: 'arjun@titan.test', message: 'We were charged twice for INV-2026-0142.' }) },
    { label: 'scheduler: scheduled report', mail: scheduledReportEmail(b, { scheduleName: 'Weekly collections', reportType: 'REVENUE_SUMMARY', frequency: 'WEEKLY', branchName: null, filename: 'revenue-summary.csv', csv: 'date,branch,collected\n2026-10-01,Main,12500\n2026-10-02,Main,9800\n2026-10-03,Main,15400' }) },
  ];
}

async function run(branding: EmailBranding, prefix: string): Promise<number> {
  const items = catalog(branding);
  // The dev SMTP handshake is slow (~8s), so send in parallel batches.
  for (let i = 0; i < items.length; i += 2) {
    // eslint-disable-next-line no-await-in-loop -- batches are intentionally sequential
    await Promise.all(
      items.slice(i, i + 2).map(async (item) => {
        await mailer.send({ to: TO, subject: `${prefix}${item.mail.subject}`, html: item.mail.html, fromName: item.label });
        console.log(`sent ${prefix}${item.label}`);
      }),
    );
  }
  return items.length;
}

async function main(): Promise<void> {
  // oklch() is what the real tenant default is stored as — also exercises the colour conversion.
  const branded: EmailBranding = { tenantName: 'Kaushal Fitness', primaryColor: 'oklch(0.51 0.23 277)', supportEmail: 'hello@kaushal-fitness.test', supportPhone: '+91 98765 00000' };
  const bare: EmailBranding = { tenantName: 'Plain Gym' };
  const a = await run(branded, '[Preview] ');
  const b = await run(bare, '[Preview][fallback] ');
  console.log(`Done — ${a + b} emails sent to ${TO}. Open http://localhost:8025`);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
