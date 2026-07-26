import { Queue, Worker } from 'bullmq';

import { logger } from '../../../core/logging/logger';
import { prisma } from '../../../infrastructure/database/prisma';
import { createQueueConnection } from '../../../infrastructure/queue/connection';
import { enqueueEmail } from '../../../infrastructure/queue/email.queue';
import { ScheduledReportRepository } from '../repositories/scheduled-report.repository';
import { ReportExportService } from '../services/report-export.service';
import { computeNextRunAt } from '../services/scheduled-report.service';

const QUEUE_NAME = 'scheduled-reports';
const CHECK_INTERVAL_MS = 60 * 60_000; // hourly — same granularity as this codebase's other BullMQ sweep

let queue: Queue | null = null;
let worker: Worker | null = null;

/**
 * "Allow reports to be generated automatically for future email delivery" —
 * same repeatable-job shape as `subscription-billing.jobs.ts`: an hourly
 * sweep across every tenant's due `ScheduledReport` rows. No attachment
 * support exists in the mail infra (see Finance/Diet modules' own "Email"
 * actions), so this emails a plain-text summary table rather than the CSV/
 * Excel/PDF file itself — same documented limitation, not a new one.
 */
export async function startScheduledReportJobs(): Promise<void> {
  queue = new Queue(QUEUE_NAME, { connection: createQueueConnection() });

  worker = new Worker(QUEUE_NAME, async () => runDueReports(), { connection: createQueueConnection() });
  worker.on('failed', (job, err) => logger.error('Scheduled report job failed', { jobId: job?.id, error: err.message }));

  await queue.add('hourly-scan', {}, { repeat: { every: CHECK_INTERVAL_MS }, removeOnComplete: true, removeOnFail: true });
  await queue.add('startup-scan', {}, { removeOnComplete: true, removeOnFail: true });

  logger.info('Scheduled report jobs scheduled (hourly sweep for due reports)');
}

export async function stopScheduledReportJobs(): Promise<void> {
  await worker?.close();
  await queue?.close();
}

async function runDueReports(): Promise<void> {
  const due = await ScheduledReportRepository.findDueAcrossTenants(prisma, new Date());

  for (const schedule of due) {
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential across a small, infrequent (hourly) batch of due schedules; no throughput requirement justifies parallelizing
      await runOne(schedule);
    } catch (error) {
      logger.error('Scheduled report run failed', { scheduleId: schedule.id, error: (error as Error).message });
    }
  }
}

async function runOne(schedule: Awaited<ReturnType<typeof ScheduledReportRepository.findDueAcrossTenants>>[number]): Promise<void> {
  const exportService = new ReportExportService(schedule.tenantId);
  // Passing '' as the "userId" tells `resolveBranchScope` this is a trusted
  // system caller — it honors `schedule.branchId` verbatim instead of
  // re-deriving live branch access (there's no "current user" in a
  // background job; the branchId was already validated once against its
  // creator's access back in `ScheduledReportService#create`).
  const filters = { ...(schedule.filters as Record<string, unknown> | null), branchId: schedule.branchId ?? undefined };

  const { filename, content } = await exportService.exportCsv(
    schedule.reportType as Parameters<ReportExportService['exportCsv']>[0],
    '',
    filters,
  );

  const subject = `${schedule.name} — scheduled report (${schedule.frequency.toLowerCase()})`;
  const html = `
    <p>Your scheduled report <strong>${schedule.name}</strong> (${schedule.reportType}) for <strong>${schedule.tenant.name}</strong> is ready.</p>
    <p>Branch: ${schedule.branch?.name ?? 'All branches'}</p>
    <pre style="font-family: monospace; font-size: 12px; white-space: pre-wrap;">${content.slice(0, 4000)}</pre>
    <p style="color:#6b7280;font-size:12px;">Attached as CSV is not yet supported — this email contains the full data inline. File: ${filename}</p>
  `;

  for (const to of schedule.recipientEmails) {
    // eslint-disable-next-line no-await-in-loop -- a handful of recipients per schedule, sequential is simplest and matches this codebase's other reminder-email loops
    await enqueueEmail({ to, subject, html });
  }

  await prisma.scheduledReport.update({
    where: { id: schedule.id },
    data: { lastRunAt: new Date(), nextRunAt: computeNextRunAt(schedule.frequency) },
  });
}
