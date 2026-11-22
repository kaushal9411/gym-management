import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

/**
 * Hermetic behaviour specs for the flag-aware aggregates and the payment-link webhook
 * (docs/FEATURE-FLAGS-AUDIT.md, API gaps 1/3/4). Infrastructure and repositories are mocked; the REAL services/controller run.
 *   - GET /portal/overview: sections of a disabled module are not queried, nullable ones are null, the always-present ones are
 *     zeroed (older web/Dart clients keep parsing), `disabledModules` lists the keys; all flags on -> unchanged + `[]`.
 *   - dashboard KPIs / recent activities and /finance/summary: same present-but-zeroed + `disabledModules` contract.
 *   - /webhook/razorpay-payment-link: tenant with `payments` off -> nothing recorded, 200, structured warning.
 */

const TENANT = '00000000-0000-0000-0000-0000000000aa';
const MEMBER = '11111111-1111-1111-1111-111111111111';

const h = vi.hoisted(() => ({
  repo: {} as Record<string, Mock>,
  workouts: {} as Record<string, Mock>,
  diets: {} as Record<string, Mock>,
  incomeRepo: {} as Record<string, Mock>,
  expenseRepo: {} as Record<string, Mock>,
  paymentRepo: {} as Record<string, Mock>,
  db: {} as Record<string, Record<string, Mock>>,
  resolveById: vi.fn(),
  verifySignature: vi.fn(),
  prismaMemberPayment: { findUnique: vi.fn() },
  prismaPayment: { findUnique: vi.fn() },
  applyMember: vi.fn(),
  applyPlatform: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../../infrastructure/database/tenant-scoped-client', () => ({ getTenantScopedClient: () => h.db }));
vi.mock('../../infrastructure/database/prisma', () => ({
  prisma: { memberPayment: h.prismaMemberPayment, payment: h.prismaPayment },
}));
vi.mock('../../core/logging/logger', () => ({ logger: { warn: h.warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('./service/tenant.service', () => ({ tenantService: { resolveById: h.resolveById } }));
vi.mock('../member-portal/repositories/member-portal.repository', () => ({
  MemberPortalRepository: class {
    constructor() {
      return h.repo;
    }
  },
}));
vi.mock('../workouts/repositories/member-workout-plan.repository', () => ({
  MemberWorkoutPlanRepository: class {
    constructor() {
      return h.workouts;
    }
  },
}));
vi.mock('../diet/repositories/member-diet-plan.repository', () => ({
  MemberDietPlanRepository: class {
    constructor() {
      return h.diets;
    }
  },
}));
vi.mock('../finance/services/member-invoice.service', () => ({ MemberInvoiceService: class {} }));
vi.mock('../finance/repositories/income.repository', () => ({
  IncomeRepository: class {
    constructor() {
      return h.incomeRepo;
    }
  },
}));
vi.mock('../finance/repositories/expense.repository', () => ({
  ExpenseRepository: class {
    constructor() {
      return h.expenseRepo;
    }
  },
}));
vi.mock('../finance/repositories/member-payment.repository', () => ({
  MemberPaymentRepository: class {
    constructor() {
      return h.paymentRepo;
    }
  },
}));
vi.mock('../reports/utils/branch-scope.util', () => ({ resolveBranchScope: async () => 'branch-1' }));
vi.mock('../finance/services/razorpay-gateway.service', () => ({ verifyWebhookSignature: h.verifySignature }));
vi.mock('../finance/services/member-payment.service', () => ({
  MemberPaymentService: class {
    applyWebhookOutcome = h.applyMember;
  },
}));
vi.mock('../admin-tenants/services/admin-tenant-billing.service', () => ({
  AdminTenantBillingService: class {
    applyWebhookOutcome = h.applyPlatform;
  },
}));

import { razorpayWebhookController } from '../finance/controllers/razorpay-webhook.controller';
import { FinanceDashboardService } from '../finance/services/finance-dashboard.service';
import { MemberOverviewService } from '../member-portal/services/member-overview.service';
import { DashboardService } from '../reports/services/dashboard.service';

const ALL = [
  'attendance',
  'workout_plans',
  'diet_plans',
  'payments',
  'income',
  'expenses',
  'live_classes',
  'notifications',
  'reports',
  'dashboard',
];
const without = (...keys: string[]) => ALL.filter((k) => !keys.includes(k));
const fn = () => vi.fn();

// ───────────────────────── member portal overview ─────────────────────────

function wireOverviewRepos() {
  h.repo.findMember = fn().mockResolvedValue({
    id: MEMBER,
    memberId: 'MEM-0007',
    firstName: 'Sneha',
    lastName: 'Kulkarni',
    profilePhotoUrl: null,
    joiningDate: new Date('2026-01-05'),
    branch: { id: 'b1', name: 'Main' },
    trainer: null,
  });
  h.repo.findCurrentMembership = fn().mockResolvedValue({
    id: 'ms-1',
    status: 'ACTIVE',
    startDate: new Date('2026-11-01'),
    endDate: new Date('2026-12-31'),
    durationDays: 60,
    priceAtAssignment: '1000',
    plan: { name: 'Gold', discountPercentage: 0, taxPercentage: 0 },
  });
  h.repo.membershipAmountPaid = fn().mockResolvedValue(500);
  h.repo.visitDays = fn().mockResolvedValue([{ date: '2026-11-20', visits: 2 }]);
  h.repo.visitStats = fn().mockResolvedValue({ avgMinutes: 61.2, lastVisitAt: new Date('2026-11-20T10:00:00Z') });
  h.repo.outstandingInvoices = fn().mockResolvedValue({ value: 250, count: 1, nextDueDate: '2026-12-01' });
  h.repo.paidSince = fn().mockResolvedValue({ value: 1000, count: 2 });
  h.repo.upcomingBookings = fn().mockResolvedValue([
    {
      status: 'BOOKED',
      classSession: {
        id: 's1',
        sessionDate: new Date('2026-11-25'),
        startTime: '07:00',
        endTime: '08:00',
        groupClass: { name: 'Yoga' },
        trainer: { name: 'Asha' },
      },
    },
  ]);
  h.repo.unreadNotifications = fn().mockResolvedValue(4);
  h.repo.latestBodyWeight = fn().mockResolvedValue(null);
  h.workouts.findActiveByMember = fn().mockResolvedValue({
    workoutPlan: { name: 'Push Pull', exercises: [{ exerciseId: 'e1' }] },
    progress: [],
  });
  h.diets.findActiveByMember = fn().mockResolvedValue({
    dietPlan: { name: 'Lean', dailyCalories: 2000 },
    dailyLogs: [],
  });
}

const NOW = new Date('2026-11-22T06:00:00Z');
const overview = (flags?: readonly string[]) => new MemberOverviewService(TENANT).getOverview(MEMBER, NOW, flags);

describe('GET /portal/overview honours disabled modules', () => {
  beforeEach(wireOverviewRepos);

  it('all flags on (or flags omitted) -> every section built, disabledModules is []', async () => {
    for (const flags of [undefined, ALL]) {
      const o = await overview(flags);
      expect(o.disabledModules).toEqual([]);
      expect(o.attendance.totalVisits).toBe(2);
      expect(o.workout?.planName).toBe('Push Pull');
      expect(o.diet?.planName).toBe('Lean');
      expect(o.billing.outstanding).toEqual({ value: '250.00', invoiceCount: 1 });
      expect(o.classes.upcoming).toHaveLength(1);
      expect(o.notifications.unread).toBe(4);
      expect(o.membership?.amountPaid).toBe('500.00');
    }
  });

  it('attendance off -> not queried; section present but zeroed', async () => {
    const o = await overview(without('attendance'));
    expect(o.disabledModules).toEqual(['attendance']);
    expect(h.repo.visitDays).not.toHaveBeenCalled();
    expect(h.repo.visitStats).not.toHaveBeenCalled();
    expect(o.attendance).toMatchObject({
      thisMonth: { visits: 0, previous: 0 },
      currentStreakDays: 0,
      bestStreakDays: 0,
      totalVisits: 0,
      avgVisitMinutes: null,
      lastVisitAt: null,
    });
    expect(o.attendance.daily.length).toBeGreaterThan(0);
    expect(o.attendance.weekday).toHaveLength(7);
    expect(o.billing.outstanding.value).toBe('250.00'); // others untouched
  });

  it('workout_plans / diet_plans off -> null sections, not queried', async () => {
    const o = await overview(without('workout_plans', 'diet_plans'));
    expect(o.disabledModules).toEqual(['workout_plans', 'diet_plans']);
    expect(o.workout).toBeNull();
    expect(o.diet).toBeNull();
    expect(h.workouts.findActiveByMember).not.toHaveBeenCalled();
    expect(h.diets.findActiveByMember).not.toHaveBeenCalled();
    expect(h.repo.latestBodyWeight).not.toHaveBeenCalled();
  });

  it('payments off -> billing zeroed, amountPaid null, no payment queries', async () => {
    const o = await overview(without('payments'));
    expect(o.disabledModules).toEqual(['payments']);
    expect(o.billing).toEqual({
      outstanding: { value: '0.00', invoiceCount: 0 },
      nextDueDate: null,
      paidLast90Days: { value: '0.00', count: 0 },
    });
    expect(o.membership?.amountPaid).toBeNull();
    expect(h.repo.outstandingInvoices).not.toHaveBeenCalled();
    expect(h.repo.paidSince).not.toHaveBeenCalled();
    expect(h.repo.membershipAmountPaid).not.toHaveBeenCalled();
  });

  it('live_classes / notifications off -> empty upcoming, unread 0, not queried', async () => {
    const o = await overview(without('live_classes', 'notifications'));
    expect(o.disabledModules).toEqual(['live_classes', 'notifications']);
    expect(o.classes).toEqual({ upcoming: [] });
    expect(o.notifications).toEqual({ unread: 0 });
    expect(h.repo.upcomingBookings).not.toHaveBeenCalled();
    expect(h.repo.unreadNotifications).not.toHaveBeenCalled();
  });

  it('every module off -> the call still succeeds with the member + membership core', async () => {
    const o = await overview([]);
    expect(o.disabledModules).toEqual([
      'attendance',
      'workout_plans',
      'diet_plans',
      'payments',
      'live_classes',
      'notifications',
    ]);
    expect(o.member.memberId).toBe('MEM-0007');
    expect(o.membership?.planName).toBe('Gold');
  });
});

// ───────────────────────── dashboard KPIs / recent activities ─────────────────────────

function wireDashboardDb() {
  const count = (n: number) => fn().mockResolvedValue(n);
  const agg = (v: object) => fn().mockResolvedValue(v);
  h.db.member = { count: count(10), findMany: fn().mockResolvedValue([]) };
  h.db.membership = { count: count(3) };
  h.db.attendance = { count: count(7), findMany: fn().mockResolvedValue([]) };
  h.db.income = { aggregate: agg({ _sum: { amount: 1200 } }) };
  h.db.expense = { aggregate: agg({ _sum: { amount: 300 } }) };
  h.db.memberInvoice = { aggregate: agg({ _sum: { totalAmount: 450 } }) };
  h.db.user = { count: count(5) };
  h.db.branch = { count: count(2) };
  h.db.memberPayment = { findMany: fn().mockResolvedValue([]) };
  h.db.tenantSettings = { findUnique: fn().mockResolvedValue({ currencySymbol: '₹' }) };
}

describe('dashboard KPIs / recent activities honour disabled modules', () => {
  beforeEach(wireDashboardDb);
  const svc = () => new DashboardService(TENANT);

  it('all on -> real numbers, disabledModules []', async () => {
    const k = await svc().getKpis('u1', undefined, ALL);
    expect(k).toMatchObject({ todaysAttendance: 7, monthlyRevenue: '1200.00', monthlyExpenses: '300.00', outstandingPayments: '450.00', disabledModules: [] });
    expect((await svc().getKpis('u1')).disabledModules).toEqual([]); // flags omitted = all on
  });

  it('each disabled module zeroes ONLY its KPI and skips its query', async () => {
    const att = await svc().getKpis('u1', undefined, without('attendance'));
    expect(att).toMatchObject({ todaysAttendance: 0, monthlyRevenue: '1200.00', disabledModules: ['attendance'] });
    expect(h.db.attendance!.count).not.toHaveBeenCalled();

    const inc = await svc().getKpis('u1', undefined, without('income'));
    expect(inc).toMatchObject({ monthlyRevenue: '0.00', monthlyExpenses: '300.00', disabledModules: ['income'] });

    const exp = await svc().getKpis('u1', undefined, without('expenses'));
    expect(exp).toMatchObject({ monthlyExpenses: '0.00', monthlyRevenue: '1200.00', disabledModules: ['expenses'] });

    h.db.memberInvoice!.aggregate!.mockClear();
    const pay = await svc().getKpis('u1', undefined, without('payments'));
    expect(pay).toMatchObject({ outstandingPayments: '0.00', disabledModules: ['payments'] });
    expect(h.db.memberInvoice!.aggregate).not.toHaveBeenCalled();
  });

  it('member/staff/branch counts never depend on a module flag', async () => {
    const k = await svc().getKpis('u1', undefined, []);
    expect(k).toMatchObject({ totalMembers: 10, totalStaff: 5, activeBranches: 2 });
    expect(k.disabledModules).toEqual(['attendance', 'income', 'expenses', 'payments']);
  });

  it('summary carries disabledModules and drops PAYMENT / CHECK_IN activity (and their queries) for disabled modules', async () => {
    h.db.memberPayment!.findMany!.mockResolvedValue([
      { id: 'p1', status: 'SUCCESS', finalAmount: 100, paymentNumber: 'PAY-1', createdAt: new Date('2026-11-21'), member: { firstName: 'A', lastName: 'B' } },
    ]);
    h.db.attendance!.findMany!.mockResolvedValue([
      { id: 'a1', method: 'MANUAL', checkInTime: new Date('2026-11-20'), member: { firstName: 'C', lastName: 'D' } },
    ]);
    h.db.member!.findMany!.mockResolvedValue([
      { id: 'm1', firstName: 'E', lastName: 'F', createdAt: new Date('2026-11-19') },
    ]);

    const on = await svc().getSummary('u1', undefined, ALL);
    expect(on.disabledModules).toEqual([]);
    expect(on.recentActivities.map((a) => a.type).sort()).toEqual(['CHECK_IN', 'NEW_MEMBER', 'PAYMENT']);

    h.db.memberPayment!.findMany!.mockClear();
    h.db.attendance!.findMany!.mockClear();
    const off = await svc().getSummary('u1', undefined, without('payments', 'attendance'));
    expect(off.disabledModules).toEqual(['attendance', 'payments']);
    expect(off.kpis.disabledModules).toEqual(['attendance', 'payments']);
    expect(off.recentActivities.map((a) => a.type)).toEqual(['NEW_MEMBER']);
    expect(h.db.memberPayment!.findMany).not.toHaveBeenCalled();
    expect(h.db.attendance!.findMany).not.toHaveBeenCalled();
  });
});

// ───────────────────────── /finance/summary ─────────────────────────

describe('/finance/summary honours disabled modules', () => {
  beforeEach(() => {
    h.incomeRepo.sumForDateRange = fn().mockResolvedValue(800);
    h.incomeRepo.dailyTotalsForRange = fn().mockResolvedValue([]);
    h.expenseRepo.sumForDateRange = fn().mockResolvedValue(200);
    h.expenseRepo.dailyTotalsForRange = fn().mockResolvedValue([]);
    h.paymentRepo.sumOutstanding = fn().mockResolvedValue({ total: 90, count: 3 });
    h.paymentRepo.recent = fn().mockResolvedValue([]);
    h.paymentRepo.refundTotalsByPayment = fn().mockResolvedValue(new Map());
  });
  const summary = (flags?: readonly string[]) => new FinanceDashboardService(TENANT).getSummary(undefined, flags);

  it('all on -> unchanged numbers, disabledModules []', async () => {
    const s = await summary(ALL);
    expect(s).toMatchObject({ todayIncome: '800.00', monthlyIncome: '800.00', monthlyExpenses: '200.00', outstandingPayments: '90.00', outstandingInvoiceCount: 3, disabledModules: [] });
    expect(s.revenueTrend).toHaveLength(30);
  });

  it('income off -> income zeroed (present, "0.00"), expenses/outstanding intact', async () => {
    const s = await summary(without('income'));
    expect(s).toMatchObject({ todayIncome: '0.00', monthlyIncome: '0.00', monthlyExpenses: '200.00', outstandingPayments: '90.00', disabledModules: ['income'] });
    expect(h.incomeRepo.sumForDateRange).not.toHaveBeenCalled();
    expect(h.incomeRepo.dailyTotalsForRange).not.toHaveBeenCalled();
  });

  it('expenses off -> expenses zeroed, income intact', async () => {
    const s = await summary(without('expenses'));
    expect(s).toMatchObject({ monthlyExpenses: '0.00', monthlyIncome: '800.00', disabledModules: ['expenses'] });
    expect(h.expenseRepo.sumForDateRange).not.toHaveBeenCalled();
  });

  it('payments off -> outstanding 0, no recent payments (the route itself 403s first; this protects direct callers)', async () => {
    const s = await summary(without('payments'));
    expect(s).toMatchObject({ outstandingPayments: '0.00', outstandingInvoiceCount: 0, recentPayments: [], disabledModules: ['payments'] });
    expect(h.paymentRepo.sumOutstanding).not.toHaveBeenCalled();
    expect(h.paymentRepo.recent).not.toHaveBeenCalled();
  });
});

// ───────────────────────── Razorpay payment-link webhook ─────────────────────────

function fakeRes() {
  const out: { status?: number; body?: { data?: Record<string, unknown> } } = {};
  const res = {
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: { data?: Record<string, unknown> }) {
      out.body = body;
      return res;
    },
  } as unknown as Response;
  return { res, out };
}

function webhookReq(notes: Record<string, string>, event = 'payment_link.paid') {
  return {
    headers: { 'x-razorpay-signature': 'sig' },
    rawBody: Buffer.from('{}'),
    body: {
      event,
      payload: {
        payment_link: { entity: { id: 'plink_123', notes } },
        payment: { entity: { id: 'pay_RZP1' } },
      },
    },
  } as unknown as Request<Record<string, never>, unknown, never>;
}

describe('POST /webhook/razorpay-payment-link with the payments module off', () => {
  beforeEach(() => {
    h.verifySignature.mockReset().mockResolvedValue(true);
    h.prismaMemberPayment.findUnique.mockReset().mockResolvedValue({ id: 'mp-1', tenantId: TENANT });
    h.prismaPayment.findUnique.mockReset().mockResolvedValue({ id: 'pp-1', tenantId: TENANT });
    h.applyMember.mockReset().mockResolvedValue(undefined);
    h.applyPlatform.mockReset().mockResolvedValue(undefined);
    h.warn.mockReset();
    h.resolveById.mockReset();
  });

  it('payments off -> 200, nothing recorded, structured warning with tenantId + payment link id', async () => {
    h.resolveById.mockResolvedValue({ id: TENANT, featureFlags: without('payments') });
    const { res, out } = fakeRes();
    await razorpayWebhookController.handle(webhookReq({ memberPaymentId: 'mp-1' }), res);

    expect(out.status).toBe(200);
    expect(out.body?.data).toMatchObject({ received: true, recorded: false, reason: 'payments_module_disabled' });
    expect(h.applyMember).not.toHaveBeenCalled();
    expect(h.warn).toHaveBeenCalledTimes(1);
    const [message, meta] = h.warn.mock.calls[0]!;
    expect(message).toMatch(/payments module disabled/);
    expect(meta).toMatchObject({
      tenantId: TENANT,
      memberPaymentId: 'mp-1',
      paymentLinkId: 'plink_123',
      razorpayPaymentId: 'pay_RZP1',
      event: 'payment_link.paid',
      outcome: 'paid',
    });
  });

  it('also skips the expired/cancelled (failed) outcome', async () => {
    h.resolveById.mockResolvedValue({ id: TENANT, featureFlags: without('payments') });
    const { res, out } = fakeRes();
    await razorpayWebhookController.handle(webhookReq({ memberPaymentId: 'mp-1' }, 'payment_link.expired'), res);
    expect(out.status).toBe(200);
    expect(h.applyMember).not.toHaveBeenCalled();
    expect(h.warn.mock.calls[0]![1]).toMatchObject({ outcome: 'failed' });
  });

  it('payments on -> recorded exactly as before', async () => {
    h.resolveById.mockResolvedValue({ id: TENANT, featureFlags: ALL });
    const { res, out } = fakeRes();
    await razorpayWebhookController.handle(webhookReq({ memberPaymentId: 'mp-1' }), res);
    expect(out.body?.data).toEqual({ received: true });
    expect(h.applyMember).toHaveBeenCalledWith('mp-1', 'paid', 'pay_RZP1');
    expect(h.warn).not.toHaveBeenCalled();
  });

  it('platform billing links (FitCloud<->tenant) are NOT affected by the tenant payments flag', async () => {
    h.resolveById.mockResolvedValue({ id: TENANT, featureFlags: without('payments') });
    const { res } = fakeRes();
    await razorpayWebhookController.handle(webhookReq({ platformPaymentId: 'pp-1' }), res);
    expect(h.applyPlatform).toHaveBeenCalledWith('pp-1', 'paid', 'pay_RZP1');
    expect(h.resolveById).not.toHaveBeenCalled();
  });

  it('signature verification still runs first: a bad signature is 400 and nothing else is touched', async () => {
    h.verifySignature.mockResolvedValue(false);
    const { res } = fakeRes();
    await expect(razorpayWebhookController.handle(webhookReq({ memberPaymentId: 'mp-1' }), res)).rejects.toMatchObject({
      httpStatus: 400,
    });
    expect(h.prismaMemberPayment.findUnique).not.toHaveBeenCalled();
    expect(h.resolveById).not.toHaveBeenCalled();
  });
});
