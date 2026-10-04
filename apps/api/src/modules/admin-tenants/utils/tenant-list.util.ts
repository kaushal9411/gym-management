import {
  computeHealth,
  healthBucket,
  type HealthBucket,
  type HealthComponents,
} from './tenant-health.util';

const DAY_MS = 86_400_000;

export const TENANT_VIEWS = [
  'trials_ending',
  'at_risk',
  'past_due',
  'suspended',
  'near_limits',
] as const;
export type TenantView = (typeof TENANT_VIEWS)[number];
export const TENANT_SORTS = [
  'mrr',
  'createdAt',
  'lastActiveAt',
  'members',
  'health',
  'name',
] as const;
export type TenantSort = (typeof TENANT_SORTS)[number];
export type TenantStatusKey = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';

/** One tenant's raw facts as loaded by the repository (one row per non-deleted tenant). */
export interface TenantFact {
  id: string;
  slug: string;
  name: string;
  status: string;
  trialEndsAt: Date | null;
  suspendedAt: Date | null;
  maintenanceMode: boolean;
  createdAt: Date;
  ownerName: string | null;
  ownerEmail: string | null;
  planId: string | null;
  planName: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
  graceEndsAt: Date | null;
  /** Monthly-normalised MRR of ACTIVE subscriptions; null when the tenant has none. */
  mrr: number | null;
  members: number | null;
  membersLimit: number | null;
  branches: number | null;
  country: string | null;
  maxUtilisation: number | null;
  lastActiveAt: Date | null;
  attendanceRecent: number;
  paymentFailed: boolean;
  openTickets: number;
}

// ── Filters ────────────────────────────────────────────────────────────────
export interface ListFilters {
  search?: string;
  status?: TenantStatusKey;
  plan?: string;
  country?: string;
  createdFrom?: string;
  createdTo?: string;
  health?: HealthBucket;
  view?: TenantView;
  tag?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Escapes `%`, `_` and `\` so user input is a literal inside ILIKE. */
export const escapeLike = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export interface SqlFilters {
  searchPattern: string | null;
  planId: string | null;
  planName: string | null;
  country: string | null;
  createdFrom: Date | null;
  /** Exclusive upper bound (the day after `createdTo`). */
  createdToExclusive: Date | null;
}

/** Search/plan/country/createdAt -> the SQL-level (DB) filters. status/view/health are applied in memory so counts can ignore them. */
export function toSqlFilters(f: ListFilters): SqlFilters {
  const plan = f.plan?.trim();
  const search = f.search?.trim();
  return {
    searchPattern: search ? `%${escapeLike(search)}%` : null,
    planId: plan && UUID_RE.test(plan) ? plan.toLowerCase() : null,
    planName: plan && !UUID_RE.test(plan) ? plan.toLowerCase() : null,
    country: f.country?.trim() ? f.country.trim().toUpperCase() : null,
    createdFrom: f.createdFrom ? new Date(`${f.createdFrom}T00:00:00Z`) : null,
    createdToExclusive: f.createdTo
      ? new Date(new Date(`${f.createdTo}T00:00:00Z`).getTime() + DAY_MS)
      : null,
  };
}

// ── Views / at-risk ────────────────────────────────────────────────────────
export type AtRiskReason =
  'PAYMENT_FAILED' | 'GRACE' | 'PAST_DUE' | 'SUSPENDED_RECENTLY' | 'NEAR_LIMIT';

export const isNearLimits = (t: TenantFact): boolean =>
  t.maxUtilisation !== null && t.maxUtilisation >= 0.9;

/** Same reasons/precedence as the dashboard overview's `atRisk` (most severe wins). */
export function atRiskReason(t: TenantFact, now: Date = new Date()): AtRiskReason | null {
  if (t.paymentFailed) return 'PAYMENT_FAILED';
  if (t.subscriptionStatus === 'GRACE') return 'GRACE';
  if (t.subscriptionStatus === 'PAST_DUE' || t.status === 'PAST_DUE') return 'PAST_DUE';
  if (
    t.status === 'SUSPENDED' &&
    t.suspendedAt &&
    now.getTime() - t.suspendedAt.getTime() <= 14 * DAY_MS
  )
    return 'SUSPENDED_RECENTLY';
  if (isNearLimits(t)) return 'NEAR_LIMIT';
  return null;
}

export function isTrialEnding(t: TenantFact, now: Date = new Date()): boolean {
  return (
    t.status === 'TRIAL' &&
    t.trialEndsAt !== null &&
    t.trialEndsAt.getTime() >= now.getTime() &&
    t.trialEndsAt.getTime() <= now.getTime() + 14 * DAY_MS
  );
}

export function matchesView(t: TenantFact, view: TenantView, now: Date = new Date()): boolean {
  switch (view) {
    case 'trials_ending':
      return isTrialEnding(t, now);
    case 'at_risk':
      return atRiskReason(t, now) !== null;
    case 'past_due':
      return t.status === 'PAST_DUE';
    case 'suspended':
      return t.status === 'SUSPENDED';
    case 'near_limits':
      return isNearLimits(t);
  }
}

export interface ScoredTenant extends TenantFact {
  healthScore: number;
  healthComponents: HealthComponents;
  healthBucket: HealthBucket;
  atRiskReason: AtRiskReason | null;
}

export function scoreTenant(t: TenantFact, now: Date = new Date()): ScoredTenant {
  const { score, components } = computeHealth(
    {
      tenantStatus: t.status,
      subscriptionStatus: t.subscriptionStatus,
      trialEndsAt: t.trialEndsAt,
      paymentFailed: t.paymentFailed,
      lastActiveAt: t.lastActiveAt,
      attendanceRecent: t.attendanceRecent,
      members: t.members,
      membersUtilisation:
        t.members !== null && t.membersLimit !== null && t.membersLimit > 0
          ? t.members / t.membersLimit
          : null,
      maxUtilisation: t.maxUtilisation,
      paid: t.subscriptionStatus === 'ACTIVE', // same definition as the detail overview
      openTickets: t.openTickets,
      createdAt: t.createdAt,
    },
    now,
  );
  return {
    ...t,
    healthScore: score,
    healthComponents: components,
    healthBucket: healthBucket(score),
    atRiskReason: atRiskReason(t, now),
  };
}

/** status/view/health filters applied to scored tenants (search/plan/country/createdAt were already applied in SQL). */
export function applyMemoryFilters(
  rows: ScoredTenant[],
  f: Pick<ListFilters, 'status' | 'view' | 'health'>,
  now: Date = new Date(),
  tagIds?: Set<string> | null,
): ScoredTenant[] {
  return rows.filter(
    (t) =>
      (!tagIds || tagIds.has(t.id)) &&
      (!f.status || t.status === f.status) &&
      (!f.view || matchesView(t, f.view, now)) &&
      (!f.health || t.healthBucket === f.health),
  );
}

export interface TenantCounts {
  all: number;
  active: number;
  trial: number;
  pastDue: number;
  suspended: number;
  cancelled: number;
  trialsEnding: number;
  atRisk: number;
  nearLimits: number;
}

/** Tenant-wide counts over the rows that passed search/plan/country/createdAt (ignores status/view/health). */
export function computeCounts(rows: ScoredTenant[], now: Date = new Date()): TenantCounts {
  const c: TenantCounts = {
    all: rows.length,
    active: 0,
    trial: 0,
    pastDue: 0,
    suspended: 0,
    cancelled: 0,
    trialsEnding: 0,
    atRisk: 0,
    nearLimits: 0,
  };
  for (const t of rows) {
    if (t.status === 'ACTIVE') c.active++;
    else if (t.status === 'TRIAL') c.trial++;
    else if (t.status === 'PAST_DUE') c.pastDue++;
    else if (t.status === 'SUSPENDED') c.suspended++;
    else if (t.status === 'CANCELLED') c.cancelled++;
    if (isTrialEnding(t, now)) c.trialsEnding++;
    if (t.atRiskReason) c.atRisk++;
    if (isNearLimits(t)) c.nearLimits++;
  }
  return c;
}

// ── Sorting ────────────────────────────────────────────────────────────────
export function sortTenants(
  rows: ScoredTenant[],
  sort: TenantSort = 'createdAt',
  dir: 'asc' | 'desc' = 'desc',
): ScoredTenant[] {
  const sign = dir === 'asc' ? 1 : -1;
  const num = (t: ScoredTenant): number | null => {
    switch (sort) {
      case 'mrr':
        return t.mrr;
      case 'members':
        return t.members;
      case 'health':
        return t.healthScore;
      case 'lastActiveAt':
        return t.lastActiveAt ? t.lastActiveAt.getTime() : null;
      case 'createdAt':
        return t.createdAt.getTime();
      default:
        return null;
    }
  };
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      let cmp: number;
      if (sort === 'name') {
        cmp = sign * a.r.name.localeCompare(b.r.name, 'en', { sensitivity: 'base' });
      } else {
        const x = num(a.r);
        const y = num(b.r);
        if (x === y) cmp = 0;
        else if (x === null)
          return 1; // nulls always last, whatever the direction
        else if (y === null) return -1;
        else cmp = sign * (x - y);
      }
      return cmp || a.r.id.localeCompare(b.r.id) || a.i - b.i;
    })
    .map((x) => x.r);
}

// ── Response mapping ───────────────────────────────────────────────────────
export const money = (n: number): string => n.toFixed(2);

export function toListItem(t: ScoredTenant, tags: string[] = []) {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    status: t.status,
    trialEndsAt: t.trialEndsAt,
    createdAt: t.createdAt,
    owner: t.ownerEmail ? { name: t.ownerName ?? '', email: t.ownerEmail } : null,
    plan: t.planName,
    planId: t.planId,
    planName: t.planName,
    subscriptionStatus: t.subscriptionStatus,
    mrr: t.mrr === null ? null : money(t.mrr),
    members: t.members,
    membersLimit: t.membersLimit,
    branches: t.branches,
    country: t.country,
    renewsAt: t.subscriptionStatus === 'ACTIVE' ? t.currentPeriodEnd : null,
    lastActiveAt: t.lastActiveAt ? t.lastActiveAt.toISOString() : null,
    healthScore: t.healthScore,
    healthComponents: t.healthComponents,
    atRiskReason: t.atRiskReason,
    maintenanceMode: t.maintenanceMode,
    tags,
  };
}

// ── CSV ────────────────────────────────────────────────────────────────────
export const EXPORT_ROW_CAP = 5000;
export const CSV_HEADERS = [
  'Name',
  'Slug',
  'Owner email',
  'Plan',
  'Status',
  'MRR',
  'Members',
  'Country',
  'Created',
  'Renews / trial end',
  'Last active',
  'Health',
  'Tags',
] as const;

/** RFC 4180 quoting + spreadsheet formula-injection guard (cells starting `= + - @ tab CR` get a leading `'`). */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const csvRow = (cells: Array<string | number | null | undefined>): string =>
  cells.map(csvCell).join(',') + '\r\n';

const day = (d: Date | null): string => (d ? d.toISOString().slice(0, 10) : '');

export function tenantCsvRow(t: ScoredTenant, tags: string[] = []): string {
  const end =
    t.status === 'TRIAL'
      ? t.trialEndsAt
      : t.subscriptionStatus === 'ACTIVE'
        ? t.currentPeriodEnd
        : null;
  return csvRow([
    t.name,
    t.slug,
    t.ownerEmail,
    t.planName,
    t.status,
    t.mrr === null ? '' : money(t.mrr),
    t.members,
    t.country,
    day(t.createdAt),
    day(end),
    day(t.lastActiveAt),
    t.healthScore,
    tags.join(';'),
  ]);
}

// ── Insights ───────────────────────────────────────────────────────────────
/** 12 consecutive 'YYYY-MM' keys ending at the month of `now` (UTC). */
export function lastMonths(count: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

/** Cumulative non-deleted tenants per month: `baseline` = tenants created before the first month. */
export function buildGrowth(
  months: string[],
  newByMonth: Map<string, number>,
  baseline: number,
): Array<{ month: string; total: number; new: number }> {
  let total = baseline;
  return months.map((month) => {
    const n = newByMonth.get(month) ?? 0;
    total += n;
    return { month, total, new: n };
  });
}

export function buildPlanMix(rows: ScoredTenant[]) {
  const agg = new Map<string, { planName: string; tenants: number; mrr: number }>();
  for (const t of rows) {
    if (!t.planId) continue;
    const e = agg.get(t.planId) ?? { planName: t.planName ?? '', tenants: 0, mrr: 0 };
    e.tenants++;
    e.mrr += t.mrr ?? 0;
    agg.set(t.planId, e);
  }
  return [...agg.entries()]
    .map(([planId, e]) => ({ planId, planName: e.planName, tenants: e.tenants, mrr: money(e.mrr) }))
    .sort((a, b) => b.tenants - a.tenants || a.planName.localeCompare(b.planName));
}

/** `weeks` rolling 7-day buckets starting today (UTC date); every bucket present, zero-filled. */
export function buildRenewals(
  subs: Array<{ currentPeriodEnd: Date; monthly: number }>,
  weeks = 8,
  now: Date = new Date(),
): Array<{ weekStart: string; tenants: number; expectedMrr: string }> {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const buckets = Array.from({ length: weeks }, (_, i) => ({
    weekStart: new Date(start + i * 7 * DAY_MS).toISOString().slice(0, 10),
    tenants: 0,
    mrr: 0,
  }));
  for (const s of subs) {
    const idx = Math.floor((s.currentPeriodEnd.getTime() - start) / (7 * DAY_MS));
    const b = buckets[idx];
    if (idx >= 0 && b) {
      b.tenants++;
      b.mrr += s.monthly;
    }
  }
  return buckets.map((b) => ({
    weekStart: b.weekStart,
    tenants: b.tenants,
    expectedMrr: money(b.mrr),
  }));
}

// ── Bulk ───────────────────────────────────────────────────────────────────
export interface BulkResult {
  tenantId: string;
  ok: boolean;
  error?: string;
}

/** Runs `fn` for each id sequentially, never aborting on a failure; `describe` turns a thrown error into a safe message. */
export async function runBulk(
  tenantIds: string[],
  fn: (tenantId: string) => Promise<void>,
  describe: (err: unknown) => string,
): Promise<{ results: BulkResult[]; succeeded: number; failed: number }> {
  const results: BulkResult[] = [];
  for (const tenantId of [...new Set(tenantIds)]) {
    try {
      await fn(tenantId);
      results.push({ tenantId, ok: true });
    } catch (err) {
      results.push({ tenantId, ok: false, error: describe(err) });
    }
  }
  const succeeded = results.filter((r) => r.ok).length;
  return { results, succeeded, failed: results.length - succeeded };
}
