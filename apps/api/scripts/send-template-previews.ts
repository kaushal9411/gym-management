/**
 * One-off dev script — sends every email template (with realistic sample
 * data) straight to Mailpit for manual visual review. Not part of the app's
 * runtime; run once via `tsx scripts/send-template-previews.ts` from
 * `apps/api`, then delete. Bypasses the BullMQ queue (`enqueueEmail`) and
 * calls `mailer.send()` directly so every send lands immediately.
 */
import { mailer } from '../src/infrastructure/mail/mailer';
import {
  invitationEmail,
  memberPortalInviteEmail,
  otpCodeEmail,
  passwordChangedEmail,
  passwordResetEmail,
  subscriptionAlertEmail,
  verifyEmailEmail,
  welcomeEmail,
} from '../src/infrastructure/mail/templates/auth-templates';
import { gracePeriodReminderEmail, invoiceEmail, subscriptionActivatedEmail, subscriptionExpiredEmail } from '../src/infrastructure/mail/templates/billing-templates';
import { memberInvoiceSummaryEmail, memberPaymentReceiptEmail, paymentDueReminderEmail, paymentOverdueReminderEmail } from '../src/infrastructure/mail/templates/member-templates';
import { tenantNotificationEmail } from '../src/infrastructure/mail/templates/notification-templates';
import { onboardingWelcomeEmail, paymentSuccessEmail } from '../src/infrastructure/mail/templates/onboarding-templates';

const INDIGO = { tenantName: 'Titan Fitness', primaryColor: '#4f46e5' };
const GREEN = { tenantName: 'Zenith Health Club', primaryColor: '#16a34a' };
const ORANGE = { tenantName: 'Pulse Gym', primaryColor: '#ea580c' };

const TO = 'preview@fitcloud.local';

async function send(label: string, template: { subject: string; html: string }) {
  await mailer.send({ to: TO, subject: `[PREVIEW] ${label} — ${template.subject}`, html: template.html });
  console.log(`sent: ${label}`);
}

async function main() {
  // ── Auth ──────────────────────────────────────────────────────────────
  await send('welcomeEmail', welcomeEmail(INDIGO, 'Arjun Mehta', 'https://fitcloud.appkraft.info/verify?token=abc123'));
  await send('verifyEmailEmail', verifyEmailEmail(GREEN, 'Priya Nair', 'https://fitcloud.appkraft.info/verify?token=abc123'));
  await send('passwordResetEmail', passwordResetEmail(ORANGE, 'Rahul Singh', 'https://fitcloud.appkraft.info/reset-password?token=xyz789'));
  await send('passwordChangedEmail', passwordChangedEmail(INDIGO, 'Arjun Mehta'));
  await send('otpCodeEmail', otpCodeEmail(GREEN, 'Priya Nair', '482913', 10));
  await send('invitationEmail', invitationEmail(ORANGE, 'Kaushal Singh', 'Trainer', 'https://fitcloud.appkraft.info/staff-activation/tok123'));
  await send('memberPortalInviteEmail', memberPortalInviteEmail(INDIGO, 'Vikram Coach', 'https://fitcloud.appkraft.info/portal/activate/tok456'));
  await send('subscriptionAlertEmail (trial_ending)', subscriptionAlertEmail(GREEN, 'Priya Nair', 'trial_ending'));
  await send('subscriptionAlertEmail (renewal_reminder)', subscriptionAlertEmail(GREEN, 'Priya Nair', 'renewal_reminder'));
  await send('subscriptionAlertEmail (payment_failed)', subscriptionAlertEmail(ORANGE, 'Rahul Singh', 'payment_failed'));
  await send('subscriptionAlertEmail (suspended)', subscriptionAlertEmail(ORANGE, 'Rahul Singh', 'suspended'));

  // ── Billing ───────────────────────────────────────────────────────────
  await send('subscriptionActivatedEmail (CREATED)', subscriptionActivatedEmail(INDIGO, 'Arjun Mehta', 'Professional', 'CREATED'));
  await send('subscriptionActivatedEmail (UPGRADED)', subscriptionActivatedEmail(GREEN, 'Priya Nair', 'Enterprise', 'UPGRADED'));
  await send('invoiceEmail', invoiceEmail(ORANGE, 'Rahul Singh', 'INV-2026-0142', '$79.00', 'https://fitcloud.appkraft.info/billing/invoices/inv142'));
  await send('subscriptionExpiredEmail', subscriptionExpiredEmail(INDIGO, 'Arjun Mehta'));
  await send('gracePeriodReminderEmail', gracePeriodReminderEmail(GREEN, 'Priya Nair', 3));

  // ── Onboarding ────────────────────────────────────────────────────────
  await send(
    'onboardingWelcomeEmail (trial)',
    onboardingWelcomeEmail(ORANGE, 'Rahul Singh', 'Professional', true, new Date(Date.now() + 14 * 86400000).toISOString(), 'https://pulsegym.fitcloud.appkraft.info/login'),
  );
  await send('paymentSuccessEmail', paymentSuccessEmail(INDIGO, 'Arjun Mehta', '$49.00', 'Starter'));

  // ── Member-facing (finance) ──────────────────────────────────────────
  await send(
    'memberInvoiceSummaryEmail (PAID)',
    memberInvoiceSummaryEmail(GREEN, 'Neha Kapoor', 'INV-M-2026-0087', '4 Sep 2026', '₹5,900.00', 'PAID', '11 Sep 2026', 'Membership payment — Quarterly Pro'),
  );
  await send(
    'memberInvoiceSummaryEmail (UNPAID)',
    memberInvoiceSummaryEmail(ORANGE, 'Neha Kapoor', 'INV-M-2026-0088', '4 Sep 2026', '₹5,900.00', 'UNPAID', '11 Sep 2026', 'Membership payment — Quarterly Pro'),
  );
  await send('paymentDueReminderEmail', paymentDueReminderEmail(INDIGO, 'Neha', 'INV-M-2026-0089', '₹5,900.00', '8 Sep 2026', 'Membership renewal — Quarterly Pro'));
  await send('paymentOverdueReminderEmail', paymentOverdueReminderEmail(GREEN, 'Neha', 'INV-M-2026-0075', '₹5,900.00', '28 Aug 2026', 'Membership renewal — Quarterly Pro'));
  await send(
    'memberPaymentReceiptEmail (fully paid)',
    memberPaymentReceiptEmail(INDIGO, {
      memberName: 'Neha Kapoor',
      paymentNumber: 'PAY-0231',
      paymentDate: '05 Sep 2026',
      method: 'UPI',
      currencySymbol: '₹',
      amountPaid: 5900,
      totalPaid: 5900,
      dueAmount: 0,
      membershipPlanName: 'Quarterly Pro',
      membershipValidTill: '04 Dec 2026',
      transactionReference: 'UPI-4821093756',
    }),
  );
  await send(
    'memberPaymentReceiptEmail (partial — balance due)',
    memberPaymentReceiptEmail(ORANGE, {
      memberName: 'Rahul Singh',
      paymentNumber: 'PAY-0245',
      paymentDate: '05 Sep 2026',
      method: 'CASH',
      currencySymbol: '₹',
      amountPaid: 3000,
      discount: 200,
      totalPaid: 3000,
      dueAmount: 2700,
      membershipPlanName: 'Annual Gold',
      membershipValidTill: '04 Sep 2027',
    }),
  );

  // ── Tenant notification (customizable templates) ─────────────────────
  await send(
    'tenantNotificationEmail (WELCOME_MESSAGE)',
    tenantNotificationEmail(ORANGE, 'Welcome to Pulse Gym, Neha Kapoor!', "We're excited to have you on board. Your member ID is MEM-0231. See you at the gym!"),
  );
  await send(
    'tenantNotificationEmail (MEMBERSHIP_EXPIRY)',
    tenantNotificationEmail(INDIGO, 'Neha Kapoor, your Quarterly Pro membership expires in 3 day(s)', 'Your Quarterly Pro membership expires in 3 day(s) on 8 Sep 2026. Visit the front desk to renew and keep your access uninterrupted.'),
  );

  console.log('\nAll template previews sent — check http://localhost:8025');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
