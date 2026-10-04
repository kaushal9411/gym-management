import { NotFoundError } from '../../../core/errors/app-error';
import { prisma } from '../../../infrastructure/database/prisma';
import { Prisma, rawForTenant } from '../repositories/tenant-detail.db';
import {
  buildUsageRow,
  describeAdminAction,
  monthlyRecurring,
  type HealthBreakdown,
} from '../utils/tenant-detail.util';
import { computeHealth } from '../utils/tenant-health.util';
import { parseOverrides } from '../utils/tenant-limits.util';
import {
  dayKeys,
  monthKeys,
  monthSeriesStart,
  toMoney,
  zeroFillMonths,
} from '../utils/tenant-reports.util';

import { getTenantTagsMap } from './tenant-notes.service';

const DAY_MS = 86_400_000;
const STAFF_ROLES = Prisma.sql`('MANAGER','TRAINER','RECEPTIONIST')`;

/** `YYYY-MM-DD HH:MM:SS` UTC literal — passed to SQL as text and cast, so no driver/session timezone is involved. */
export const sqlTs = (d: Date): string => d.toISOString().slice(0, 19).replace('T', ' ');

export async function loadTenantOrThrow(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, include: { plan: true } },
      limits: true,
    },
  });
  if (!tenant || tenant.deletedAt) throw new NotFoundError('Tenant not found');
  return tenant;
}

export interface CoreSnapshot {
  tenant: Awaited<ReturnType<typeof loadTenantOrThrow>>;
  memberCount: number;
  staffCount: number;
  branchCount: number;
  activeMembers30d: number;
  lastActiveAt: Date | null;
  openTickets: number;
  health: HealthBreakdown;
}

export class TenantDetailService {
  /** Shared by Overview and Reports (churn risk) — counts + health inputs in a handful of grouped queries. */
  async coreSnapshot(tenantId: string, now: Date = new Date()): Promise<CoreSnapshot> {
    const tenant = await loadTenantOrThrow(tenantId);
    const since30 = sqlTs(new Date(now.getTime() - 29 * DAY_MS)).slice(0, 10);
    const [counts] = await rawForTenant<{
      members: number;
      staff: number;
      branches: number;
      active30: number;
      last_login: Date | null;
      last_checkin: Date | null;
      recent_checkins: number;
      last_payment_failed: boolean | null;
      open_tickets: number;
    }>(
      tenantId,
      Prisma.sql`SELECT
        (SELECT count(*)::int FROM members WHERE tenant_id = ${tenantId}::uuid AND deleted_at IS NULL) AS members,
        (SELECT count(*)::int FROM users u WHERE u.tenant_id = ${tenantId}::uuid AND u.deleted_at IS NULL
           AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                       WHERE ur.user_id = u.id AND r.name IN ${STAFF_ROLES})) AS staff,
        (SELECT count(*)::int FROM branches WHERE tenant_id = ${tenantId}::uuid AND deleted_at IS NULL) AS branches,
        (SELECT count(DISTINCT a.member_id)::int FROM attendance_records a JOIN members m ON m.id = a.member_id
           WHERE a.tenant_id = ${tenantId}::uuid AND a.deleted_at IS NULL AND m.deleted_at IS NULL
             AND a.attendance_date >= ${since30}::date) AS active30,
        (SELECT max(last_login_at) FROM users WHERE tenant_id = ${tenantId}::uuid) AS last_login,
        (SELECT max(check_in_time) FROM attendance_records WHERE tenant_id = ${tenantId}::uuid AND deleted_at IS NULL) AS last_checkin,
        (SELECT count(*)::int FROM attendance_records WHERE tenant_id = ${tenantId}::uuid AND deleted_at IS NULL
           AND check_in_time >= ${sqlTs(new Date(now.getTime() - 14 * DAY_MS))}::timestamp) AS recent_checkins,
        (SELECT (status = 'FAILED') FROM payments WHERE tenant_id = ${tenantId}::uuid
           ORDER BY created_at DESC LIMIT 1) AS last_payment_failed,
        (SELECT count(*)::int FROM support_tickets WHERE tenant_id = ${tenantId}::uuid
           AND status IN ('OPEN','IN_PROGRESS')) AS open_tickets`,
    );
    const c = counts!;
    // Same activity definition as the tenants list (`tenant-list.repository`): latest staff login OR attendance check-in.
    const lastActiveAt =
      [c.last_login, c.last_checkin]
        .filter((d): d is Date => !!d)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    const sub = tenant.subscriptions[0] ?? null;
    const lim = tenant.limits;
    const ratios = [
      lim && lim.maxMembers > 0 ? c.members / lim.maxMembers : null,
      lim && lim.maxStaff > 0 ? c.staff / lim.maxStaff : null,
      lim && lim.maxBranches > 0 ? c.branches / lim.maxBranches : null,
    ].filter((r): r is number => r !== null);
    // Reuses the list agent's `computeHealth` so the score on the detail page == the score in the tenants list
    // (inputs here are LIVE counts; the list still reads the never-updated `tenant_usage` rows for members/branches).
    const health = computeHealth(
      {
        tenantStatus: tenant.status,
        subscriptionStatus: sub?.status ?? null,
        trialEndsAt: tenant.trialEndsAt,
        paymentFailed: c.last_payment_failed ?? false,
        lastActiveAt,
        attendanceRecent: c.recent_checkins,
        members: c.members,
        maxUtilisation: ratios.length ? Math.max(...ratios) : null,
        membersUtilisation: lim && lim.maxMembers > 0 ? c.members / lim.maxMembers : null,
        paid: sub?.status === 'ACTIVE',
        openTickets: c.open_tickets,
        createdAt: tenant.createdAt,
      },
      now,
    );
    return {
      tenant,
      memberCount: c.members,
      staffCount: c.staff,
      branchCount: c.branches,
      activeMembers30d: c.active30,
      lastActiveAt,
      openTickets: c.open_tickets,
      health,
    };
  }

  async overview(tenantId: string, now: Date = new Date()) {
    const core = await this.coreSnapshot(tenantId, now);
    const { tenant } = core;
    const sub = tenant.subscriptions[0] ?? null;
    const days = dayKeys(now, 30);
    const growthKeys = monthKeys(now, 6);
    const growthStart = monthSeriesStart(now, 6);
    const curMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [owner, tagsMap, daily, extras, growth, invoices, timeline, lifetime] = await Promise.all(
      [
        prisma.user.findFirst({
          where: { tenantId, deletedAt: null },
          orderBy: { createdAt: 'asc' },
          select: { name: true, email: true },
        }),
        getTenantTagsMap([tenantId]),
        rawForTenant<{ d: string; c: number }>(
          tenantId,
          Prisma.sql`SELECT to_char(attendance_date, 'YYYY-MM-DD') AS d, count(*)::int AS c
          FROM attendance_records WHERE tenant_id = ${tenantId}::uuid AND deleted_at IS NULL AND attendance_date >= ${days[0]!}::date
          GROUP BY 1`,
        ),
        rawForTenant<{ logins7: number; payments30: number }>(
          tenantId,
          Prisma.sql`SELECT
          (SELECT count(*)::int FROM login_history WHERE tenant_id = ${tenantId}::uuid AND success
             AND created_at > ${sqlTs(new Date(now.getTime() - 7 * DAY_MS))}::timestamp) AS logins7,
          (SELECT count(*)::int FROM member_payments WHERE tenant_id = ${tenantId}::uuid AND status = 'SUCCESS'
             AND payment_date >= ${days[0]!}::date) AS payments30`,
        ),
        rawForTenant<{ month: string; members: number }>(
          tenantId,
          Prisma.sql`SELECT to_char(m, 'YYYY-MM') AS month,
          (SELECT count(*)::int FROM members WHERE tenant_id = ${tenantId}::uuid
             AND created_at < m + interval '1 month'
             AND (deleted_at IS NULL OR deleted_at >= m + interval '1 month')) AS members
          FROM generate_series(${sqlTs(growthStart)}::timestamp, ${sqlTs(curMonthStart)}::timestamp, interval '1 month') m`,
        ),
        rawForTenant<{
          id: string;
          invoice_number: string;
          total: string;
          status: string;
          created_at: Date;
          paid_at: Date | null;
          due_date: Date | null;
          currency: string;
        }>(
          tenantId,
          Prisma.sql`SELECT id, invoice_number, total::text AS total, status::text AS status, created_at, paid_at, due_date, currency
          FROM invoices WHERE tenant_id = ${tenantId}::uuid ORDER BY created_at DESC LIMIT 5`,
        ),
        this.timeline(tenantId),
        rawForTenant<{ total: string | null }>(
          tenantId,
          Prisma.sql`SELECT COALESCE(sum(amount), 0)::text AS total FROM payments
          WHERE tenant_id = ${tenantId}::uuid AND status = 'SUCCEEDED'`,
        ),
      ],
    );

    const dailyMap = new Map(daily.map((r) => [r.d, r.c]));
    const dailyCheckIns = days.map((date) => ({ date, count: dailyMap.get(date) ?? 0 }));
    const totalCheckIns = dailyCheckIns.reduce((s, d) => s + d.count, 0);

    const overrides = parseOverrides(tenant.limits?.overrides);
    const lim = tenant.limits;
    const usage = [
      buildUsageRow(
        'members',
        'Members',
        core.memberCount,
        lim?.maxMembers ?? null,
        overrides.maxMembers !== undefined,
      ),
      buildUsageRow(
        'staff',
        'Staff accounts',
        core.staffCount,
        lim?.maxStaff ?? null,
        overrides.maxStaff !== undefined,
      ),
      buildUsageRow(
        'branches',
        'Branches',
        core.branchCount,
        lim?.maxBranches ?? null,
        overrides.maxBranches !== undefined,
      ),
      // Storage consumption is not tracked anywhere (tenant_usage.storage_mb is a never-updated provisioning stub),
      // so `used` is null — only the limit is real. Emails/month has no backing metric and is omitted.
      buildUsageRow(
        'storage_gb',
        'Storage (GB)',
        null,
        lim ? Math.round((lim.maxStorageMb / 1024) * 100) / 100 : null,
        overrides.maxStorageMb !== undefined,
      ),
    ];

    const planInfo = sub
      ? {
          status: sub.status,
          billingCycle: sub.billingCycle,
          priceMonthly: Number(sub.plan.priceMonthly),
          priceYearly: Number(sub.plan.priceYearly),
        }
      : null;
    const mrr = monthlyRecurring(planInfo);

    return {
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status,
        plan: sub?.plan.name ?? null,
        subscriptionStatus: sub?.status ?? null,
        currency: sub?.plan.currency ?? 'INR',
        owner: owner ? { name: owner.name, email: owner.email } : null,
        createdAt: tenant.createdAt,
        trialEndsAt: tenant.trialEndsAt,
        renewsAt:
          sub && ['ACTIVE', 'PAST_DUE', 'GRACE'].includes(sub.status) ? sub.currentPeriodEnd : null,
        maintenanceMode: tenant.maintenanceMode,
        tags: tagsMap.get(tenantId) ?? [],
      },
      kpis: {
        mrr: mrr === null ? null : toMoney(mrr),
        lifetimeRevenue: toMoney(lifetime[0]?.total),
        memberCount: core.memberCount,
        staffCount: core.staffCount,
        branchCount: core.branchCount,
        lastActiveAt: core.lastActiveAt,
        healthScore: core.health.score,
      },
      health: core.health,
      usage,
      engagement: {
        dailyCheckIns,
        avgDailyCheckIns: Math.round((totalCheckIns / 30) * 10) / 10,
        activeMembers: core.activeMembers30d,
        totalMembers: core.memberCount,
        staffLoginsPerWeek: extras[0]?.logins7 ?? 0,
        paymentsRecorded30d: extras[0]?.payments30 ?? 0,
      },
      growth: {
        months: zeroFillMonths(growthKeys, growth, (month) => ({ month, members: 0 })).map((g) => ({
          month: g.month,
          members: g.members,
          mrr: null as string | null, // no MRR history snapshots exist — never estimated
        })),
      },
      invoices: invoices.map((i) => ({
        id: i.id,
        number: i.invoice_number,
        // Invoices carry no billing-period columns — the issue date is the closest honest value.
        periodStart: null as Date | null,
        periodEnd: null as Date | null,
        issuedAt: i.created_at,
        paidAt: i.paid_at,
        amount: toMoney(i.total),
        currency: i.currency,
        status: i.status,
      })),
      timeline,
    };
  }

  private async timeline(tenantId: string) {
    const rows = await rawForTenant<{
      at: Date;
      actor: string;
      action: string;
      payload: Record<string, unknown> | null;
      src: string;
    }>(
      tenantId,
      Prisma.sql`(
        SELECT l.created_at AS at, COALESCE(u.name, 'System') AS actor, l.action AS action, l.after AS payload, 'admin' AS src
        FROM admin_audit_logs l LEFT JOIN admin_users u ON u.id = l.admin_user_id
        WHERE l.entity_id = ${tenantId} OR l.after->>'tenantId' = ${tenantId} OR l.before->>'tenantId' = ${tenantId}
        ORDER BY l.created_at DESC LIMIT 10
      ) UNION ALL (
        SELECT h.created_at, 'System', h.action::text,
          jsonb_build_object('from', fp.name, 'to', tp.name, 'toStatus', h.to_status::text, 'note', h.note), 'subscription'
        FROM subscription_history h
        LEFT JOIN subscription_plans fp ON fp.id = h.from_plan_id
        LEFT JOIN subscription_plans tp ON tp.id = h.to_plan_id
        WHERE h.tenant_id = ${tenantId}::uuid ORDER BY h.created_at DESC LIMIT 10
      ) ORDER BY at DESC LIMIT 10`,
    );
    return rows.map((r) => {
      if (r.src === 'subscription') {
        const p = r.payload ?? {};
        const from = typeof p.from === 'string' ? p.from : null;
        const to = typeof p.to === 'string' ? p.to : null;
        const verb = r.action.toLowerCase().replace(/_/g, ' ');
        const detail = from && to && from !== to ? `${from} → ${to}` : (to ?? from ?? '');
        return {
          at: r.at,
          actor: r.actor,
          summary: `Subscription ${verb}${detail ? ` (${detail})` : ''}`,
          family: 'subscription' as const,
        };
      }
      const d = describeAdminAction(r.action);
      return { at: r.at, actor: r.actor, summary: d.text, family: d.family };
    });
  }

  // ---------------------------------------------------------------- tab data

  async users(
    tenantId: string,
    q: { search?: string; status?: string; page: number; limit: number },
  ) {
    await loadTenantOrThrow(tenantId);
    const where = Prisma.sql`u.tenant_id = ${tenantId}::uuid AND u.deleted_at IS NULL
      ${q.status ? Prisma.sql`AND u.status = ${q.status}::user_status` : Prisma.empty}
      ${q.search ? Prisma.sql`AND (u.name ILIKE ${`%${q.search}%`} OR u.email ILIKE ${`%${q.search}%`})` : Prisma.empty}`;
    const [items, totals] = await Promise.all([
      rawForTenant<{
        id: string;
        name: string;
        email: string;
        status: string;
        last_login_at: Date | null;
        mfa_enabled: boolean;
        created_at: Date;
        role: string | null;
        roles: string[] | null;
      }>(
        tenantId,
        Prisma.sql`SELECT u.id, u.name, u.email, u.status::text AS status, u.last_login_at, u.mfa_enabled, u.created_at,
          (SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id ORDER BY r.priority DESC LIMIT 1) AS role,
          (SELECT array_agg(r.name ORDER BY r.priority DESC) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id) AS roles
          FROM users u WHERE ${where} ORDER BY u.created_at ASC LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
      ),
      rawForTenant<{ total: number; active: number; mfa: number }>(
        tenantId,
        Prisma.sql`SELECT count(*)::int AS total, (count(*) FILTER (WHERE u.status = 'ACTIVE'))::int AS active,
          (count(*) FILTER (WHERE u.mfa_enabled))::int AS mfa FROM users u WHERE ${where}`,
      ),
    ]);
    const t = totals[0] ?? { total: 0, active: 0, mfa: 0 };
    return {
      items: items.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        roles: u.roles ?? [],
        status: u.status,
        lastLoginAt: u.last_login_at,
        mfaEnabled: u.mfa_enabled,
        createdAt: u.created_at,
      })),
      counts: { total: t.total, active: t.active, mfaEnabled: t.mfa },
      page: q.page,
      limit: q.limit,
      total: t.total,
      totalPages: Math.ceil(t.total / q.limit),
    };
  }

  /** Tenant-side audit trail (what happened INSIDE the gym's account), filterable + paginated. */
  async activity(
    tenantId: string,
    q: { action?: string; actor?: string; from?: Date; to?: Date; page: number; limit: number },
  ) {
    await loadTenantOrThrow(tenantId);
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // A date-only `to` (midnight UTC) means "through that whole day".
    const toExclusive = q.to
      ? q.to.getTime() % DAY_MS === 0
        ? new Date(q.to.getTime() + DAY_MS)
        : q.to
      : null;
    const actorSql = q.actor
      ? uuidRe.test(q.actor)
        ? Prisma.sql`AND a.actor_user_id = ${q.actor}::uuid`
        : Prisma.sql`AND (u.name ILIKE ${`%${q.actor}%`} OR u.email ILIKE ${`%${q.actor}%`} OR a.actor_role ILIKE ${`%${q.actor}%`})`
      : Prisma.empty;
    const where = Prisma.sql`a.tenant_id = ${tenantId}::uuid
      ${q.action ? Prisma.sql`AND a.action ILIKE ${`${q.action.replace(/[%_]/g, '')}%`}` : Prisma.empty}
      ${q.from ? Prisma.sql`AND a.created_at >= ${sqlTs(q.from)}::timestamp` : Prisma.empty}
      ${toExclusive ? Prisma.sql`AND a.created_at < ${sqlTs(toExclusive)}::timestamp` : Prisma.empty}
      ${actorSql}`;
    const [items, total] = await Promise.all([
      rawForTenant<{
        id: string;
        created_at: Date;
        actor_role: string | null;
        action: string;
        entity_type: string | null;
        entity_id: string | null;
        ip_address: string | null;
        actor_id: string | null;
        actor_name: string | null;
        actor_email: string | null;
      }>(
        tenantId,
        Prisma.sql`SELECT a.id, a.created_at, a.actor_role, a.action, a.entity_type, a.entity_id, a.ip_address,
          u.id AS actor_id, u.name AS actor_name, u.email AS actor_email
          FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id
          WHERE ${where} ORDER BY a.created_at DESC LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
      ),
      rawForTenant<{ n: number }>(
        tenantId,
        Prisma.sql`SELECT count(*)::int AS n FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id WHERE ${where}`,
      ),
    ]);
    const n = total[0]?.n ?? 0;
    return {
      items: items.map((r) => ({
        id: r.id,
        at: r.created_at,
        actor: r.actor_id ? { id: r.actor_id, name: r.actor_name, email: r.actor_email } : null,
        actorRole: r.actor_role,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id,
        ipAddress: r.ip_address,
      })),
      page: q.page,
      limit: q.limit,
      total: n,
      totalPages: Math.ceil(n / q.limit),
    };
  }

  async tickets(tenantId: string, q: { status?: string; page: number; limit: number }) {
    await loadTenantOrThrow(tenantId);
    const [items, counts] = await Promise.all([
      rawForTenant<{
        id: string;
        subject: string;
        status: string;
        priority: string;
        created_by_email: string;
        created_by_name: string | null;
        created_at: Date;
        updated_at: Date;
        closed_at: Date | null;
        assignee_id: string | null;
        assignee_name: string | null;
      }>(
        tenantId,
        Prisma.sql`SELECT t.id, t.subject, t.status::text AS status, t.priority::text AS priority, t.created_by_email, t.created_by_name,
          t.created_at, t.updated_at, t.closed_at, a.id AS assignee_id, a.name AS assignee_name
          FROM support_tickets t LEFT JOIN admin_users a ON a.id = t.assigned_admin_id
          WHERE t.tenant_id = ${tenantId}::uuid ${q.status ? Prisma.sql`AND t.status = ${q.status}::ticket_status` : Prisma.empty}
          ORDER BY t.created_at DESC LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
      ),
      rawForTenant<{ status: string; n: number }>(
        tenantId,
        Prisma.sql`SELECT status::text AS status, count(*)::int AS n FROM support_tickets
          WHERE tenant_id = ${tenantId}::uuid GROUP BY 1`,
      ),
    ]);
    const by = new Map(counts.map((c) => [c.status, c.n]));
    const c = {
      open: by.get('OPEN') ?? 0,
      inProgress: by.get('IN_PROGRESS') ?? 0,
      resolved: by.get('RESOLVED') ?? 0,
      closed: by.get('CLOSED') ?? 0,
    };
    const all = c.open + c.inProgress + c.resolved + c.closed;
    const filtered = q.status ? (by.get(q.status) ?? 0) : all;
    return {
      items: items.map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        createdByEmail: t.created_by_email,
        createdByName: t.created_by_name,
        assignedAdmin: t.assignee_id ? { id: t.assignee_id, name: t.assignee_name } : null,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        closedAt: t.closed_at,
      })),
      counts: { all, ...c },
      page: q.page,
      limit: q.limit,
      total: filtered,
      totalPages: Math.ceil(filtered / q.limit),
    };
  }

  async subscriptionHistory(tenantId: string) {
    await loadTenantOrThrow(tenantId);
    const [subs, history] = await Promise.all([
      prisma.subscription.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { plan: { select: { name: true, slug: true } } },
      }),
      rawForTenant<{
        id: string;
        action: string;
        from_plan: string | null;
        to_plan: string | null;
        from_status: string | null;
        to_status: string;
        note: string | null;
        created_at: Date;
      }>(
        tenantId,
        Prisma.sql`SELECT h.id, h.action::text AS action, fp.name AS from_plan, tp.name AS to_plan, h.from_status::text AS from_status,
          h.to_status::text AS to_status, h.note, h.created_at
          FROM subscription_history h
          LEFT JOIN subscription_plans fp ON fp.id = h.from_plan_id LEFT JOIN subscription_plans tp ON tp.id = h.to_plan_id
          WHERE h.tenant_id = ${tenantId}::uuid ORDER BY h.created_at DESC LIMIT 100`,
      ),
    ]);
    return {
      subscriptions: subs.map((s) => ({
        id: s.id,
        plan: s.plan.name,
        planSlug: s.plan.slug,
        status: s.status,
        billingCycle: s.billingCycle,
        trialEndsAt: s.trialEndsAt,
        currentPeriodStart: s.currentPeriodStart,
        currentPeriodEnd: s.currentPeriodEnd,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        createdAt: s.createdAt,
      })),
      history: history.map((h) => ({
        id: h.id,
        action: h.action,
        fromPlan: h.from_plan,
        toPlan: h.to_plan,
        fromStatus: h.from_status,
        toStatus: h.to_status,
        note: h.note,
        at: h.created_at,
      })),
    };
  }
}

export const tenantDetailService = new TenantDetailService();
