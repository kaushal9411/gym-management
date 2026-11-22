import { prisma } from '../../../infrastructure/database/prisma';
import { moduleGate } from '../../tenants/utils/module-enabled.util';
import type { JobHandler } from '../types';

const DAY_MS = 86_400_000;

/**
 * Cross-tenant check-in counts for `[from, to)`, grouped by tenant — the shared aggregation behind all three attendance summary jobs (only the window differs).
 * Tenants with the `attendance` module switched off are left out of the summary (per tenant, fail-open).
 */
async function summarizeAttendance(from: Date, to: Date, job: string) {
  const allGroups = await prisma.attendance.groupBy({
    by: ['tenantId'],
    where: { attendanceDate: { gte: from, lt: to } },
    _count: { _all: true },
  });
  const attendanceEnabled = moduleGate('attendance', job);
  const enabledFlags = await Promise.all(allGroups.map((row) => attendanceEnabled(row.tenantId)));
  const grouped = allGroups.filter((_, index) => enabledFlags[index]);
  const totalCheckIns = grouped.reduce((sum, row) => sum + row._count._all, 0);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), tenantsWithActivity: grouped.length, totalCheckIns };
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export const dailyAttendanceSummary: JobHandler = async () => {
  const today = startOfUtcDay(new Date());
  return summarizeAttendance(today, new Date(today.getTime() + DAY_MS), 'daily-attendance-summary');
};

export const weeklyAttendanceSummary: JobHandler = async () => {
  const today = startOfUtcDay(new Date());
  return summarizeAttendance(new Date(today.getTime() - 7 * DAY_MS), today, 'weekly-attendance-summary');
};

export const monthlyAttendanceSummary: JobHandler = async () => {
  const now = new Date();
  const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const firstOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return summarizeAttendance(firstOfLastMonth, firstOfThisMonth, 'monthly-attendance-summary');
};
