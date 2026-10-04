import { Prisma } from '@prisma/client';

import { prisma } from '../../../infrastructure/database/prisma';
import type { SqlFilters, TenantFact } from '../utils/tenant-list.util';

import { withAdminPlane } from './tenant-detail.db';

const DAY_MS = 86_400_000;

interface RawFact {
  id: string;
  slug: string;
  name: string;
  status: string;
  trial_ends_at: Date | null;
  suspended_at: Date | null;
  maintenance_mode: boolean;
  created_at: Date;
  owner_name: string | null;
  owner_email: string | null;
  plan_id: string | null;
  plan_name: string | null;
  sub_status: string | null;
  current_period_end: Date | null;
  grace_ends_at: Date | null;
  mrr: number | null;
  members: number | null;
  members_limit: number | null;
  branches: number | null;
  country: string | null;
  max_util: number | null;
  last_active: Date | null;
  attendance_recent: number;
  payment_failed: boolean;
  open_tickets: number;
}

/**
 * Cross-tenant by design: the RAW client (the admin portal reads ACROSS every tenant — same dev-superuser-bypasses-RLS
 * caveat as `AdminTenantRepository`). ONE query, one row per non-deleted tenant, every per-tenant fact resolved through an
 * index-backed LATERAL subquery or a single grouped pass (no N+1 from the app side). members/staff/branches are LIVE
 * counts (same as the tenant detail overview, NOT the stale `tenant_usage` rows); limits are `tenant_limits.max_*`, which
 * already hold the EFFECTIVE value (plan + admin overrides). Health/status/view/sort are applied in memory on these rows.
 */
export class TenantListRepository {
  async loadFacts(f: SqlFilters, now: Date = new Date()): Promise<TenantFact[]> {
    const since14 = new Date(now.getTime() - 14 * DAY_MS);
    const conds: Prisma.Sql[] = [Prisma.sql`t.deleted_at IS NULL`];
    if (f.searchPattern)
      conds.push(
        Prisma.sql`(t.name ILIKE ${f.searchPattern} OR t.slug ILIKE ${f.searchPattern} OR o.email ILIKE ${f.searchPattern})`,
      );
    if (f.planId) conds.push(Prisma.sql`s.plan_id = ${f.planId}::uuid`);
    if (f.planName)
      conds.push(Prisma.sql`(lower(sp.name) = ${f.planName} OR lower(sp.slug) = ${f.planName})`);
    if (f.country) conds.push(Prisma.sql`upper(COALESCE(ba.country, tp.country)) = ${f.country}`);
    if (f.createdFrom) conds.push(Prisma.sql`t.created_at >= ${f.createdFrom}`);
    if (f.createdToExclusive) conds.push(Prisma.sql`t.created_at < ${f.createdToExclusive}`);

    const rows = await prisma.$queryRaw<RawFact[]>(Prisma.sql`
      SELECT t.id, t.slug, t.name, t.status::text AS status, t.trial_ends_at, t.suspended_at,
             t.maintenance_mode, t.created_at,
             o.name AS owner_name, o.email AS owner_email,
             s.plan_id, sp.name AS plan_name, s.status::text AS sub_status,
             s.current_period_end, s.grace_ends_at,
             mr.mrr, COALESCE(mc.n, 0) AS members, l.max_members AS members_limit, COALESCE(bc.n, 0) AS branches,
             upper(COALESCE(ba.country, tp.country)) AS country,
             GREATEST(CASE WHEN l.max_members > 0 THEN COALESCE(mc.n, 0)::float8 / l.max_members END,
                      CASE WHEN l.max_staff > 0 THEN COALESCE(sc.n, 0)::float8 / l.max_staff END,
                      CASE WHEN l.max_branches > 0 THEN COALESCE(bc.n, 0)::float8 / l.max_branches END) AS max_util,
             GREATEST(lg.last_login, att.last_checkin) AS last_active,
             COALESCE(att.recent, 0) AS attendance_recent,
             COALESCE(pf.failed, false) AS payment_failed,
             COALESCE(tk.open_tickets, 0) AS open_tickets
      FROM tenants t
      LEFT JOIN LATERAL (SELECT name, email FROM users
                         WHERE tenant_id = t.id AND status = 'ACTIVE'
                         ORDER BY created_at ASC LIMIT 1) o ON true
      LEFT JOIN LATERAL (SELECT plan_id, status, current_period_end, grace_ends_at FROM subscriptions
                         WHERE tenant_id = t.id ORDER BY created_at DESC LIMIT 1) s ON true
      LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
      LEFT JOIN LATERAL (SELECT sum(CASE WHEN s2.billing_cycle::text = 'YEARLY' THEN p2.price_yearly / 12
                                         ELSE p2.price_monthly END)::float8 AS mrr
                         FROM subscriptions s2 JOIN subscription_plans p2 ON p2.id = s2.plan_id
                         WHERE s2.tenant_id = t.id AND s2.status::text = 'ACTIVE') mr ON true
      LEFT JOIN tenant_limits l ON l.tenant_id = t.id
      LEFT JOIN (SELECT tenant_id, count(*)::int AS n FROM members WHERE deleted_at IS NULL GROUP BY tenant_id) mc
        ON mc.tenant_id = t.id
      LEFT JOIN (SELECT u.tenant_id, count(*)::int AS n FROM users u WHERE u.deleted_at IS NULL
                 AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                             WHERE ur.user_id = u.id AND r.name IN ('MANAGER','TRAINER','RECEPTIONIST'))
                 GROUP BY u.tenant_id) sc ON sc.tenant_id = t.id
      LEFT JOIN (SELECT tenant_id, count(*)::int AS n FROM branches WHERE deleted_at IS NULL GROUP BY tenant_id) bc
        ON bc.tenant_id = t.id
      LEFT JOIN billing_addresses ba ON ba.tenant_id = t.id
      LEFT JOIN tenant_profiles tp ON tp.tenant_id = t.id
      LEFT JOIN LATERAL (SELECT max(last_login_at) AS last_login FROM users WHERE tenant_id = t.id) lg ON true
      LEFT JOIN LATERAL (
        SELECT (SELECT max(check_in_time) FROM attendance_records
                WHERE tenant_id = t.id AND deleted_at IS NULL) AS last_checkin,
               (SELECT count(*) FROM (SELECT 1 FROM attendance_records
                WHERE tenant_id = t.id AND deleted_at IS NULL AND check_in_time >= ${since14}
                LIMIT 1000) q)::int AS recent) att ON true
      LEFT JOIN LATERAL (SELECT (status::text = 'FAILED') AS failed FROM payments
                         WHERE tenant_id = t.id ORDER BY created_at DESC LIMIT 1) pf ON true
      LEFT JOIN LATERAL (SELECT count(*)::int AS open_tickets FROM support_tickets
                         WHERE tenant_id = t.id AND status::text IN ('OPEN', 'IN_PROGRESS')) tk ON true
      WHERE ${Prisma.join(conds, ' AND ')}`);

    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      status: r.status,
      trialEndsAt: r.trial_ends_at,
      suspendedAt: r.suspended_at,
      maintenanceMode: r.maintenance_mode,
      createdAt: r.created_at,
      ownerName: r.owner_name,
      ownerEmail: r.owner_email,
      planId: r.plan_id,
      planName: r.plan_name,
      subscriptionStatus: r.sub_status,
      currentPeriodEnd: r.current_period_end,
      graceEndsAt: r.grace_ends_at,
      mrr: r.mrr === null ? null : Number(r.mrr),
      members: r.members,
      membersLimit: r.members_limit,
      branches: r.branches,
      country: r.country,
      maxUtilisation: r.max_util === null ? null : Number(r.max_util),
      lastActiveAt: r.last_active,
      attendanceRecent: Number(r.attendance_recent),
      paymentFailed: r.payment_failed,
      openTickets: Number(r.open_tickets),
    }));
  }

  /** Distinct admin tags in use on live tenants with the number of tenants carrying each. */
  async tagCounts(): Promise<Array<{ tag: string; count: number }>> {
    return withAdminPlane(
      (tx) =>
        tx.$queryRaw<Array<{ tag: string; count: number }>>`
        SELECT tag, count(*)::int AS count
        FROM tenant_admin_tags a
        JOIN tenants t ON t.id = a.tenant_id AND t.deleted_at IS NULL
        CROSS JOIN LATERAL unnest(a.tags) AS tag
        GROUP BY tag ORDER BY count DESC, tag ASC`,
    );
  }

  /** Non-deleted tenants created per UTC month in [from, now] plus the count created before `from`. */
  async signupsByMonth(from: Date) {
    const [rows, before] = await Promise.all([
      prisma.$queryRaw<Array<{ m: string; n: number }>>`
        SELECT to_char(created_at, 'YYYY-MM') AS m, count(*)::int AS n
        FROM tenants WHERE deleted_at IS NULL AND created_at >= ${from} GROUP BY 1`,
      prisma.tenant.count({ where: { deletedAt: null, createdAt: { lt: from } } }),
    ]);
    return { rows, before };
  }

  /** ACTIVE subscriptions of live tenants whose period ends in [from, to), with their monthly-normalised price. */
  async renewingSubscriptions(from: Date, to: Date) {
    const rows = await prisma.$queryRaw<Array<{ end: Date; monthly: number }>>`
      SELECT s.current_period_end AS "end",
             (CASE WHEN s.billing_cycle::text = 'YEARLY' THEN p.price_yearly / 12 ELSE p.price_monthly END)::float8 AS monthly
      FROM subscriptions s
      JOIN subscription_plans p ON p.id = s.plan_id
      JOIN tenants t ON t.id = s.tenant_id AND t.deleted_at IS NULL
      WHERE s.status::text = 'ACTIVE' AND s.current_period_end >= ${from} AND s.current_period_end < ${to}`;
    return rows.map((r) => ({ currentPeriodEnd: r.end, monthly: Number(r.monthly) }));
  }
}

export const tenantListRepository = new TenantListRepository();
