import { Prisma } from '@prisma/client';

import type { TenantScopedPrisma } from '../../../infrastructure/database/tenant-scoped-client';
import { addDaysStr, type DateRange } from '../../finance/utils/payments-analytics.util';
import { headlineBoundaries, type LeadAnalyticsRaw } from '../utils/lead-analytics.util';
import { CLOSED_STATUSES, followUpBoundaries, OPEN_STATUSES } from '../utils/lead-rules.util';
import type { ExportLeadsQuery, ListLeadsQuery } from '../validators/lead.validators';

const LEAD_INCLUDE = {
  branch: { select: { id: true, name: true } },
  interestedPlan: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  convertedMember: { select: { id: true, memberId: true, firstName: true, lastName: true } },
} satisfies Prisma.LeadInclude;

export type LeadRow = Prisma.LeadGetPayload<{ include: typeof LEAD_INCLUDE }>;
export type LeadActivityRow = Prisma.LeadActivityGetPayload<{ include: { createdBy: { select: { id: true; name: true } } } }>;

type FilterQuery = Partial<Omit<ListLeadsQuery, 'page' | 'limit' | 'sortBy' | 'sortDir'>> | ExportLeadsQuery;

export interface LeadScope {
  tenantId: string;
  /** The caller — resolves `assignedTo=me`. */
  actorUserId: string;
  /** Branch ids a restricted actor may see (omitted for all-branch staff). Branch-less leads stay visible. */
  restrictToBranchIds?: string[];
}

const startOfDay = (d: string): Date => new Date(`${d}T00:00:00.000Z`);
/** Columns are `timestamp without time zone` holding UTC — bind instants as ISO text cast to `timestamp` (a bare Date param would be shifted by the session zone). */
const ts = (d: Date): Prisma.Sql => Prisma.sql`${d.toISOString()}::timestamp`;

function branchWhere(branchId: string | undefined, restrict: string[] | undefined): Prisma.LeadWhereInput {
  if (restrict) {
    if (branchId) return { branchId: restrict.includes(branchId) ? branchId : { in: [] } };
    return { OR: [{ branchId: null }, { branchId: { in: restrict } }] };
  }
  return branchId ? { branchId } : {};
}

/** `ignoreStatus` drops the status filter (used for the per-status `counts`). */
export function buildLeadWhere(scope: LeadScope, query: FilterQuery, opts: { ignoreStatus?: boolean; now?: Date } = {}): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [{ tenantId: scope.tenantId, deletedAt: null }, branchWhere(query.branchId, scope.restrictToBranchIds)];
  if (!opts.ignoreStatus && query.status?.length) and.push({ status: { in: query.status } });
  if (query.source?.length) and.push({ source: { in: query.source } });
  if (query.assignedTo === 'me') and.push({ assignedToUserId: scope.actorUserId });
  else if (query.assignedTo === 'unassigned') and.push({ assignedToUserId: null });
  else if (query.assignedTo) and.push({ assignedToUserId: query.assignedTo });
  if (query.interestedPlanId) and.push({ interestedPlanId: query.interestedPlanId });
  if (query.createdFrom || query.createdTo) {
    and.push({
      createdAt: {
        ...(query.createdFrom ? { gte: startOfDay(query.createdFrom) } : {}),
        ...(query.createdTo ? { lt: startOfDay(addDaysStr(query.createdTo, 1)) } : {}),
      },
    });
  }
  if (query.search) {
    const digits = query.search.replace(/\D/g, '');
    and.push({
      OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { email: { contains: query.search, mode: 'insensitive' } },
        ...(digits.length >= 3 ? [{ phoneKey: { contains: digits } }] : []),
      ],
    });
  }
  if (query.followUp) {
    const { start, end } = followUpBoundaries(opts.now);
    const open = { status: { in: [...OPEN_STATUSES] } } as Prisma.LeadWhereInput;
    if (query.followUp === 'overdue') and.push({ ...open, nextFollowUpAt: { lt: start } });
    else if (query.followUp === 'today') and.push({ ...open, nextFollowUpAt: { gte: start, lt: end } });
    else if (query.followUp === 'upcoming') and.push({ ...open, nextFollowUpAt: { gte: end } });
    else and.push({ OR: [{ nextFollowUpAt: null }, { status: { in: [...CLOSED_STATUSES] } }] });
  }
  return { AND: and };
}

export class LeadRepository {
  constructor(private readonly db: TenantScopedPrisma) {}

  async list(where: Prisma.LeadWhereInput, orderBy: Prisma.LeadOrderByWithRelationInput[], skip: number, take: number) {
    const [items, total] = await Promise.all([this.db.lead.findMany({ where, include: LEAD_INCLUDE, orderBy, skip, take }), this.db.lead.count({ where })]);
    return { items, total };
  }

  async findMany(where: Prisma.LeadWhereInput, orderBy: Prisma.LeadOrderByWithRelationInput[], take: number): Promise<LeadRow[]> {
    return this.db.lead.findMany({ where, include: LEAD_INCLUDE, orderBy, take });
  }

  async countByStatus(where: Prisma.LeadWhereInput): Promise<Array<{ status: string; count: number }>> {
    const rows = await this.db.lead.groupBy({ by: ['status'], where, _count: { _all: true } });
    return rows.map((r) => ({ status: r.status, count: r._count._all }));
  }

  async countWhere(where: Prisma.LeadWhereInput): Promise<number> {
    return this.db.lead.count({ where });
  }

  async findById(tenantId: string, id: string): Promise<LeadRow | null> {
    return this.db.lead.findFirst({ where: { tenantId, id, deletedAt: null }, include: LEAD_INCLUDE });
  }

  async create(data: Prisma.LeadUncheckedCreateInput): Promise<string> {
    return (await this.db.lead.create({ data, select: { id: true } })).id;
  }

  async update(id: string, data: Prisma.LeadUncheckedUpdateInput): Promise<void> {
    await this.db.lead.update({ where: { id }, data });
  }

  /** Conditional claim used by convert so two concurrent conversions can't both win. */
  async markConverted(tenantId: string, id: string, data: { convertedMemberId: string; convertedAt: Date; fromStatus: string }): Promise<boolean> {
    const r = await this.db.lead.updateMany({
      where: { tenantId, id, deletedAt: null, convertedMemberId: null, status: { not: 'CONVERTED' } },
      data: {
        status: 'CONVERTED',
        convertedMemberId: data.convertedMemberId,
        convertedAt: data.convertedAt,
        nextFollowUpAt: null,
        lostReason: null,
        lostNote: null,
        lostAt: null,
        lastActivityAt: data.convertedAt,
      },
    });
    return r.count > 0;
  }

  async softDelete(id: string): Promise<void> {
    await this.db.lead.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async addActivity(data: Prisma.LeadActivityUncheckedCreateInput): Promise<void> {
    await this.db.leadActivity.create({ data });
  }

  async listActivities(tenantId: string, leadId: string): Promise<LeadActivityRow[]> {
    return this.db.leadActivity.findMany({
      where: { tenantId, leadId },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
    });
  }

  /** Non-deleted leads (any status — the caller decides which block) matching the phone key or email. */
  async findDuplicateLeads(tenantId: string, phoneKey: string | null, email: string | null, excludeId?: string) {
    const or: Prisma.LeadWhereInput[] = [];
    if (phoneKey) or.push({ phoneKey });
    if (email) or.push({ email: { equals: email, mode: 'insensitive' } });
    if (!or.length) return [];
    return this.db.lead.findMany({
      where: { tenantId, deletedAt: null, OR: or, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true, name: true, status: true, phoneKey: true, email: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  // ── analytics (raw SQL; must set the RLS variable itself) ────────────────

  private async rawScoped<T>(tenantId: string, query: Prisma.Sql): Promise<T[]> {
    const [, rows] = await this.db.$transaction([this.db.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`, this.db.$queryRaw<T[]>(query)]);
    return rows as T[];
  }

  async analyticsRaw(
    scope: Pick<LeadScope, 'tenantId' | 'restrictToBranchIds'>,
    range: DateRange,
    previousRange: DateRange,
    branchId: string | undefined,
    now: Date = new Date(),
  ): Promise<LeadAnalyticsRaw> {
    const { tenantId } = scope;
    let branchSql = Prisma.empty;
    if (scope.restrictToBranchIds) {
      if (branchId) branchSql = scope.restrictToBranchIds.includes(branchId) ? Prisma.sql`AND l.branch_id = ${branchId}::uuid` : Prisma.sql`AND false`;
      else branchSql = Prisma.sql`AND (l.branch_id IS NULL OR l.branch_id = ANY(${scope.restrictToBranchIds}::uuid[]))`;
    } else if (branchId) {
      branchSql = Prisma.sql`AND l.branch_id = ${branchId}::uuid`;
    }
    const base = Prisma.sql`l.tenant_id = ${tenantId}::uuid AND l.deleted_at IS NULL ${branchSql}`;
    const spanFrom = previousRange.from;
    const spanTo = addDaysStr(range.to, 1);
    const curFrom = range.from;
    const curTo = addDaysStr(range.to, 1);
    const cohort = Prisma.sql`${base} AND l.created_at >= ${curFrom}::timestamp AND l.created_at < ${curTo}::timestamp`;
    const open = Prisma.sql`l.status::text IN ('NEW','CONTACTED','VISIT_SCHEDULED','TRIAL_DONE','NEGOTIATION')`;
    const { start, end } = followUpBoundaries(now);
    const h = headlineBoundaries(now);
    const f = (col: string, a: Date, b: Date, extra = '') =>
      Prisma.sql`COUNT(*) FILTER (WHERE ${Prisma.raw(col)} >= ${ts(a)} AND ${Prisma.raw(col)} < ${ts(b)} ${Prisma.raw(extra)})::int`;

    type Day = { day: string; cnt: number };
    const [createdDaily, convertedDaily, lostDaily, snap, head, monthly, funnel, bySource, byStaff, byPlan, lostReasons, ageing, topBranches] = await Promise.all([
      this.rawScoped<Day & { conv: number }>(
        tenantId,
        Prisma.sql`SELECT to_char(l.created_at, 'YYYY-MM-DD') AS day, COUNT(*)::int AS cnt, COUNT(*) FILTER (WHERE l.status::text = 'CONVERTED')::int AS conv
          FROM leads l WHERE ${base} AND l.created_at >= ${spanFrom}::timestamp AND l.created_at < ${spanTo}::timestamp GROUP BY 1`,
      ),
      this.rawScoped<Day & { days: number }>(
        tenantId,
        Prisma.sql`SELECT to_char(l.converted_at, 'YYYY-MM-DD') AS day, COUNT(*)::int AS cnt, COALESCE(SUM(EXTRACT(EPOCH FROM (l.converted_at - l.created_at)) / 86400), 0)::float8 AS days
          FROM leads l WHERE ${base} AND l.status::text = 'CONVERTED' AND l.converted_at >= ${spanFrom}::timestamp AND l.converted_at < ${spanTo}::timestamp GROUP BY 1`,
      ),
      this.rawScoped<Day>(
        tenantId,
        Prisma.sql`SELECT to_char(l.lost_at, 'YYYY-MM-DD') AS day, COUNT(*)::int AS cnt
          FROM leads l WHERE ${base} AND l.status::text = 'LOST' AND l.lost_at >= ${spanFrom}::timestamp AND l.lost_at < ${spanTo}::timestamp GROUP BY 1`,
      ),
      this.rawScoped<{ open: number; due_today: number; overdue: number }>(
        tenantId,
        Prisma.sql`SELECT COUNT(*) FILTER (WHERE ${open})::int AS open,
            COUNT(*) FILTER (WHERE ${open} AND l.next_follow_up_at >= ${ts(start)} AND l.next_follow_up_at < ${ts(end)})::int AS due_today,
            COUNT(*) FILTER (WHERE ${open} AND l.next_follow_up_at < ${ts(start)})::int AS overdue
          FROM leads l WHERE ${base}`,
      ),
      this.rawScoped<Record<string, number>>(
        tenantId,
        Prisma.sql`SELECT
            ${f('l.created_at', h.today.start, h.today.end)} AS t_new, ${f('l.converted_at', h.today.start, h.today.end, "AND l.status::text = 'CONVERTED'")} AS t_conv,
            ${f('l.created_at', h.today.prevStart, h.today.prevEnd)} AS tp_new, ${f('l.converted_at', h.today.prevStart, h.today.prevEnd, "AND l.status::text = 'CONVERTED'")} AS tp_conv,
            ${f('l.created_at', h.thisMonth.start, h.thisMonth.end)} AS m_new, ${f('l.converted_at', h.thisMonth.start, h.thisMonth.end, "AND l.status::text = 'CONVERTED'")} AS m_conv,
            ${f('l.created_at', h.thisMonth.prevStart, h.thisMonth.prevEnd)} AS mp_new, ${f('l.converted_at', h.thisMonth.prevStart, h.thisMonth.prevEnd, "AND l.status::text = 'CONVERTED'")} AS mp_conv,
            ${f('l.created_at', h.thisYear.start, h.thisYear.end)} AS y_new, ${f('l.converted_at', h.thisYear.start, h.thisYear.end, "AND l.status::text = 'CONVERTED'")} AS y_conv,
            ${f('l.created_at', h.thisYear.prevStart, h.thisYear.prevEnd)} AS yp_new, ${f('l.converted_at', h.thisYear.prevStart, h.thisYear.prevEnd, "AND l.status::text = 'CONVERTED'")} AS yp_conv
          FROM leads l WHERE ${base}`,
      ),
      this.rawScoped<{ month: string; cnt: number; conv: number }>(
        tenantId,
        Prisma.sql`SELECT to_char(l.created_at, 'YYYY-MM') AS month, COUNT(*)::int AS cnt, COUNT(*) FILTER (WHERE l.status::text = 'CONVERTED')::int AS conv
          FROM leads l WHERE ${base} AND l.created_at >= ${ts(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1)))} GROUP BY 1`,
      ),
      this.rawScoped<{ stage: number; cnt: number }>(
        tenantId,
        Prisma.sql`SELECT x.stage, COUNT(*)::int AS cnt FROM (
            SELECT GREATEST(
              CASE l.status::text WHEN 'CONTACTED' THEN 1 WHEN 'VISIT_SCHEDULED' THEN 2 WHEN 'TRIAL_DONE' THEN 3 WHEN 'NEGOTIATION' THEN 4 WHEN 'CONVERTED' THEN 5 ELSE 0 END,
              COALESCE((SELECT MAX(CASE a.to_status::text WHEN 'CONTACTED' THEN 1 WHEN 'VISIT_SCHEDULED' THEN 2 WHEN 'TRIAL_DONE' THEN 3 WHEN 'NEGOTIATION' THEN 4 WHEN 'CONVERTED' THEN 5 ELSE 0 END)
                        FROM lead_activities a WHERE a.lead_id = l.id AND a.to_status IS NOT NULL), 0)
            ) AS stage
            FROM leads l WHERE ${cohort}
          ) x GROUP BY 1`,
      ),
      this.rawScoped<{ key: string; leads: number; conv: number }>(
        tenantId,
        Prisma.sql`SELECT l.source::text AS key, COUNT(*)::int AS leads, COUNT(*) FILTER (WHERE l.status::text = 'CONVERTED')::int AS conv FROM leads l WHERE ${cohort} GROUP BY 1`,
      ),
      this.rawScoped<{ key: string | null; name: string | null; leads: number; conv: number }>(
        tenantId,
        Prisma.sql`SELECT l.assigned_to_user_id::text AS key, u.name AS name, COUNT(*)::int AS leads, COUNT(*) FILTER (WHERE l.status::text = 'CONVERTED')::int AS conv
          FROM leads l LEFT JOIN users u ON u.id = l.assigned_to_user_id WHERE ${cohort} GROUP BY 1, 2`,
      ),
      this.rawScoped<{ key: string | null; name: string | null; leads: number; conv: number }>(
        tenantId,
        Prisma.sql`SELECT l.interested_plan_id::text AS key, p.name AS name, COUNT(*)::int AS leads, COUNT(*) FILTER (WHERE l.status::text = 'CONVERTED')::int AS conv
          FROM leads l LEFT JOIN membership_plans p ON p.id = l.interested_plan_id WHERE ${cohort} GROUP BY 1, 2`,
      ),
      this.rawScoped<{ reason: string; cnt: number }>(
        tenantId,
        Prisma.sql`SELECT l.lost_reason::text AS reason, COUNT(*)::int AS cnt FROM leads l
          WHERE ${base} AND l.status::text = 'LOST' AND l.lost_reason IS NOT NULL AND l.lost_at >= ${curFrom}::timestamp AND l.lost_at < ${curTo}::timestamp GROUP BY 1`,
      ),
      this.rawScoped<{ bucket: string; cnt: number }>(
        tenantId,
        Prisma.sql`SELECT CASE WHEN d <= 7 THEN '0-7' WHEN d <= 14 THEN '8-14' WHEN d <= 30 THEN '15-30' WHEN d <= 60 THEN '31-60' ELSE '61+' END AS bucket, COUNT(*)::int AS cnt
          FROM (SELECT FLOOR(EXTRACT(EPOCH FROM (${ts(now)} - l.created_at)) / 86400) AS d FROM leads l WHERE ${base} AND ${open}) t GROUP BY 1`,
      ),
      this.rawScoped<{ key: string; name: string; leads: number; conv: number }>(
        tenantId,
        Prisma.sql`SELECT b.id::text AS key, b.name AS name, COUNT(*)::int AS leads, COUNT(*) FILTER (WHERE l.status::text = 'CONVERTED')::int AS conv
          FROM leads l JOIN branches b ON b.id = l.branch_id WHERE ${cohort} GROUP BY 1, 2`,
      ),
    ]);

    const s = snap[0] ?? { open: 0, due_today: 0, overdue: 0 };
    const hd = head[0] ?? {};
    const hv = (k: string) => Number(hd[k] ?? 0);
    const funnelRows = funnel.map((r) => ({ stage: Number(r.stage), count: r.cnt }));
    return {
      range,
      previousRange,
      createdDaily: createdDaily.map((r) => ({ date: r.day, count: r.cnt, converted: r.conv })),
      convertedDaily: convertedDaily.map((r) => ({ date: r.day, count: r.cnt, daysSum: Number(r.days) })),
      lostDaily: lostDaily.map((r) => ({ date: r.day, count: r.cnt })),
      snapshot: { open: s.open, dueToday: s.due_today, overdue: s.overdue },
      headline: {
        today: { newLeads: hv('t_new'), converted: hv('t_conv'), previousNewLeads: hv('tp_new'), previousConverted: hv('tp_conv') },
        thisMonth: { newLeads: hv('m_new'), converted: hv('m_conv'), previousNewLeads: hv('mp_new'), previousConverted: hv('mp_conv') },
        thisYear: { newLeads: hv('y_new'), converted: hv('y_conv'), previousNewLeads: hv('yp_new'), previousConverted: hv('yp_conv') },
      },
      monthly: monthly.map((m) => ({ month: m.month, newLeads: m.cnt, converted: m.conv })),
      funnelRows,
      // Lost count inside the cohort, derived separately so the funnel header can show it.
      funnelLost: (await this.countWhere({ AND: [{ tenantId, deletedAt: null, status: 'LOST', createdAt: { gte: startOfDay(curFrom), lt: startOfDay(curTo) } }, branchWhere(branchId, scope.restrictToBranchIds)] })),
      bySource: bySource.map((r) => ({ key: r.key, leads: r.leads, converted: r.conv })),
      byStaff: byStaff.map((r) => ({ key: r.key, name: r.name, leads: r.leads, converted: r.conv })),
      byPlan: byPlan.map((r) => ({ key: r.key, name: r.name, leads: r.leads, converted: r.conv })),
      lostReasons: lostReasons.map((r) => ({ reason: r.reason, count: r.cnt })),
      ageing: ageing.map((r) => ({ bucket: r.bucket, count: r.cnt })),
      topBranches: topBranches.map((r) => ({ key: r.key, name: r.name, leads: r.leads, converted: r.conv })),
      now,
    };
  }
}
