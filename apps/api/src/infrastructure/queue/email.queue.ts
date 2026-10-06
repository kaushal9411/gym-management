import { Queue } from 'bullmq';

import { createQueueConnection } from './connection';

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  fromAddress?: string;
  /**
   * The tenant this send belongs to — its presence is what tells
   * `email.worker.ts` to write a `NotificationDeliveryLog` row (tenant-facing
   * Message Log). Set by every tenant-scoped call site EXCEPT the two
   * account-security families that must never be blocked by a tenant's own
   * email quota or show up as "just another notification": login OTP
   * (`auth.otp_issued`, member `OtpIssued`, `onboarding.otp_issued`) and
   * password reset/changed (`PasswordResetRequested`, `PasswordChanged`,
   * admin's `reset-owner-password`). Left undefined for the public contact
   * form and the pre-tenant onboarding OTP, which have no tenant to attach
   * to. Logging here is independent of quota enforcement — only
   * `notification-trigger.service.ts`'s `fireTemplated` EMAIL branch goes
   * through `channel-gate.service.ts` first; every other call site below
   * just gets recorded as `SENT`/`FAILED`, never `SKIPPED_*`.
   */
  notificationTenantId?: string;
}

/**
 * Producer side of async email delivery. Runs as a real BullMQ queue
 * (Background Jobs requirement) so a slow/unreachable SMTP provider never
 * blocks a request. The worker (email.worker.ts) currently runs in-process
 * within this same api server — it moves to a dedicated `apps/worker`
 * deployable, unchanged, once that app exists (see docs/architecture
 * ARCHITECTURE.md §22).
 */
export const emailQueue = new Queue<EmailJobData, void, 'send'>('notifications-email', {
  connection: createQueueConnection(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

export async function enqueueEmail(data: EmailJobData): Promise<void> {
  await emailQueue.add('send', data);
}
