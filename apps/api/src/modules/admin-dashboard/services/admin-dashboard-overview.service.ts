import { checkHealth } from '../../../core/health/health-check.util';
import { prisma } from '../../../infrastructure/database/prisma';
import { addDaysStr } from '../../finance/utils/payments-analytics.util';
import { adminSchedulerService } from '../../scheduler/services/admin-scheduler.service';
import {
  alignSeries,
  buildArpa,
  buildTrialFunnel,
  sortTopTenants,
  buildActivitySummary,
  daysLeft,
  money,
  monthlyPrice,
  oldestOpenDays,
  pickAtRisk,
  resolveOverviewRanges,
  sumValues,
  trialConversionRate,
  type AtRiskCandidate,
  type OverviewRange,
} from '../utils/overview.util';

const DAY_MS = 86_400_000;
const dayStart = (d: string) => new Date(`${d}T00:00:00Z`);

type DayRow = { d: string; v: number };
const toMap = (rows: DayRow[]) => new Map(rows.map((r) => [r.d, Number(r.v)]));

interface Scope {
  payments: boolean;
  revenue: boolean;
  support: boolean;
  scheduler: boolean;
}

export class AdminDashboardOverviewService {
  /**
   * Cross-tenant by design (raw `prisma`, same as admin-tenants/admin-revenue). `perms` are the calling admin's
   * permission keys; sections whose source is gated by another permission degrade to null/empty.
   */
  async getOverview(rangeKey: OverviewRange, perms: string[]) {
    const now = new Date();
    const scope: Scope = {
      payments: perms.includes('payments:read'),
      revenue: perms.includes('revenue:read'),
      support: perms.includes('support:manage'),
      scheduler: perms.includes('scheduler:view'),
    };
    const { range, previousRange } = resolveOverviewRanges(rangeKey, now);
    const winStart = dayStart(previousRange.from);
    const curStart = dayStart(range.from);
    const endExcl = dayStart(addDaysStr(range.to, 1));

    const [
      statusCounts,
      lapsedTrials,
      lapsedPastDue,
      tenantsBefore,
      signupRows,
      revenueRows,
      failedRows,
      mrrGroups,
      countries,
      churnRows,
      conversionRows,
      tickets,
      oldestOpen,
      trialsExpiringRows,
      atRiskCandidates,
      topTenants,
      activityRows,
      churnDailyRows,
      funnelRows,
      failedListRows,
      health,
      queue,
    ] = await Promise.all([
      prisma.tenant.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
      prisma.tenant.count({
        where: { deletedAt: null, status: 'TRIAL', trialEndsAt: { lt: now } },
      }),
      prisma.tenant.count({
        where: { deletedAt: null, status: 'PAST_DUE', subscriptionExpiresAt: { lt: now } },
      }),
      prisma.tenant.count({ where: { deletedAt: null, createdAt: { lt: curStart } } }),
      prisma.$queryRaw<DayRow[]>`
        SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d, count(*)::int AS v
        FROM tenants WHERE deleted_at IS NULL AND created_at >= ${winStart} AND created_at < ${endExcl} GROUP BY 1`,
      scope.payments
        ? prisma.$queryRaw<DayRow[]>`
          SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d, sum(amount)::float8 AS v
          FROM payments WHERE status = 'SUCCEEDED' AND created_at >= ${winStart} AND created_at < ${endExcl} GROUP BY 1`
        : Promise.resolve(null),
      scope.payments
        ? prisma.$queryRaw<DayRow[]>`
          SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d, count(*)::int AS v
          FROM payments WHERE status = 'FAILED' AND created_at >= ${winStart} AND created_at < ${endExcl} GROUP BY 1`
        : Promise.resolve(null),
      scope.revenue
        ? prisma.subscription.groupBy({
            by: ['planId', 'billingCycle'],
            where: { status: 'ACTIVE', tenant: { deletedAt: null } },
            _count: { _all: true },
          })
        : Promise.resolve(null),
      prisma.billingAddress.groupBy({
        by: ['country'],
        where: { tenant: { deletedAt: null } },
        _count: { _all: true },
        orderBy: { _count: { country: 'desc' } },
        take: 8,
      }),
      prisma.$queryRaw<Array<{ w: string; n: number }>>`
        SELECT CASE WHEN COALESCE(cancelled_at, updated_at) >= ${curStart} THEN 'cur' ELSE 'prev' END AS w,
               count(DISTINCT tenant_id)::int AS n
        FROM subscriptions
        WHERE status::text IN ('CANCELED', 'EXPIRED')
          AND COALESCE(cancelled_at, updated_at) >= ${winStart} AND COALESCE(cancelled_at, updated_at) < ${endExcl}
        GROUP BY 1`,
      prisma.$queryRaw<Array<{ w: string; ended: number; converted: number }>>`
        SELECT CASE WHEN trial_ends_at >= ${curStart} THEN 'cur' ELSE 'prev' END AS w,
               count(DISTINCT tenant_id)::int AS ended,
               count(DISTINCT tenant_id) FILTER (WHERE status::text = 'ACTIVE')::int AS converted
        FROM subscriptions
        WHERE trial_ends_at >= ${winStart} AND trial_ends_at < ${endExcl} AND trial_ends_at <= ${now}
        GROUP BY 1`,
      scope.support
        ? prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } })
        : Promise.resolve(null),
      scope.support
        ? prisma.supportTicket.findFirst({
            where: { status: 'OPEN' },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
          })
        : Promise.resolve(null),
      prisma.tenant.findMany({
        where: {
          deletedAt: null,
          status: 'TRIAL',
          trialEndsAt: { gte: now, lte: new Date(now.getTime() + 14 * DAY_MS) },
        },
        orderBy: { trialEndsAt: 'asc' },
        take: 10,
        select: {
          id: true,
          slug: true,
          name: true,
          trialEndsAt: true,
          usage: { where: { metric: 'members' }, select: { value: true } },
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { plan: { select: { name: true } } },
          },
          users: { orderBy: { createdAt: 'asc' }, take: 1, select: { email: true } },
        },
      }),
      this.atRiskCandidates(now, scope),
      this.topTenants(scope.revenue),
      prisma.adminAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: { adminUser: { select: { name: true } } },
      }),
      prisma.$queryRaw<DayRow[]>`
        SELECT to_char(m AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d, count(*)::int AS v FROM (
          SELECT tenant_id, cur, min(ts) AS m FROM (
            SELECT tenant_id, COALESCE(cancelled_at, updated_at) AS ts,
                   (COALESCE(cancelled_at, updated_at) >= ${curStart}) AS cur FROM subscriptions
            WHERE status::text IN ('CANCELED', 'EXPIRED')
              AND COALESCE(cancelled_at, updated_at) >= ${winStart} AND COALESCE(cancelled_at, updated_at) < ${endExcl}
          ) x GROUP BY tenant_id, cur
        ) y GROUP BY 1`,
      prisma.$queryRaw<
        Array<{ started: number; activated: number; converted: number; expired: number }>
      >`
        SELECT count(DISTINCT s.tenant_id)::int AS started,
               count(DISTINCT s.tenant_id) FILTER (WHERE COALESCE(u.value, 0) > 0)::int AS activated,
               count(DISTINCT s.tenant_id) FILTER (WHERE s.status::text = 'ACTIVE')::int AS converted,
               count(DISTINCT s.tenant_id) FILTER (WHERE s.trial_ends_at <= ${now} AND s.status::text <> 'ACTIVE')::int AS expired
        FROM subscriptions s
        JOIN tenants t ON t.id = s.tenant_id AND t.deleted_at IS NULL
        LEFT JOIN tenant_usage u ON u.tenant_id = s.tenant_id AND u.metric = 'members'
        WHERE s.trial_ends_at IS NOT NULL AND s.created_at >= ${curStart} AND s.created_at < ${endExcl}`,
      scope.payments
        ? prisma.$queryRaw<
            Array<{
              tenant_id: string;
              slug: string;
              name: string;
              plan: string | null;
              amount: string;
              reason: string | null;
              attempt: number | null;
              at: Date;
            }>
          >`
          SELECT p.tenant_id, t.slug, t.name,
                 COALESCE(pp.name, lp.name) AS plan,
                 p.amount::text AS amount, p.failure_reason AS reason,
                 CASE WHEN p.subscription_id IS NULL THEN NULL ELSE (
                   SELECT count(*)::int FROM payments f
                   WHERE f.tenant_id = p.tenant_id AND f.subscription_id = p.subscription_id AND f.status = 'FAILED'
                     AND f.created_at > COALESCE((SELECT max(ok.created_at) FROM payments ok
                          WHERE ok.subscription_id = p.subscription_id AND ok.status = 'SUCCEEDED'
                            AND ok.created_at <= p.created_at), '-infinity'::timestamp)
                     AND f.created_at <= p.created_at) END AS attempt,
                 p.created_at AS at
          FROM (SELECT DISTINCT ON (tenant_id) * FROM payments
                WHERE status = 'FAILED' AND created_at >= ${curStart} AND created_at < ${endExcl}
                ORDER BY tenant_id, created_at DESC) p
          JOIN tenants t ON t.id = p.tenant_id AND t.deleted_at IS NULL
          LEFT JOIN subscriptions sub ON sub.id = p.subscription_id
          LEFT JOIN subscription_plans pp ON pp.id = sub.plan_id
          LEFT JOIN LATERAL (SELECT sp.name FROM subscriptions s2 JOIN subscription_plans sp ON sp.id = s2.plan_id
                             WHERE s2.tenant_id = p.tenant_id ORDER BY s2.created_at DESC LIMIT 1) lp ON true
          ORDER BY p.created_at DESC LIMIT 8`
        : Promise.resolve([]),
      checkHealth(),
      scope.scheduler
        ? adminSchedulerService.getDashboard().catch(() => null)
        : Promise.resolve(null),
    ]);

    const statusCount = (s: string) => statusCounts.find((c) => c.status === s)?._count._all ?? 0;
    const tenantsTotal = statusCounts.reduce((s, c) => s + c._count._all, 0);

    const signups = alignSeries(range, previousRange, toMap(signupRows));
    const revenue = revenueRows ? alignSeries(range, previousRange, toMap(revenueRows)) : null;
    const failed = failedRows ? alignSeries(range, previousRange, toMap(failedRows)) : null;
    const curPrev = <T extends { value: number; previousValue: number }>(s: T[]) => ({
      cur: sumValues(s),
      prev: s.reduce((a, p) => a + p.previousValue, 0),
    });

    // Plans for MRR / plan mix (one query for just the plans that have active subs).
    let mrr: number | null = null;
    let planMix: Array<{
      planId: string;
      planName: string;
      activeSubscriptions: number;
      mrr: string;
    }> = [];
    if (mrrGroups) {
      const plans = mrrGroups.length
        ? await prisma.subscriptionPlan.findMany({
            where: { id: { in: [...new Set(mrrGroups.map((g) => g.planId))] } },
          })
        : [];
      const byId = new Map(plans.map((p) => [p.id, p]));
      const agg = new Map<string, { name: string; count: number; mrr: number }>();
      for (const g of mrrGroups) {
        const plan = byId.get(g.planId);
        if (!plan) continue;
        const e = agg.get(g.planId) ?? { name: plan.name, count: 0, mrr: 0 };
        e.count += g._count._all;
        e.mrr +=
          g._count._all *
          monthlyPrice(g.billingCycle, Number(plan.priceMonthly), Number(plan.priceYearly));
        agg.set(g.planId, e);
      }
      mrr = [...agg.values()].reduce((s, e) => s + e.mrr, 0);
      planMix = [...agg.entries()]
        .map(([planId, e]) => ({
          planId,
          planName: e.name,
          activeSubscriptions: e.count,
          mrr: money(e.mrr),
        }))
        .sort((a, b) => b.activeSubscriptions - a.activeSubscriptions);
    }

    const churn = (w: string) => churnRows.find((r) => r.w === w)?.n ?? 0;
    const conv = (w: string) => {
      const r = conversionRows.find((x) => x.w === w);
      return r ? trialConversionRate(r.ended, r.converted) : null;
    };
    const convCur = conv('cur');

    const ticketCount = (s: string) => tickets?.find((t) => t.status === s)?._count._all ?? 0;

    const churnedDaily = alignSeries(range, previousRange, toMap(churnDailyRows));
    const activePaid = mrrGroups ? mrrGroups.reduce((a, g) => a + g._count._all, 0) : 0;
    const rev = revenue ? curPrev(revenue) : null;
    const fl = failed ? curPrev(failed) : null;

    return {
      range,
      previousRange,
      generatedAt: now.toISOString(),
      kpis: {
        tenantsTotal: { value: tenantsTotal, previous: tenantsBefore },
        newTenants: { value: curPrev(signups).cur, previous: curPrev(signups).prev },
        activeTenants: { value: statusCount('ACTIVE') },
        trialTenants: { value: Math.max(0, statusCount('TRIAL') - lapsedTrials) },
        suspendedTenants: { value: statusCount('SUSPENDED') },
        expiredTenants: { value: statusCount('CANCELLED') + lapsedTrials + lapsedPastDue },
        mrr: mrr === null ? null : { value: money(mrr), previous: null },
        arr: mrr === null ? null : { value: money(mrr * 12) },
        revenueCollected: rev ? { value: money(rev.cur), previous: money(rev.prev) } : null,
        failedPayments: fl ? { value: fl.cur, previous: fl.prev } : null,
        churned: { value: churn('cur'), previous: churn('prev') },
        arpa: buildArpa(mrr, activePaid, null),
        trialConversion: convCur === null ? null : { value: convCur, previous: conv('prev') },
      },
      signupsDaily: signups.map((p) => ({
        date: p.date,
        count: p.value,
        previousCount: p.previousValue,
      })),
      churnedDaily: churnedDaily.map((p) => ({
        date: p.date,
        count: p.value,
        previousCount: p.previousValue,
      })),
      trialFunnel: buildTrialFunnel(
        funnelRows[0] ?? { started: 0, activated: 0, converted: 0, expired: 0 },
      ),
      failedPaymentsList: failedListRows.map((r) => ({
        tenantId: r.tenant_id,
        slug: r.slug,
        name: r.name,
        plan: r.plan,
        amount: Number(r.amount).toFixed(2),
        reason: r.reason,
        attempt: r.attempt === null ? null : Number(r.attempt),
        at: r.at.toISOString(),
      })),
      // No reliable subscription history (no activation timestamp, plan changes overwrite planId, state-change
      // times are only `updated_at`) -> deliberately not estimated. See BACKEND-GUIDE.
      mrrDaily: null as Array<{ date: string; mrr: string }> | null,
      mrrDailyPrevious: null as Array<{ date: string; mrr: string }> | null,
      revenueDaily: revenue
        ? revenue.map((p) => ({
            date: p.date,
            amount: money(p.value),
            previousAmount: money(p.previousValue),
          }))
        : [],
      planMix,
      countries: countries.map((c) => ({ country: c.country, tenantCount: c._count._all })),
      supportTickets: tickets
        ? {
            open: ticketCount('OPEN'),
            inProgress: ticketCount('IN_PROGRESS'),
            resolved: ticketCount('RESOLVED'),
            closed: ticketCount('CLOSED'),
            oldestOpenDays: oldestOpenDays(oldestOpen?.createdAt ?? null, now),
          }
        : null,
      trialsExpiring: trialsExpiringRows.map((t) => ({
        tenantId: t.id,
        slug: t.slug,
        name: t.name,
        ownerEmail: t.users[0]?.email ?? null,
        trialEndsAt: t.trialEndsAt,
        members: t.usage[0]?.value ?? null,
        plan: t.subscriptions[0]?.plan.name ?? null,
        daysLeft: daysLeft(t.trialEndsAt!, now),
      })),
      atRisk: pickAtRisk(atRiskCandidates, 10),
      topTenants,
      activity: activityRows.map((a) => ({
        id: a.id,
        at: a.createdAt,
        actorName: a.adminUser?.name ?? null,
        actorRole: a.actorRole ?? null,
        action: a.action,
        entityType: a.entityType ?? null,
        entityId: a.entityId ?? null,
        summary: buildActivitySummary(a.action, a.entityType),
      })),
      health: {
        database: {
          status: health.checks.database.status,
          latencyMs: health.checks.database.latencyMs,
        },
        redis: { status: health.checks.redis.status, latencyMs: health.checks.redis.latencyMs },
        queue: queue
          ? {
              health: queue.queueHealth,
              runningJobs: queue.runningJobs,
              failedJobs: queue.failedJobs,
              queueSize: queue.queueSize,
            }
          : null,
        uptimeSeconds: Math.round(health.uptimeSeconds),
      },
    };
  }

  private async atRiskCandidates(now: Date, scope: Scope): Promise<AtRiskCandidate[]> {
    const recent = new Date(now.getTime() - 14 * DAY_MS);
    const [failedLatest, pastDue, suspended, nearLimit] = await Promise.all([
      scope.payments
        ? prisma.$queryRaw<
            Array<{ tenant_id: string; slug: string; name: string; reason: string | null }>
          >`
          SELECT p.tenant_id, t.slug, t.name, p.failure_reason AS reason
          FROM (SELECT DISTINCT ON (tenant_id) tenant_id, status::text AS status, failure_reason, created_at
                FROM payments ORDER BY tenant_id, created_at DESC) p
          JOIN tenants t ON t.id = p.tenant_id
          WHERE p.status = 'FAILED' AND t.deleted_at IS NULL
          ORDER BY p.created_at DESC LIMIT 10`
        : Promise.resolve([]),
      prisma.subscription.findMany({
        where: { status: { in: ['PAST_DUE', 'GRACE'] }, tenant: { deletedAt: null } },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          status: true,
          graceEndsAt: true,
          tenant: { select: { id: true, slug: true, name: true } },
        },
      }),
      prisma.tenant.findMany({
        where: { deletedAt: null, status: 'SUSPENDED', suspendedAt: { gte: recent } },
        orderBy: { suspendedAt: 'desc' },
        take: 10,
        select: { id: true, slug: true, name: true, suspendedAt: true },
      }),
      prisma.$queryRaw<
        Array<{
          tenant_id: string;
          slug: string;
          name: string;
          metric: string;
          value: number;
          lim: number;
        }>
      >`
        SELECT x.tenant_id, t.slug, t.name, x.metric, x.value, x.lim FROM (
          SELECT u.tenant_id, u.metric, u.value, CASE u.metric
            WHEN 'members' THEN l.max_members WHEN 'branches' THEN l.max_branches WHEN 'managers' THEN l.max_managers
            WHEN 'trainers' THEN l.max_trainers WHEN 'storage_mb' THEN l.max_storage_mb END AS lim
          FROM tenant_usage u JOIN tenant_limits l ON l.tenant_id = u.tenant_id
        ) x JOIN tenants t ON t.id = x.tenant_id
        WHERE t.deleted_at IS NULL AND x.lim > 0 AND x.value * 10 >= x.lim * 9
        ORDER BY x.value::float8 / x.lim DESC LIMIT 10`,
    ]);

    return [
      ...failedLatest.map((r) => ({
        tenantId: r.tenant_id,
        slug: r.slug,
        name: r.name,
        reason: 'PAYMENT_FAILED' as const,
        detail: r.reason ? `Latest payment failed: ${r.reason}` : 'Latest payment failed',
      })),
      ...pastDue.map((s) => ({
        tenantId: s.tenant.id,
        slug: s.tenant.slug,
        name: s.tenant.name,
        reason: s.status === 'GRACE' ? ('GRACE' as const) : ('PAST_DUE' as const),
        detail: s.graceEndsAt
          ? `Subscription ${s.status === 'GRACE' ? 'in grace' : 'past due'}; grace ends ${s.graceEndsAt.toISOString().slice(0, 10)}`
          : `Subscription ${s.status === 'GRACE' ? 'in grace' : 'past due'}`,
      })),
      ...suspended.map((t) => ({
        tenantId: t.id,
        slug: t.slug,
        name: t.name,
        reason: 'SUSPENDED_RECENTLY' as const,
        detail: `Suspended ${t.suspendedAt!.toISOString().slice(0, 10)}`,
      })),
      ...nearLimit.map((r) => ({
        tenantId: r.tenant_id,
        slug: r.slug,
        name: r.name,
        reason: 'NEAR_LIMIT' as const,
        detail: `${r.metric} at ${r.value}/${r.lim} (${Math.round((r.value / r.lim) * 100)}%)`,
      })),
    ];
  }

  private async topTenants(withMrr: boolean) {
    const rows = await prisma.$queryRaw<
      Array<{
        tenant_id: string;
        slug: string;
        name: string;
        plan: string | null;
        members: number | null;
        branches: number | null;
        mrr: number | null;
      }>
    >`
      SELECT t.id AS tenant_id, t.slug, t.name,
             (SELECT sp.name FROM subscriptions s JOIN subscription_plans sp ON sp.id = s.plan_id
              WHERE s.tenant_id = t.id ORDER BY s.created_at DESC LIMIT 1) AS plan,
             um.value AS members, ub.value AS branches,
             (SELECT sum(CASE WHEN s.billing_cycle::text = 'YEARLY' THEN sp.price_yearly / 12 ELSE sp.price_monthly END)::float8
              FROM subscriptions s JOIN subscription_plans sp ON sp.id = s.plan_id
              WHERE s.tenant_id = t.id AND s.status::text = 'ACTIVE') AS mrr
      FROM tenants t
      LEFT JOIN tenant_usage um ON um.tenant_id = t.id AND um.metric = 'members'
      LEFT JOIN tenant_usage ub ON ub.tenant_id = t.id AND ub.metric = 'branches'
      WHERE t.deleted_at IS NULL
      ORDER BY (SELECT count(*) FROM subscriptions s WHERE s.tenant_id = t.id AND s.status::text = 'ACTIVE') DESC,
               um.value DESC NULLS LAST, t.created_at DESC
      LIMIT 200`;
    const ranked = sortTopTenants(
      rows.map((r) => ({
        tenantId: r.tenant_id,
        slug: r.slug,
        name: r.name,
        plan: r.plan,
        members: r.members,
        branches: r.branches,
        mrr: withMrr ? r.mrr : null,
      })),
    ).slice(0, 8);
    return ranked.map((r) => ({ ...r, mrr: r.mrr === null ? null : money(r.mrr) }));
  }
}

export const adminDashboardOverviewService = new AdminDashboardOverviewService();
