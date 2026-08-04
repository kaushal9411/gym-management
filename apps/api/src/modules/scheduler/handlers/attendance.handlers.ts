import { prisma } from '../../../infrastructure/database/prisma';
import type { JobHandler } from '../types';

const DAY_MS = 86_400_000;

/** Cross-tenant check-in counts for `[from, to)`, grouped by tenant — the shared aggregation behind all three attendance summary jobs (only the window differs). */
async function summarizeAttendance(from: Date, to: Date) {
  const grouped = await prisma.attendance.groupBy({
    by: ['tenantId'],
    where: { attendanceDate: { gte: from, lt: to } },
    _count: { _all: true },
  });
  const totalCheckIns = grouped.reduce((sum, row) => sum + row._count._all, 0);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), tenantsWithActivity: grouped.length, totalCheckIns };
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export const dailyAttendanceSummary: JobHandler = async () => {
  const today = startOfUtcDay(new Date());
  return summarizeAttendance(today, new Date(today.getTime() + DAY_MS));
};

export const weeklyAttendanceSummary: JobHandler = async () => {
  const today = startOfUtcDay(new Date());
  return summarizeAttendance(new Date(today.getTime() - 7 * DAY_MS), today);
};

export const monthlyAttendanceSummary: JobHandler = async () => {
  const now = new Date();
  const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const firstOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return summarizeAttendance(firstOfLastMonth, firstOfThisMonth);
};
