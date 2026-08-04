import { prisma } from '../../../infrastructure/database/prisma';
import { enqueueEmail } from '../../../infrastructure/queue/email.queue';
import { ScheduledReportRepository } from '../../reports/repositories/scheduled-report.repository';
import { ReportExportService } from '../../reports/services/report-export.service';
import { computeNextRunAt } from '../../reports/services/scheduled-report.service';
import type { JobHandler } from '../types';

const DAY_MS = 86_400_000;

/**
 * Migrated from the old `scheduled-reports.jobs.ts` module-local BullMQ
 * registration — identical `runDueReports`/`runOne` logic (including the
 * documented "no attachment support" plain-text-table limitation), now
 * triggered by this module's registry instead of its own `repeat`.
 */
export const tenantScheduledReportsDispatch: JobHandler = async () => {
  const due = await ScheduledReportRepository.findDueAcrossTenants(prisma, new Date());
  let succeeded = 0;
  let failed = 0;

  for (const schedule of due) {
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential across a small, infrequent (hourly) batch of due schedules; no throughput requirement justifies parallelizing
      await runOne(schedule);
      succeeded += 1;
    } catch {
      failed += 1;
    }
  }
  return { scanned: due.length, succeeded, failed };
};

async function runOne(schedule: Awaited<ReturnType<typeof ScheduledReportRepository.findDueAcrossTenants>>[number]): Promise<void> {
  const exportService = new ReportExportService(schedule.tenantId);
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

/** Platform-level (FitCloud's own) revenue for the day — successful subscription payments across every tenant, grouped by currency. */
export const dailyRevenueSummary: JobHandler = async () => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const grouped = await prisma.payment.groupBy({
    by: ['currency'],
    where: { status: 'SUCCEEDED', createdAt: { gte: today } },
    _sum: { amount: true },
    _count: { _all: true },
  });
  return {
    date: today.toISOString().slice(0, 10),
    byCurrency: grouped.map((row) => ({ currency: row.currency, total: row._sum.amount?.toString() ?? '0', count: row._count._all })),
  };
};

/** Cross-tenant branch-level rollup for the past 7 days: member revenue + attendance volume, top 20 branches by revenue. */
export const weeklyBranchPerformanceReport: JobHandler = async () => {
  const since = new Date(Date.now() - 7 * DAY_MS);
  const [revenueByBranch, attendanceByBranch] = await Promise.all([
    prisma.memberPayment.groupBy({ by: ['branchId'], where: { status: 'SUCCESS', createdAt: { gte: since } }, _sum: { finalAmount: true } }),
    prisma.attendance.groupBy({ by: ['branchId'], where: { attendanceDate: { gte: since } }, _count: { _all: true } }),
  ]);

  const attendanceByBranchId = new Map(attendanceByBranch.map((row) => [row.branchId, row._count._all]));
  const topBranches = revenueByBranch
    .map((row) => ({ branchId: row.branchId, revenue: row._sum.finalAmount?.toString() ?? '0', checkIns: attendanceByBranchId.get(row.branchId) ?? 0 }))
    .sort((a, b) => Number(b.revenue) - Number(a.revenue))
    .slice(0, 20);

  return { since: since.toISOString().slice(0, 10), branchesReported: revenueByBranch.length, topBranches };
};

/** Monthly platform-wide rollup: prior calendar month's revenue + attendance totals in one snapshot. */
export const monthlyReportsRollup: JobHandler = async () => {
  const now = new Date();
  const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const firstOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  const [revenue, attendanceCount] = await Promise.all([
    prisma.payment.aggregate({ where: { status: 'SUCCEEDED', createdAt: { gte: firstOfLastMonth, lt: firstOfThisMonth } }, _sum: { amount: true } }),
    prisma.attendance.count({ where: { attendanceDate: { gte: firstOfLastMonth, lt: firstOfThisMonth } } }),
  ]);

  return {
    month: firstOfLastMonth.toISOString().slice(0, 7),
    platformRevenue: revenue._sum.amount?.toString() ?? '0',
    totalCheckIns: attendanceCount,
  };
};
