import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

/**
 * Route-level kill-switch coverage. Mounts the REAL routers (same mount paths as
 * `api/v1/router.ts`) behind a stub tenant middleware that sets
 * `req.tenant.featureFlags`, with authentication/authorization/rate-limiting
 * stubbed to pass and infrastructure (prisma/redis/queues) mocked. For every
 * platform flag it asserts:
 *   - flag missing from `featureFlags` -> every probed route answers
 *     403 "This module is currently unavailable." (read AND write, BEFORE
 *     validation/controller code runs);
 *   - flag present -> the gate lets the request through (any other outcome).
 *
 * The member portal (`/portal/*`) is gated per route group with the same middleware
 * (see the second half of this file); the owner dashboard endpoints
 * (`/reports/dashboard/*`) are gated on the `dashboard` plan module, not `reports`.
 */

vi.mock('../../../infrastructure/cache/redis', () => ({
  cache: { get: async () => null, set: async () => undefined, del: async () => undefined, delByPrefix: async () => undefined },
  redis: { get: async () => null, set: async () => 'OK', del: async () => 0, incr: async () => 1, expire: async () => 1, on: () => undefined, call: async () => null },
  disconnectRedis: async () => undefined,
}));
vi.mock('../../../infrastructure/database/prisma', () => ({ prisma: {} }));
vi.mock('../../../infrastructure/database/tenant-scoped-client', () => ({ getTenantScopedClient: () => ({}) }));
vi.mock('../../../infrastructure/queue/connection', () => ({ queueConnection: {}, createQueueConnection: () => ({}) }));
vi.mock('bullmq', () => {
  class Noop {
    add = async () => ({});
    on = () => this;
    close = async () => undefined;
  }
  return { Queue: Noop, Worker: Noop, QueueEvents: Noop, QueueScheduler: Noop, FlowProducer: Noop };
});
vi.mock('../../../infrastructure/realtime/socket-server', () => ({ emitToTenant: () => undefined, initSocketServer: () => undefined }));
vi.mock('../../../core/middleware/rate-limiter', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  const passthrough = () => (_req: Request, _res: Response, next: NextFunction) => next();
  return Object.fromEntries(Object.keys(original).map((k) => [k, passthrough]));
});
vi.mock('../../authentication/middlewares/authenticate.middleware', () => ({
  authenticateMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { auth: unknown }).auth = { sub: 'user-1', tenantId: 'tenant-1', jti: 'j', sid: 's', role: 'OWNER', roles: ['OWNER'], permVer: 1 };
    next();
  },
}));
vi.mock('../../authentication/middlewares/authorize.middleware', () => {
  const passthrough = () => (_req: Request, _res: Response, next: NextFunction) => next();
  return { requirePermission: passthrough, requireRole: passthrough, requireAnyPermission: passthrough };
});
vi.mock('../../member-auth/middlewares/member-authenticate.middleware', () => ({
  memberAuthenticateMiddleware: (req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { memberAuth: unknown }).memberAuth = { sub: 'member-1', tenantId: 'tenant-1', jti: 'j', sid: 's' };
    next();
  },
}));
vi.mock('../../attendance-devices/middlewares/authenticate-device.middleware', () => ({
  authenticateDeviceMiddleware: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

import { aiAssistantRouter } from '../../ai-assistant/routes/ai-assistant.routes';
import { announcementRouter } from '../../announcements/routes/announcement.routes';
import { attendanceRouter } from '../../attendance/routes/attendance.routes';
import { attendanceDeviceRouter } from '../../attendance-devices/routes/attendance-device.routes';
import { devicePunchRouter } from '../../attendance-devices/routes/device-punch.routes';
import { classBookingRouter } from '../../classes/routes/class-booking.routes';
import { classSessionRouter } from '../../classes/routes/class-session.routes';
import { groupClassRouter } from '../../classes/routes/group-class.routes';
import { communicationsRouter } from '../../communications/routes/communications.routes';
import { dietPlanRouter } from '../../diet/routes/diet-plan.routes';
import { foodRouter } from '../../diet/routes/food.routes';
import { expenseRouter } from '../../finance/routes/expense.routes';
import { financeDashboardRouter } from '../../finance/routes/finance-dashboard.routes';
import { incomeRouter } from '../../finance/routes/income.routes';
import { memberInvoiceRouter } from '../../finance/routes/member-invoice.routes';
import { memberPaymentRouter } from '../../finance/routes/member-payment.routes';
import { memberPortalRouter } from '../../member-portal/routes/member-portal.routes';
import { analyticsRouter } from '../../reports/routes/analytics.routes';
import { dashboardRouter } from '../../reports/routes/dashboard.routes';
import { reportsRouter } from '../../reports/routes/reports.routes';
import { scheduledReportRouter } from '../../reports/routes/scheduled-report.routes';
import { ticketRouter } from '../../support/routes/ticket.routes';
import { tenantAnnouncementRouter } from '../../tenant-announcements/routes/tenant-announcement.routes';
import { messageLogRouter } from '../../tenant-notifications/routes/message-log.routes';
import { notificationTemplateRouter } from '../../tenant-notifications/routes/notification-template.routes';
import { tenantNotificationRouter } from '../../tenant-notifications/routes/tenant-notification.routes';
import { exerciseRouter } from '../../workouts/routes/exercise.routes';
import { workoutPlanRouter } from '../../workouts/routes/workout-plan.routes';

const GATE_MESSAGE = 'This module is currently unavailable.';

const ALL_KEYS = [
  'ai_coach',
  'notifications',
  'support_tickets',
  'expenses',
  'income',
  'payments',
  'reports',
  'attendance',
  'diet_plans',
  'live_classes',
  'workout_plans',
] as const;
type FlagKey = (typeof ALL_KEYS)[number];

interface Probe {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
}
interface Surface {
  mount: string;
  router: express.Router;
  probes: Probe[];
}

const get = (path: string): Probe => ({ method: 'get', path });
const post = (path: string): Probe => ({ method: 'post', path });

/** flag -> every tenant-facing router it gates (mount paths mirror api/v1/router.ts), with one read + one write probe each. */
const SURFACES: Record<FlagKey, Surface[]> = {
  ai_coach: [{ mount: '/ai', router: aiAssistantRouter, probes: [get('/config'), get('/conversations'), post('/conversations')] }],
  notifications: [
    { mount: '/notifications/templates', router: notificationTemplateRouter, probes: [get('/')] },
    { mount: '/notifications/message-log', router: messageLogRouter, probes: [get('/')] },
    { mount: '/notifications', router: tenantNotificationRouter, probes: [get('/'), get('/unread-count'), post('/read-all')] },
    { mount: '/announcements', router: announcementRouter, probes: [get('/active')] },
    { mount: '/tenant-announcements', router: tenantAnnouncementRouter, probes: [get('/'), post('/')] },
    { mount: '/communications', router: communicationsRouter, probes: [get('/overview'), post('/campaigns')] },
  ],
  support_tickets: [{ mount: '/support/tickets', router: ticketRouter, probes: [get('/'), get('/stats'), post('/')] }],
  expenses: [{ mount: '/expenses', router: expenseRouter, probes: [get('/'), post('/')] }],
  income: [{ mount: '/income', router: incomeRouter, probes: [get('/'), post('/')] }],
  payments: [
    { mount: '/payments', router: memberPaymentRouter, probes: [get('/'), post('/')] },
    { mount: '/invoices', router: memberInvoiceRouter, probes: [get('/'), post('/')] },
    { mount: '/finance', router: financeDashboardRouter, probes: [get('/summary')] },
  ],
  reports: [
    { mount: '/reports/scheduled', router: scheduledReportRouter, probes: [get('/'), post('/')] },
    { mount: '/reports', router: reportsRouter, probes: [get('/overview'), get('/attendance'), get('/revenue')] },
    { mount: '/analytics', router: analyticsRouter, probes: [get('/revenue-trends')] },
  ],
  attendance: [
    { mount: '/attendance', router: attendanceRouter, probes: [get('/today'), post('/check-in')] },
    { mount: '/attendance-devices', router: attendanceDeviceRouter, probes: [get('/'), post('/')] },
    { mount: '/attendance-devices/punches', router: devicePunchRouter, probes: [post('/')] },
  ],
  diet_plans: [
    { mount: '/diet-plans', router: dietPlanRouter, probes: [get('/assignable')] },
    { mount: '/foods', router: foodRouter, probes: [get('/'), post('/')] },
  ],
  live_classes: [
    { mount: '/classes', router: groupClassRouter, probes: [get('/'), post('/')] },
    { mount: '/class-sessions', router: classSessionRouter, probes: [get('/'), post('/generate')] },
    { mount: '/bookings', router: classBookingRouter, probes: [post('/')] },
  ],
  workout_plans: [
    { mount: '/workout-plans', router: workoutPlanRouter, probes: [get('/assignable')] },
    { mount: '/exercises', router: exerciseRouter, probes: [get('/'), post('/')] },
  ],
};

function buildApp(flags: string[], mount: string, router: express.Router) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.tenant = { id: 'tenant-1', slug: 'gym', featureFlags: flags } as unknown as Request['tenant'];
    next();
  });
  app.use(mount, router);
  // Anything the controllers throw (mocked-out infra) is reported as 599 "gate passed, handler failed" — never a gate 403.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const e = err as { httpStatus?: number; message?: string };
    if (e.httpStatus && e.message === GATE_MESSAGE) {
      res.status(e.httpStatus).json({ message: e.message });
      return;
    }
    res.status(599).json({ message: e.message ?? 'handler error' });
  });
  return app;
}

async function hit(app: express.Express, probe: Probe, mount: string) {
  const url = `${mount}${probe.path === '/' ? '' : probe.path}` || '/';
  const agent = request(app)[probe.method](url);
  return probe.method === 'get' ? agent : agent.send({});
}

const isGateBlock = (res: { status: number; body: { message?: string } }) => res.status === 403 && res.body?.message === GATE_MESSAGE;

describe('requireModuleEnabled — every gated router, per flag', () => {
  describe.each(ALL_KEYS)('%s', (key) => {
    const surfaces = SURFACES[key];
    const flagsWithout = ALL_KEYS.filter((k) => k !== key) as string[];
    const flagsWith = [...ALL_KEYS] as string[];

    for (const surface of surfaces) {
      for (const probe of surface.probes) {
        const label = `${probe.method.toUpperCase()} ${surface.mount}${probe.path === '/' ? '' : probe.path}`;

        it(`DISABLED -> 403 "${GATE_MESSAGE}" : ${label}`, async () => {
          const res = await hit(buildApp(flagsWithout, surface.mount, surface.router), probe, surface.mount);
          expect(res.status).toBe(403);
          expect(res.body.message).toBe(GATE_MESSAGE);
        });

        it(`ENABLED  -> gate passes : ${label}`, async () => {
          const res = await hit(buildApp(flagsWith, surface.mount, surface.router), probe, surface.mount);
          expect(isGateBlock(res)).toBe(false);
        });
      }
    }

    it('disabling OTHER flags never blocks this flag’s routes', async () => {
      const surface = surfaces[0]!;
      const others = ALL_KEYS.filter((k) => k !== key);
      const flags = [key, ...others.slice(0, 3)] as string[];
      const res = await hit(buildApp(flags, surface.mount, surface.router), surface.probes[0]!, surface.mount);
      expect(isGateBlock(res)).toBe(false);
    });
  });
});

const UUID = '11111111-1111-1111-1111-111111111111';

/**
 * Member portal (`/portal/*`): each feature route group answers the same 403 when its module is off, BEFORE validation
 * or the handler. Probes cover every route of every gated group (reads + writes + checkout legs + device-token).
 */
const MEMBER_PORTAL_PROBES: Array<{ flag: FlagKey; probes: Probe[] }> = [
  {
    flag: 'workout_plans',
    probes: [get('/workout'), post(`/workout/${UUID}/progress`), get('/workout/log'), post('/workout/log')],
  },
  { flag: 'diet_plans', probes: [get('/diet'), post(`/diet/${UUID}/log`)] },
  {
    flag: 'live_classes',
    probes: [get('/classes'), get('/bookings'), post(`/classes/${UUID}/book`), post(`/bookings/${UUID}/cancel`)],
  },
  { flag: 'attendance', probes: [get('/attendance')] },
  {
    flag: 'payments',
    probes: [
      get('/payments'),
      get('/invoices'),
      get(`/invoices/${UUID}`),
      get(`/invoices/${UUID}/download`),
      post(`/invoices/${UUID}/pay/checkout`),
      post(`/invoices/${UUID}/pay/checkout/${UUID}/verify`),
      post('/membership/renew/checkout'),
      post(`/membership/renew/checkout/${UUID}/verify`),
    ],
  },
  {
    flag: 'notifications',
    probes: [
      get('/notifications'),
      get('/notifications/unread-count'),
      post('/notifications/read-all'),
      post(`/notifications/${UUID}/read`),
      get('/notification-preferences'),
      post('/device-token'),
      { method: 'delete', path: '/device-token' },
    ],
  },
];

/** Member routes no module owns: they must keep working with every flag off. */
const MEMBER_PORTAL_UNGATED: Probe[] = [get('/me'), get('/profile'), get('/gym'), get('/plan'), get('/overview'), get('/measurements'), get('/gdpr-export')];

describe('member portal kill switch', () => {
  for (const { flag, probes } of MEMBER_PORTAL_PROBES) {
    describe(flag, () => {
      for (const probe of probes) {
        const label = `${probe.method.toUpperCase()} /portal${probe.path}`;
        it(`${flag} disabled -> 403 "${GATE_MESSAGE}" : ${label}`, async () => {
          const flags = ALL_KEYS.filter((k) => k !== flag) as string[];
          const res = await hit(buildApp(flags, '/portal', memberPortalRouter), probe, '/portal');
          expect(res.status).toBe(403);
          expect(res.body.message).toBe(GATE_MESSAGE);
        });
        it(`${flag} enabled -> gate passes : ${label}`, async () => {
          const res = await hit(buildApp([...ALL_KEYS] as string[], '/portal', memberPortalRouter), probe, '/portal');
          expect(isGateBlock(res)).toBe(false);
        });
      }
    });
  }

  it('every module off at once: the ungated member routes (profile, plan, gym, overview, ...) still pass the gate', async () => {
    const app = buildApp([], '/portal', memberPortalRouter);
    for (const probe of MEMBER_PORTAL_UNGATED) {
      const res = await hit(app, probe, '/portal');
      expect(isGateBlock(res), `GET /portal${probe.path}`).toBe(false);
    }
  });

  it('disabling one module never blocks another module’s member routes', async () => {
    const flags = ALL_KEYS.filter((k) => k !== 'diet_plans') as string[];
    const app = buildApp(flags, '/portal', memberPortalRouter);
    for (const probe of [get('/workout'), get('/classes'), get('/attendance'), get('/payments'), get('/notifications')]) {
      expect(isGateBlock(await hit(app, probe, '/portal')), probe.path).toBe(false);
    }
  });
});

/**
 * Owner dashboard endpoints are gated on the `dashboard` plan module, no longer on `reports`.
 * (`/reports/*` proper and `/analytics/*` stay on `reports` - see docs/FEATURE-FLAGS-AUDIT.md.)
 */
describe('dashboard re-gating', () => {
  const probes = [get('/summary'), get('/kpis'), get('/recent-activities')];
  const mount = '/reports/dashboard';

  for (const probe of probes) {
    it(`dashboard module missing -> 403 even with reports on : GET ${mount}${probe.path}`, async () => {
      const res = await hit(buildApp([...ALL_KEYS] as string[], mount, dashboardRouter), probe, mount);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe(GATE_MESSAGE);
    });
    it(`dashboard on, reports OFF -> gate passes : GET ${mount}${probe.path}`, async () => {
      const flags = ['dashboard', ...ALL_KEYS.filter((k) => k !== 'reports')];
      expect(isGateBlock(await hit(buildApp(flags, mount, dashboardRouter), probe, mount))).toBe(false);
    });
  }

  it('/reports/* proper is still gated on reports (dashboard alone is not enough)', async () => {
    const flags = ['dashboard', ...ALL_KEYS.filter((k) => k !== 'reports')];
    const res = await hit(buildApp(flags, '/reports', reportsRouter), get('/overview'), '/reports');
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(GATE_MESSAGE);
  });

  it('/analytics/* stays on reports (plan matrix: Professional has reports but not analytics)', async () => {
    const flags = ['analytics', 'dashboard', ...ALL_KEYS.filter((k) => k !== 'reports')];
    const res = await hit(buildApp(flags, '/analytics', analyticsRouter), get('/revenue-trends'), '/analytics');
    expect(res.status).toBe(403);
    const ok = await hit(buildApp(['reports'], '/analytics', analyticsRouter), get('/revenue-trends'), '/analytics');
    expect(isGateBlock(ok)).toBe(false);
  });
});
