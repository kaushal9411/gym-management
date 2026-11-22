import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Feature flags x scheduler job handlers (and the campaign queue jobs they feed). Hermetic: prisma, the per-module services,
 * redis and the tenant flag read are mocked. For every job: the tenant with the governing module OFF is skipped, the tenant
 * with it ON is processed in the SAME run (per-tenant, never global), and an unreadable flag fails open.
 *
 * The automation-rule sweeps (reminders, birthdays, we-miss-you, class reminders) are covered in
 * `communications/services/automation-sweeps.flags.spec.ts`; the helper itself in `tenants/utils/module-enabled.util.spec.ts`.
 */

const OFF = 'tenant-off';
const ON = 'tenant-on';
const BROKEN = 'tenant-broken';

const state = vi.hoisted(() => ({
  flags: {} as Record<string, string[] | 'throw'>,
  generatedFor: [] as string[],
  invoicesFor: [] as string[],
  attendanceGroups: [] as Array<{ tenantId: string; _count: { _all: number } }>,
  dueSchedules: [] as Array<Record<string, unknown>>,
  emailsFor: [] as string[],
  scheduleUpdates: [] as string[],
  dueAnnouncements: [] as Array<Record<string, unknown>>,
  expiringAnnouncements: [] as Array<Record<string, unknown>>,
  announcementUpdates: [] as Array<{ id: string; status: string }>,
  announcementsPublishedFor: [] as string[],
  campaigns: { due: [] as Array<Record<string, unknown>>, sending: [] as Array<Record<string, unknown>> },
  campaignsStarted: [] as string[],
  scopedClientFor: [] as string[],
}));

vi.mock('../../../core/logging/logger', () => ({ logger: { warn: () => undefined, debug: () => undefined, info: () => undefined, error: () => undefined } }));
vi.mock('../../../infrastructure/cache/redis', () => ({ cache: { get: async () => null, set: async () => undefined, del: async () => undefined } }));
vi.mock('../../tenants/service/tenant.service', () => ({
  tenantService: {
    resolveById: async (tenantId: string) => {
      const flags = state.flags[tenantId];
      if (flags === 'throw') throw new Error('redis down');
      return { id: tenantId, featureFlags: flags ?? [] };
    },
  },
}));
vi.mock('../../../infrastructure/database/prisma', () => ({
  prisma: {
    tenant: { findMany: async () => [{ id: OFF }, { id: ON }, { id: BROKEN }] },
    attendance: { groupBy: async () => state.attendanceGroups },
    membership: {
      findMany: async () =>
        [OFF, ON].map((tenantId) => ({
          id: `ms-${tenantId}`,
          tenantId,
          memberId: `m-${tenantId}`,
          endDate: new Date(Date.now() + 86_400_000),
          member: { branchId: 'b1' },
          plan: { name: 'Gold', price: 100 },
        })),
    },
    scheduledReport: { update: async ({ where }: { where: { id: string } }) => void state.scheduleUpdates.push(where.id) },
    tenantAnnouncement: { update: async ({ where, data }: { where: { id: string }; data: { status: string } }) => void state.announcementUpdates.push({ id: where.id, status: data.status }) },
    notificationCampaign: {
      findMany: async ({ where }: { where: { status: string } }) => (where.status === 'SCHEDULED' ? state.campaigns.due : state.campaigns.sending),
      updateMany: async () => ({ count: 1 }),
    },
    notificationCampaignRecipient: { count: async () => 0, findMany: async () => [] },
  },
}));
vi.mock('../../../infrastructure/database/tenant-scoped-client', () => ({
  getTenantScopedClient: (tenantId: string) => {
    state.scopedClientFor.push(tenantId);
    return { notificationCampaign: { findFirst: async () => null } };
  },
}));
vi.mock('../../../infrastructure/queue/communications.queue', () => ({
  enqueueCampaignStart: async (tenantId: string) => void state.campaignsStarted.push(tenantId),
  enqueueCampaignBatch: async () => undefined,
}));
vi.mock('../../../infrastructure/mail/branding', () => ({ loadEmailBranding: async () => ({ tenantName: 'Gym' }) }));
vi.mock('../../classes/services/class-session.service', () => ({
  ClassSessionService: class {
    constructor(private readonly tenantId: string) {}
    async generateUpcomingSessions() {
      state.generatedFor.push(this.tenantId);
      return { created: 2 };
    }
  },
}));
vi.mock('../../finance/repositories/member-invoice.repository', () => ({
  MemberInvoiceRepository: class {
    async nextInvoiceNumber() {
      return 'INV-1';
    }
    async create(data: { tenantId: string }) {
      state.invoicesFor.push(data.tenantId);
    }
  },
}));
vi.mock('../../communications/services/automation-sweeps.service', () => ({
  sweepInvoiceDueSoon: async () => ({}),
  sweepPaymentFailed: async () => ({}),
  sweepPaymentOverdue: async () => ({}),
  sweepBirthdays: async () => ({}),
  sweepClassReminders: async () => ({}),
  sweepWeMissYou: async () => ({}),
  sweepMembershipExpired: async () => ({}),
  sweepMembershipExpiring: async () => ({}),
}));
vi.mock('../../reports/repositories/scheduled-report.repository', () => ({
  ScheduledReportRepository: { findDueAcrossTenants: async () => state.dueSchedules },
}));
vi.mock('../../reports/services/report-export.service', () => ({
  ReportExportService: class {
    async exportCsv() {
      return { filename: 'r.csv', content: 'a,b\n1,2' };
    }
  },
}));
vi.mock('../../reports/services/scheduled-report.service', () => ({ computeNextRunAt: () => new Date() }));
vi.mock('../../tenant-notifications/services/channel-gate.service', () => ({
  sendGatedEmail: async (tenantId: string) => void state.emailsFor.push(tenantId),
}));
vi.mock('../../tenant-announcements/repositories/tenant-announcement.repository', () => ({
  TenantAnnouncementRepository: {
    findDuePublications: async () => state.dueAnnouncements,
    findDueExpirations: async () => state.expiringAnnouncements,
  },
}));
vi.mock('../../tenant-notifications/services/notification-trigger.service', () => ({
  notifyAnnouncementPublished: async (tenantId: string) => void state.announcementsPublishedFor.push(tenantId),
  notifyNewMemberRegistration: async () => undefined,
  welcomeSentCacheKey: (id: string) => `welcome:${id}`,
}));
vi.mock('../../admin-notifications/services/admin-notification.service', () => ({ dispatchNotification: async () => undefined }));
vi.mock('../../members/utils/member-pii.util', () => ({ decryptMemberContactMany: (rows: unknown[]) => rows }));

import { runCampaignBatch, startCampaign } from '../../communications/services/campaign-dispatch.service';
import { runCommunicationsDispatch } from '../../communications/services/campaign-sweeper.service';

import { dailyAttendanceSummary, monthlyAttendanceSummary, weeklyAttendanceSummary } from './attendance.handlers';
import { classSessionGeneration } from './class-session.handlers';
import { sendScheduledAnnouncements } from './notification.handlers';
import { invoiceGeneration } from './payment.handlers';
import { tenantScheduledReportsDispatch } from './report.handlers';

const run = (handler: unknown) => (handler as (ctx?: unknown) => Promise<Record<string, unknown>>)({});

beforeEach(() => {
  state.flags = {
    [OFF]: ['members'],
    [ON]: ['live_classes', 'payments', 'reports', 'notifications', 'attendance'],
    [BROKEN]: 'throw',
  };
  state.generatedFor = [];
  state.invoicesFor = [];
  state.attendanceGroups = [OFF, ON, BROKEN].map((tenantId) => ({ tenantId, _count: { _all: 10 } }));
  state.dueSchedules = [];
  state.emailsFor = [];
  state.scheduleUpdates = [];
  state.dueAnnouncements = [];
  state.expiringAnnouncements = [];
  state.announcementUpdates = [];
  state.announcementsPublishedFor = [];
  state.campaigns = { due: [], sending: [] };
  state.campaignsStarted = [];
  state.scopedClientFor = [];
});

describe('live_classes — class-session-generation', () => {
  it('generates only for tenants with live_classes on (per tenant), and fails open for an unreadable flag', async () => {
    const result = await run(classSessionGeneration);
    expect(state.generatedFor).toEqual([ON, BROKEN]);
    expect(result).toMatchObject({ tenantsScanned: 3, tenantsSkipped: 1, sessionsCreated: 4 });
  });
});

describe('payments — invoice-generation', () => {
  it('creates renewal invoices only for tenants with payments on', async () => {
    const result = await run(invoiceGeneration);
    expect(state.invoicesFor).toEqual([ON]);
    expect(result).toMatchObject({ scanned: 2, generated: 1 });
  });
});

describe('attendance — attendance summary jobs', () => {
  it.each([
    ['daily', dailyAttendanceSummary],
    ['weekly', weeklyAttendanceSummary],
    ['monthly', monthlyAttendanceSummary],
  ])('%s summary leaves out tenants with attendance off (fail-open for unreadable flags)', async (_name, handler) => {
    const result = await run(handler);
    expect(result).toMatchObject({ tenantsWithActivity: 2, totalCheckIns: 20 });
  });
});

describe('reports — tenant-scheduled-reports-dispatch', () => {
  const schedule = (tenantId: string) => ({
    id: `sch-${tenantId}`,
    tenantId,
    name: 'Weekly',
    reportType: 'membership',
    frequency: 'WEEKLY',
    filters: null,
    branchId: null,
    branch: null,
    recipientEmails: ['owner@example.test'],
    tenant: { name: 'Gym' },
  });

  it('runs due schedules only for tenants with reports on, and leaves a skipped schedule untouched (nextRunAt not advanced)', async () => {
    state.dueSchedules = [schedule(OFF), schedule(ON)];
    const result = await run(tenantScheduledReportsDispatch);
    expect(state.emailsFor).toEqual([ON]);
    expect(state.scheduleUpdates).toEqual([`sch-${ON}`]);
    expect(result).toMatchObject({ scanned: 2, succeeded: 1, skipped: 1 });
  });
});

describe('notifications — send-scheduled-announcements', () => {
  it('publishes and expires announcements only for tenants with notifications on', async () => {
    state.dueAnnouncements = [OFF, ON].map((tenantId) => ({ id: `a-${tenantId}`, tenantId, title: 't', body: '<p>b</p>', audience: 'ALL', branchId: null }));
    state.expiringAnnouncements = [OFF, ON].map((tenantId) => ({ id: `e-${tenantId}`, tenantId }));
    const result = await run(sendScheduledAnnouncements);
    expect(state.announcementsPublishedFor).toEqual([ON]);
    expect(state.announcementUpdates).toEqual([
      { id: `a-${ON}`, status: 'PUBLISHED' },
      { id: `e-${ON}`, status: 'EXPIRED' },
    ]);
    expect(result).toMatchObject({ published: 1, expired: 1, skipped: 2 });
  });
});

describe('notifications — campaign dispatch (communications-dispatch sweep + queue jobs)', () => {
  it('the minute sweep starts due campaigns only for tenants with notifications on', async () => {
    state.campaigns.due = [OFF, ON].map((tenantId) => ({ id: `c-${tenantId}`, tenantId }));
    const result = await runCommunicationsDispatch();
    expect(state.campaignsStarted).toEqual([ON]);
    expect(result.started).toBe(1);
  });

  it('the start / batch queue jobs do nothing (no DB access) for a tenant with notifications off, and run for one with it on', async () => {
    await startCampaign(OFF, 'c1');
    await runCampaignBatch(OFF, 'c1');
    expect(state.scopedClientFor).toEqual([]);

    await startCampaign(ON, 'c1');
    await runCampaignBatch(ON, 'c1');
    expect(state.scopedClientFor).toContain(ON);
  });

  it('fails open: an unreadable flag still lets the campaign jobs run', async () => {
    await startCampaign(BROKEN, 'c1');
    expect(state.scopedClientFor).toContain(BROKEN);
  });
});
