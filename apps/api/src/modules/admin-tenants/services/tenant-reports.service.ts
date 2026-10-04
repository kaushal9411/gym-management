import { Prisma, rawForTenant } from '../repositories/tenant-detail.db';
import {
  adoptionShare,
  buildHeatmap,
  buildMethodShares,
  buildRetentionCohorts,
  churnRiskLabel,
  COHORT_COLUMNS,
  monthKeys,
  monthSeriesStart,
  percent,
  projectMonthsTo80,
  resolveReportRange,
  toMoney,
  weekKeys,
  zeroFillMonths,
  type CohortSqlRow,
  type ReportRange,
} from '../utils/tenant-reports.util';

import { sqlTs, tenantDetailService } from './tenant-detail.service';

const DAY_MS = 86_400_000;
const STAFF_LOGIN_ROLES = ['OWNER', 'MANAGER', 'TRAINER', 'RECEPTIONIST'] as const;

/**
 * Reports tab. Everything is computed with grouped SQL against ONE tenant (RLS variable set per query), UTC throughout.
 *  • `revenuePaid` / `revenueByMonth` / `paymentMethods` = the tenant's PLATFORM payments to FitCloud (`payments`,
 *    SUCCEEDED, by `COALESCE(paid_at, created_at)`), NOT the gym's own member payments.
 *  • memberGrowth `lost` = members soft-deleted in the period (no churn timestamp exists for INACTIVE/FROZEN).
 *  • retention90d = share of members who joined in [window ending 90d ago] that are ACTIVE and not deleted today.
 *  • retentionCohorts: "active in month Mk" = ≥1 attendance record that month OR a non-cancelled membership overlapping
 *    that month; M0 = 100 by definition; null = month in the future.
 *  • memberPortal adoption only knows each member's LAST portal login (`member_credentials.last_login_at`).
 */
export class TenantReportsService {
  async reports(tenantId: string, range: ReportRange, compare: boolean, now: Date = new Date()) {
    const r = resolveReportRange(range, now);
    const core = await tenantDetailService.coreSnapshot(tenantId, now);
    const t = tenantId;
    const from = sqlTs(r.from);
    const to = sqlTs(r.to);
    const pFrom = sqlTs(r.prevFrom);
    const pTo = sqlTs(r.prevTo);
    const keys = monthKeys(now, r.months);
    const seriesMonths = Math.max(r.months, 6);
    const seriesKeys = monthKeys(now, seriesMonths);
    const seriesStart = sqlTs(monthSeriesStart(now, seriesMonths));
    const cohortKeys = monthKeys(now, COHORT_COLUMNS);
    const cohortStart = sqlTs(monthSeriesStart(now, COHORT_COLUMNS));
    const curMonth = sqlTs(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
    const revStart = sqlTs(monthSeriesStart(now, r.months));
    const weeks = weekKeys(now, 5);
    const ret90 = new Date(now.getTime() - 90 * DAY_MS);
    const cohortCur = [sqlTs(new Date(ret90.getTime() - r.days * DAY_MS)), sqlTs(ret90)];
    const cohortPrev = [
      sqlTs(new Date(ret90.getTime() - 2 * r.days * DAY_MS)),
      sqlTs(new Date(ret90.getTime() - r.days * DAY_MS)),
    ];

    const [
      revenue,
      memberStats,
      checkins,
      ticketStats,
      firstReply,
      series,
      adoption,
      heat,
      revByMonth,
      methods,
      cohorts,
      staffLogins,
      ticketMonths,
    ] = await Promise.all([
      rawForTenant<{ cur: string; prev: string }>(
        t,
        Prisma.sql`SELECT
            COALESCE(sum(amount) FILTER (WHERE ts >= ${from}::timestamp AND ts < ${to}::timestamp), 0)::text AS cur,
            COALESCE(sum(amount) FILTER (WHERE ts >= ${pFrom}::timestamp AND ts < ${pTo}::timestamp), 0)::text AS prev
            FROM (SELECT amount, COALESCE(paid_at, created_at) AS ts FROM payments
                  WHERE tenant_id = ${t}::uuid AND status = 'SUCCEEDED') p`,
      ),
      rawForTenant<{
        new_cur: number;
        new_prev: number;
        lost_cur: number;
        lost_prev: number;
        ret_cur_n: number;
        ret_cur_active: number;
        ret_prev_n: number;
        ret_prev_active: number;
      }>(
        t,
        Prisma.sql`SELECT
            (count(*) FILTER (WHERE created_at >= ${from}::timestamp AND created_at < ${to}::timestamp))::int AS new_cur,
            (count(*) FILTER (WHERE created_at >= ${pFrom}::timestamp AND created_at < ${pTo}::timestamp))::int AS new_prev,
            (count(*) FILTER (WHERE deleted_at >= ${from}::timestamp AND deleted_at < ${to}::timestamp))::int AS lost_cur,
            (count(*) FILTER (WHERE deleted_at >= ${pFrom}::timestamp AND deleted_at < ${pTo}::timestamp))::int AS lost_prev,
            (count(*) FILTER (WHERE created_at >= ${cohortCur[0]!}::timestamp AND created_at < ${cohortCur[1]!}::timestamp))::int AS ret_cur_n,
            (count(*) FILTER (WHERE created_at >= ${cohortCur[0]!}::timestamp AND created_at < ${cohortCur[1]!}::timestamp
               AND status = 'ACTIVE' AND deleted_at IS NULL))::int AS ret_cur_active,
            (count(*) FILTER (WHERE created_at >= ${cohortPrev[0]!}::timestamp AND created_at < ${cohortPrev[1]!}::timestamp))::int AS ret_prev_n,
            (count(*) FILTER (WHERE created_at >= ${cohortPrev[0]!}::timestamp AND created_at < ${cohortPrev[1]!}::timestamp
               AND status = 'ACTIVE' AND deleted_at IS NULL))::int AS ret_prev_active
            FROM members WHERE tenant_id = ${t}::uuid`,
      ),
      rawForTenant<{ cur: number; prev: number }>(
        t,
        Prisma.sql`SELECT
            (count(*) FILTER (WHERE check_in_time >= ${from}::timestamp AND check_in_time < ${to}::timestamp))::int AS cur,
            (count(*) FILTER (WHERE check_in_time >= ${pFrom}::timestamp AND check_in_time < ${pTo}::timestamp))::int AS prev
            FROM attendance_records WHERE tenant_id = ${t}::uuid AND deleted_at IS NULL AND check_in_time >= ${pFrom}::timestamp`,
      ),
      rawForTenant<{ n: number; avg_hours: number | null }>(
        t,
        Prisma.sql`SELECT count(*)::int AS n,
            avg(EXTRACT(EPOCH FROM (COALESCE(closed_at, updated_at) - created_at)) / 3600.0)
              FILTER (WHERE status IN ('RESOLVED','CLOSED'))::float8 AS avg_hours
            FROM support_tickets WHERE tenant_id = ${t}::uuid
              AND created_at >= ${from}::timestamp AND created_at < ${to}::timestamp`,
      ),
      rawForTenant<{ avg_hours: number | null }>(
        t,
        Prisma.sql`SELECT avg(EXTRACT(EPOCH FROM (f.first_note - f.created_at)) / 3600.0)::float8 AS avg_hours
            FROM (SELECT st.id, st.created_at, min(n.created_at) AS first_note
                  FROM support_tickets st JOIN support_ticket_notes n ON n.ticket_id = st.id AND n.is_internal = false
                  WHERE st.tenant_id = ${t}::uuid AND st.created_at >= ${from}::timestamp AND st.created_at < ${to}::timestamp
                  GROUP BY st.id, st.created_at) f`,
      ),
      rawForTenant<{ month: string; new: number; lost: number; total: number }>(
        t,
        Prisma.sql`SELECT to_char(m, 'YYYY-MM') AS month,
            (SELECT count(*)::int FROM members WHERE tenant_id = ${t}::uuid AND created_at >= m AND created_at < m + interval '1 month') AS new,
            (SELECT count(*)::int FROM members WHERE tenant_id = ${t}::uuid AND deleted_at >= m AND deleted_at < m + interval '1 month') AS lost,
            (SELECT count(*)::int FROM members WHERE tenant_id = ${t}::uuid AND created_at < m + interval '1 month'
               AND (deleted_at IS NULL OR deleted_at >= m + interval '1 month')) AS total
            FROM generate_series(${seriesStart}::timestamp, ${curMonth}::timestamp, interval '1 month') m`,
      ),
      rawForTenant<{
        active: number;
        attendance: number;
        workouts: number;
        diet: number;
        classes: number;
        portal: number;
      }>(
        t,
        Prisma.sql`WITH am AS (SELECT id FROM members WHERE tenant_id = ${t}::uuid AND deleted_at IS NULL AND status = 'ACTIVE')
            SELECT (SELECT count(*) FROM am)::int AS active,
              (SELECT count(DISTINCT a.member_id) FROM attendance_records a JOIN am ON am.id = a.member_id
                 WHERE a.tenant_id = ${t}::uuid AND a.deleted_at IS NULL AND a.check_in_time >= ${from}::timestamp AND a.check_in_time < ${to}::timestamp)::int AS attendance,
              (SELECT count(DISTINCT w.member_id) FROM member_workout_plans w JOIN am ON am.id = w.member_id
                 WHERE w.tenant_id = ${t}::uuid AND w.created_at >= ${from}::timestamp AND w.created_at < ${to}::timestamp)::int AS workouts,
              (SELECT count(DISTINCT d.member_id) FROM member_diet_plans d JOIN am ON am.id = d.member_id
                 WHERE d.tenant_id = ${t}::uuid AND d.created_at >= ${from}::timestamp AND d.created_at < ${to}::timestamp)::int AS diet,
              (SELECT count(DISTINCT b.member_id) FROM class_bookings b JOIN am ON am.id = b.member_id
                 WHERE b.tenant_id = ${t}::uuid AND b.status <> 'CANCELLED'
                   AND b.booked_at >= ${from}::timestamp AND b.booked_at < ${to}::timestamp)::int AS classes,
              (SELECT count(*) FROM member_credentials c JOIN am ON am.id = c.member_id
                 WHERE c.tenant_id = ${t}::uuid AND c.last_login_at >= ${from}::timestamp AND c.last_login_at < ${to}::timestamp)::int AS portal`,
      ),
      rawForTenant<{ weekday: number; hour: number; count: number }>(
        t,
        Prisma.sql`SELECT (EXTRACT(ISODOW FROM check_in_time)::int - 1) AS weekday, EXTRACT(HOUR FROM check_in_time)::int AS hour, count(*)::int AS count
            FROM attendance_records WHERE tenant_id = ${t}::uuid AND deleted_at IS NULL
              AND check_in_time >= ${from}::timestamp AND check_in_time < ${to}::timestamp GROUP BY 1, 2`,
      ),
      rawForTenant<{ month: string; amount: string }>(
        t,
        Prisma.sql`SELECT to_char(date_trunc('month', COALESCE(paid_at, created_at)), 'YYYY-MM') AS month, sum(amount)::text AS amount
            FROM payments WHERE tenant_id = ${t}::uuid AND status = 'SUCCEEDED'
              AND COALESCE(paid_at, created_at) >= ${revStart}::timestamp GROUP BY 1`,
      ),
      rawForTenant<{ method: string; amount: string }>(
        t,
        Prisma.sql`SELECT COALESCE(payment_mode::text, provider::text) AS method, sum(amount)::text AS amount
            FROM payments WHERE tenant_id = ${t}::uuid AND status = 'SUCCEEDED'
              AND COALESCE(paid_at, created_at) >= ${from}::timestamp AND COALESCE(paid_at, created_at) < ${to}::timestamp
            GROUP BY 1`,
      ),
      rawForTenant<CohortSqlRow>(
        t,
        Prisma.sql`WITH cohorts AS (
              SELECT id, date_trunc('month', created_at) AS c FROM members
              WHERE tenant_id = ${t}::uuid AND created_at >= ${cohortStart}::timestamp),
            ks AS (SELECT generate_series(0, ${COHORT_COLUMNS - 1}) AS k)
            SELECT to_char(c.c, 'YYYY-MM') AS cohort, ks.k AS k, count(*)::int AS size,
              (count(*) FILTER (WHERE
                EXISTS (SELECT 1 FROM attendance_records a WHERE a.tenant_id = ${t}::uuid AND a.deleted_at IS NULL AND a.member_id = c.id
                        AND a.attendance_date >= (c.c + ks.k * interval '1 month')::date
                        AND a.attendance_date < (c.c + (ks.k + 1) * interval '1 month')::date)
                OR EXISTS (SELECT 1 FROM memberships ms WHERE ms.tenant_id = ${t}::uuid AND ms.member_id = c.id
                        AND ms.status NOT IN ('CANCELLED', 'PENDING')
                        AND ms.start_date < (c.c + (ks.k + 1) * interval '1 month')::date
                        AND ms.end_date >= (c.c + ks.k * interval '1 month')::date)))::int AS active
            FROM cohorts c CROSS JOIN ks
            WHERE c.c + ks.k * interval '1 month' <= ${curMonth}::timestamp
            GROUP BY 1, 2`,
      ),
      rawForTenant<{ week: string; role: string | null; count: number }>(
        t,
        Prisma.sql`SELECT to_char(date_trunc('week', h.created_at), 'YYYY-MM-DD') AS week, rr.name AS role, count(*)::int AS count
            FROM login_history h JOIN users u ON u.id = h.user_id
            LEFT JOIN LATERAL (SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                               WHERE ur.user_id = u.id ORDER BY r.priority DESC LIMIT 1) rr ON true
            WHERE h.tenant_id = ${t}::uuid AND h.success AND h.created_at >= ${weeks[0]!}::timestamp
            GROUP BY 1, 2`,
      ),
      rawForTenant<{ month: string; status: string; n: number }>(
        t,
        Prisma.sql`SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, status::text AS status, count(*)::int AS n
            FROM support_tickets WHERE tenant_id = ${t}::uuid AND created_at >= ${revStart}::timestamp GROUP BY 1, 2`,
      ),
    ]);

    const ms = memberStats[0]!;
    const prevOrNull = <T>(v: T): T | null => (compare ? v : null);
    const ci = checkins[0]!;
    const perDay = (n: number) => Math.round((n / r.days) * 10) / 10;
    const retCur = percent(ms.ret_cur_active, ms.ret_cur_n, 0);
    const retPrev = percent(ms.ret_prev_active, ms.ret_prev_n, 0);

    const seriesFull = zeroFillMonths(seriesKeys, series, (month) => ({
      month,
      new: 0,
      lost: 0,
      total: 0,
    }));
    const memberGrowth = seriesFull.slice(-r.months);
    const planLimit = core.tenant.limits?.maxMembers ?? null;
    const planUtilization = seriesFull
      .slice(-6)
      .map((s) => ({ month: s.month, members: s.total, limit: planLimit }));

    const a = adoption[0]!;
    const featureAdoption = [
      { feature: 'Attendance check-in', share: adoptionShare(a.attendance, a.active) },
      { feature: 'Workout plans', share: adoptionShare(a.workouts, a.active) },
      { feature: 'Diet plans', share: adoptionShare(a.diet, a.active) },
      { feature: 'Class bookings', share: adoptionShare(a.classes, a.active) },
      { feature: 'Member portal logins', share: adoptionShare(a.portal, a.active) },
    ];

    const revMap = zeroFillMonths(
      keys,
      revByMonth.map((x) => ({ month: x.month, amount: x.amount })),
      (month) => ({ month, amount: '0' }),
    );

    const roleSet = new Set<string>(STAFF_LOGIN_ROLES);
    for (const row of staffLogins) if (row.role) roleSet.add(row.role);
    const loginMap = new Map(staffLogins.map((x) => [`${x.week}|${x.role}`, x.count]));
    const staffLoginsByRole = weeks.flatMap((week) =>
      [...roleSet].map((role) => ({ week, role, count: loginMap.get(`${week}|${role}`) ?? 0 })),
    );

    const tm = new Map<
      string,
      { open: number; inProgress: number; resolved: number; closed: number }
    >();
    for (const row of ticketMonths) {
      const e = tm.get(row.month) ?? { open: 0, inProgress: 0, resolved: 0, closed: 0 };
      if (row.status === 'OPEN') e.open += row.n;
      else if (row.status === 'IN_PROGRESS') e.inProgress += row.n;
      else if (row.status === 'RESOLVED') e.resolved += row.n;
      else if (row.status === 'CLOSED') e.closed += row.n;
      tm.set(row.month, e);
    }
    const ticketsByMonth = keys.map((month) => ({
      month,
      ...(tm.get(month) ?? { open: 0, inProgress: 0, resolved: 0, closed: 0 }),
    }));
    const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

    return {
      range,
      previousRange: compare
        ? { from: r.prevFrom.toISOString(), to: r.prevTo.toISOString() }
        : null,
      currentRange: { from: r.from.toISOString(), to: r.to.toISOString() },
      timezone: 'UTC',
      kpis: {
        revenuePaid: {
          value: toMoney(revenue[0]?.cur),
          previous: prevOrNull(toMoney(revenue[0]?.prev)),
        },
        memberGrowth: {
          value: ms.new_cur - ms.lost_cur,
          previous: prevOrNull(ms.new_prev - ms.lost_prev),
        },
        checkInsPerDay: { value: perDay(ci.cur), previous: prevOrNull(perDay(ci.prev)) },
        retention90d: retCur === null ? null : { value: retCur, previous: prevOrNull(retPrev) },
        supportTickets: {
          value: ticketStats[0]?.n ?? 0,
          avgResolutionHours: round1(ticketStats[0]?.avg_hours ?? null),
        },
        churnRisk: { label: churnRiskLabel(core.health.score), score: core.health.score },
      },
      memberGrowth,
      featureAdoption,
      checkInHeatmap: buildHeatmap(heat),
      revenueByMonth: revMap,
      paymentMethods: buildMethodShares(
        methods.map((m) => ({ method: m.method, amount: Number(m.amount) })),
      ),
      retentionCohorts: buildRetentionCohorts(cohortKeys, cohorts),
      staffLoginsByRole,
      ticketsByMonth,
      avgFirstReplyHours: round1(firstReply[0]?.avg_hours ?? null),
      planUtilization,
      projection: {
        monthsTo80Pct: projectMonthsTo80(
          planUtilization.map((p) => p.members),
          planLimit,
        ),
      },
    };
  }
}

export const tenantReportsService = new TenantReportsService();
