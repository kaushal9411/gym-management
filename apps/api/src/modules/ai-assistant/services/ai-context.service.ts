import { getTenantScopedClient } from '../../../infrastructure/database/tenant-scoped-client';

const DAY_MS = 86_400_000;

interface ContextSection {
  /** The exact permission key that must be present for this section to be included — mirrors "Never expose unauthorized tenant data": a user without `finance:view` never sees revenue numbers in their own AI context, even indirectly via a summary. */
  permission: string;
  build: (db: ReturnType<typeof getTenantScopedClient>, tenantId: string) => Promise<string>;
}

const SECTIONS: ContextSection[] = [
  {
    permission: 'members:view',
    build: async (db) => {
      const [total, active] = await Promise.all([db.member.count(), db.member.count({ where: { status: 'ACTIVE' } })]);
      return `Members: ${total} total, ${active} active.`;
    },
  },
  {
    permission: 'staff:view',
    build: async (db) => {
      const total = await db.staffProfile.count();
      return `Staff: ${total} staff profiles on record.`;
    },
  },
  {
    permission: 'branches:view',
    build: async (db) => {
      const branches = await db.branch.findMany({ where: { deletedAt: null }, select: { name: true, isActive: true }, take: 20 });
      return `Branches (${branches.length}): ${branches.map((b) => `${b.name}${b.isActive ? '' : ' (inactive)'}`).join(', ') || 'none yet'}.`;
    },
  },
  {
    permission: 'memberships:view',
    build: async (db) => {
      const windowEnd = new Date(Date.now() + 7 * DAY_MS);
      const [active, expiringSoon] = await Promise.all([
        db.membership.count({ where: { status: 'ACTIVE' } }),
        db.membership.count({ where: { status: 'ACTIVE', endDate: { gte: new Date(), lte: windowEnd } } }),
      ]);
      return `Memberships: ${active} active, ${expiringSoon} expiring within 7 days.`;
    },
  },
  {
    permission: 'attendance:view',
    build: async (db) => {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const checkInsToday = await db.attendance.count({ where: { attendanceDate: { gte: todayStart } } });
      return `Attendance: ${checkInsToday} check-in(s) today.`;
    },
  },
  {
    permission: 'workouts:view',
    build: async (db) => {
      const [plans, assigned] = await Promise.all([db.workoutPlan.count({ where: { deletedAt: null } }), db.memberWorkoutPlan.count({ where: { endDate: null } })]);
      return `Workout: ${plans} workout plan(s) in the library, ${assigned} member(s) currently assigned one.`;
    },
  },
  {
    permission: 'diets:view',
    build: async (db) => {
      const [plans, assigned] = await Promise.all([db.dietPlan.count({ where: { deletedAt: null } }), db.memberDietPlan.count({ where: { endDate: null } })]);
      return `Diet: ${plans} diet plan(s) in the library, ${assigned} member(s) currently assigned one.`;
    },
  },
  {
    permission: 'finance:view',
    build: async (db) => {
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const [revenue, outstanding] = await Promise.all([
        db.memberPayment.aggregate({ where: { status: 'SUCCESS', createdAt: { gte: monthStart } }, _sum: { finalAmount: true } }),
        db.memberInvoice.count({ where: { status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } } }),
      ]);
      return `Finance: ${revenue._sum.finalAmount?.toString() ?? '0'} collected this month, ${outstanding} outstanding invoice(s).`;
    },
  },
  {
    permission: 'reports:view',
    build: async (db) => {
      const scheduled = await db.scheduledReport.count({ where: { isActive: true } });
      return `Reports: ${scheduled} scheduled report(s) configured; on-demand reports (attendance, revenue, branch performance, member growth) are available via the Reports Center.`;
    },
  },
  {
    permission: 'notifications:view',
    build: async (db) => {
      const unread = await db.tenantNotification.count({ where: { readAt: null } });
      return `Notifications: ${unread} unread in the Notification Center.`;
    },
  },
  {
    permission: 'settings:read',
    build: async (db, tenantId) => {
      const settings = await db.tenantSettings.findUnique({ where: { tenantId }, select: { timezone: true, currency: true } });
      return `Settings: timezone ${settings?.timezone ?? 'UTC'}, currency ${settings?.currency ?? 'USD'}.`;
    },
  },
];

/**
 * Builds the "what this gym currently looks like" block injected into the
 * system prompt — permission-gated per section so a role missing e.g.
 * `finance:view` never gets revenue figures surfaced through the AI either,
 * closing the same gap `requirePermission` closes for the REST API itself.
 * Read-only, best-effort: one section's query failing (a rare edge case,
 * not expected in practice) doesn't take down the whole context block.
 */
export async function buildTenantContext(tenantId: string, tenantName: string, permissions: string[]): Promise<string> {
  const db = getTenantScopedClient(tenantId);
  const permissionSet = new Set(permissions);

  const lines = await Promise.all(
    SECTIONS.filter((section) => permissionSet.has(section.permission)).map(async (section) => {
      try {
        return await section.build(db, tenantId);
      } catch {
        return null;
      }
    }),
  );

  const body = lines.filter((line): line is string => line != null).join('\n');
  return `Current snapshot of ${tenantName} (only sections the current user has permission to view are included):\n${body || '(No context sections available for this user\'s permissions.)'}`;
}
