import { dailyAttendanceSummary, monthlyAttendanceSummary, weeklyAttendanceSummary } from '../handlers/attendance.handlers';
import { classSessionGeneration } from '../handlers/class-session.handlers';
import {
  cacheRefresh,
  cleanupAuditLogs,
  cleanupFailedUploads,
  cleanupOldNotifications,
  cleanupTemporaryFiles,
  clearExpiredSessions,
  databaseOptimization,
} from '../handlers/maintenance.handlers';
import {
  autoMembershipStatusUpdate,
  membershipExpiredNotification,
  membershipExpiryCheck,
  membershipRenewalReminder,
} from '../handlers/membership.handlers';
import { birthdayWishes, sendScheduledAnnouncements, sendScheduledNotifications, welcomeMessages } from '../handlers/notification.handlers';
import { failedPaymentRetry, invoiceGeneration, outstandingPaymentReminder, paymentReminder } from '../handlers/payment.handlers';
import { dailyRevenueSummary, monthlyReportsRollup, tenantScheduledReportsDispatch, weeklyBranchPerformanceReport } from '../handlers/report.handlers';
import { platformSubscriptionBillingSweep } from '../handlers/subscription-billing.handlers';
import type { JobDefinition } from '../types';

const MIN = 60_000;
const DEFAULT_TIMEZONE = 'UTC';

function job(partial: Omit<JobDefinition, 'timezone' | 'priority' | 'maxRetries' | 'retryDelayMs' | 'timeoutMs'> & Partial<Pick<JobDefinition, 'priority' | 'maxRetries' | 'retryDelayMs' | 'timeoutMs'>>): JobDefinition {
  return {
    timezone: DEFAULT_TIMEZONE,
    priority: 2,
    maxRetries: 3,
    retryDelayMs: MIN,
    timeoutMs: 5 * MIN,
    ...partial,
  };
}

/**
 * The single source of truth for every background job in the system — the
 * spec's explicit mandate ("Do not use cron logic inside individual
 * modules. All automation must be managed through this centralized
 * scheduler.") means new automation gets a new entry here, never a new
 * `Queue`/`Worker`/`repeat` call inside a feature module. `scheduler-engine
 * .service.ts` upserts each entry into `ScheduledJob` at boot and registers
 * its BullMQ repeatable schedule; `queueName` groups jobs into one of 6
 * category queues (see spec's "Multiple Queues").
 */
export const JOB_REGISTRY: JobDefinition[] = [
  // ── Membership ──────────────────────────────────────────────────────────
  job({
    name: 'membership-renewal-reminder',
    category: 'MEMBERSHIP',
    description: 'Emails members whose active membership expires within 7 days.',
    cronPattern: '0 8 * * *',
    priority: 2,
    handler: membershipRenewalReminder,
  }),
  job({
    name: 'membership-expiry-check',
    category: 'MEMBERSHIP',
    description: 'Read-only audit: counts active memberships whose end date has already passed.',
    cronPattern: '30 0 * * *',
    priority: 3,
    handler: membershipExpiryCheck,
  }),
  job({
    name: 'auto-membership-status-update',
    category: 'MEMBERSHIP',
    description: 'Flips active memberships past their end date to EXPIRED.',
    cronPattern: '0 1 * * *',
    priority: 1,
    handler: autoMembershipStatusUpdate,
  }),
  job({
    name: 'membership-expired-notification',
    category: 'MEMBERSHIP',
    description: 'Notifies members whose membership was recently flipped to EXPIRED.',
    cronPattern: '30 1 * * *',
    priority: 2,
    handler: membershipExpiredNotification,
  }),

  // ── Attendance ───────────────────────────────────────────────────────────
  job({
    name: 'daily-attendance-summary',
    category: 'ATTENDANCE',
    description: "Aggregates today's check-in counts across every tenant.",
    cronPattern: '0 23 * * *',
    priority: 3,
    handler: dailyAttendanceSummary,
  }),
  job({
    name: 'weekly-attendance-summary',
    category: 'ATTENDANCE',
    description: 'Aggregates the past 7 days of check-in counts across every tenant.',
    cronPattern: '15 23 * * 0',
    priority: 3,
    handler: weeklyAttendanceSummary,
  }),
  job({
    name: 'monthly-attendance-summary',
    category: 'ATTENDANCE',
    description: "Aggregates the prior calendar month's check-in counts across every tenant.",
    cronPattern: '30 23 1 * *',
    priority: 3,
    handler: monthlyAttendanceSummary,
  }),

  // ── Payment ──────────────────────────────────────────────────────────────
  job({
    name: 'payment-reminder',
    category: 'PAYMENT',
    description: 'Reminds members with an invoice due within 3 days.',
    cronPattern: '0 9 * * *',
    priority: 1,
    handler: paymentReminder,
  }),
  job({
    name: 'failed-payment-retry',
    category: 'PAYMENT',
    description: 'Nudges members whose most recent payment attempt failed.',
    cronPattern: '0 10 * * *',
    priority: 1,
    handler: failedPaymentRetry,
  }),
  job({
    name: 'invoice-generation',
    category: 'PAYMENT',
    description: 'Auto-generates a renewal invoice for memberships entering their renewal window.',
    cronPattern: '0 2 * * *',
    priority: 2,
    handler: invoiceGeneration,
  }),
  job({
    name: 'outstanding-payment-reminder',
    category: 'PAYMENT',
    description: 'Weekly escalation reminder for invoices overdue by 7+ days.',
    cronPattern: '0 9 * * 1',
    priority: 2,
    handler: outstandingPaymentReminder,
  }),
  job({
    name: 'platform-subscription-billing-sweep',
    category: 'PAYMENT',
    description: "Migrated lifecycle sweep for FitCloud's own tenant billing (trial/renewal reminders, auto-renew, grace period, suspension, expiry).",
    cronPattern: '0 5 * * *',
    priority: 1,
    timeoutMs: 10 * MIN,
    handler: platformSubscriptionBillingSweep,
  }),

  // ── Notification ─────────────────────────────────────────────────────────
  job({
    name: 'send-scheduled-notifications',
    category: 'NOTIFICATION',
    description: 'Dispatches admin-authored notifications whose scheduled send time has arrived.',
    cronPattern: '*/15 * * * *',
    priority: 1,
    handler: sendScheduledNotifications,
  }),
  job({
    name: 'send-scheduled-announcements',
    category: 'NOTIFICATION',
    description: 'Publishes due scheduled tenant announcements and expires ones past their expiry date.',
    cronPattern: '0 * * * *',
    priority: 2,
    handler: sendScheduledAnnouncements,
  }),
  job({
    name: 'birthday-wishes',
    category: 'NOTIFICATION',
    description: "Sends a birthday email to members whose date of birth is today.",
    cronPattern: '0 7 * * *',
    priority: 3,
    handler: birthdayWishes,
  }),
  job({
    name: 'welcome-messages',
    category: 'NOTIFICATION',
    description: 'Safety-net catch-up for the synchronous registration welcome email.',
    cronPattern: '*/30 * * * *',
    priority: 3,
    handler: welcomeMessages,
  }),

  // ── Report ───────────────────────────────────────────────────────────────
  job({
    name: 'tenant-scheduled-reports-dispatch',
    category: 'REPORT',
    description: "Emails each tenant's due configured scheduled reports.",
    cronPattern: '0 * * * *',
    priority: 2,
    timeoutMs: 10 * MIN,
    handler: tenantScheduledReportsDispatch,
  }),
  job({
    name: 'daily-revenue-summary',
    category: 'REPORT',
    description: "Aggregates the platform's daily subscription revenue by currency.",
    cronPattern: '45 23 * * *',
    priority: 3,
    handler: dailyRevenueSummary,
  }),
  job({
    name: 'weekly-branch-performance-report',
    category: 'REPORT',
    description: 'Cross-tenant top-20 branch ranking by revenue + attendance for the past 7 days.',
    cronPattern: '0 0 * * 1',
    priority: 3,
    handler: weeklyBranchPerformanceReport,
  }),
  job({
    name: 'monthly-reports-rollup',
    category: 'REPORT',
    description: "Prior month's platform-wide revenue + attendance rollup.",
    cronPattern: '0 0 1 * *',
    priority: 3,
    handler: monthlyReportsRollup,
  }),

  // ── Class ────────────────────────────────────────────────────────────────
  job({
    name: 'class-session-generation',
    category: 'CLASS',
    description: 'Generates the next 4 weeks of dated ClassSession rows from every active recurring weekly class schedule, across every active tenant.',
    cronPattern: '0 2 * * *',
    priority: 2,
    timeoutMs: 10 * MIN,
    handler: classSessionGeneration,
  }),

  // ── Maintenance ──────────────────────────────────────────────────────────
  job({
    name: 'clear-expired-sessions',
    category: 'MAINTENANCE',
    description: 'Deletes refresh tokens expired 7+ days ago.',
    cronPattern: '0 3 * * *',
    priority: 3,
    handler: clearExpiredSessions,
  }),
  job({
    name: 'cleanup-temporary-files',
    category: 'MAINTENANCE',
    description: 'Placeholder for temporary-file cleanup — no local temp storage exists in this deployment.',
    cronPattern: '10 3 * * *',
    priority: 3,
    handler: cleanupTemporaryFiles,
  }),
  job({
    name: 'cleanup-old-notifications',
    category: 'MAINTENANCE',
    description: 'Deletes notifications older than 90 days.',
    cronPattern: '20 3 * * *',
    priority: 3,
    handler: cleanupOldNotifications,
  }),
  job({
    name: 'cleanup-audit-logs',
    category: 'MAINTENANCE',
    description: 'Deletes audit log entries older than 180 days.',
    cronPattern: '0 4 * * *',
    priority: 3,
    handler: cleanupAuditLogs,
  }),
  job({
    name: 'cleanup-failed-uploads',
    category: 'MAINTENANCE',
    description: 'Placeholder for failed-upload cleanup — no upload-attempt tracking table exists in this deployment.',
    cronPattern: '10 4 * * *',
    priority: 3,
    handler: cleanupFailedUploads,
  }),
  job({
    name: 'cache-refresh',
    category: 'MAINTENANCE',
    description: 'Invalidates permission/tenant-resolution cache prefixes so they recompute fresh.',
    cronPattern: '0 */6 * * *',
    priority: 2,
    handler: cacheRefresh,
  }),
  job({
    name: 'database-optimization',
    category: 'MAINTENANCE',
    description: "Runs ANALYZE to refresh the query planner's statistics.",
    cronPattern: '0 4 * * 0',
    priority: 3,
    timeoutMs: 10 * MIN,
    handler: databaseOptimization,
  }),
];

export function queueNameForCategory(category: JobDefinition['category']): string {
  return `scheduler-${category.toLowerCase()}`;
}
