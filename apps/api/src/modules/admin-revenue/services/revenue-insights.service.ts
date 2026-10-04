import { prisma } from '../../../infrastructure/database/prisma';
import { addDaysStr } from '../../finance/utils/payments-analytics.util';
import {
  aggregateMrr,
  bucketAging,
  buildRevenueCsv,
  collectionRate,
  dayMap,
  dayStart,
  daysOverdue,
  fillDays,
  lastMonths,
  money,
  pickDominantCurrency,
  resolveRevenueRanges,
  sortDunning,
  statusMix,
  windowStats,
  type DayStatusRow,
  type MrrRow,
  type RevenueRange,
} from '../utils/revenue-insights.util';

const DAY_MS = 86_400_000;
// Event time of a payment everywhere below: COALESCE(paid_at, created_at) — the paid date when present, else when it was recorded.

type Dec = number | string | null;
const num = (v: Dec): number => Number(v ?? 0);

/** ACTIVE + TRIALING subscription groups with their plan prices (one grouped query + one plan lookup; no N+1). */
export async function loadMrrRows(): Promise<MrrRow[]> {
  const groups = await prisma.subscription.groupBy({
    by: ['planId', 'billingCycle', 'status'],
    where: { status: { in: ['ACTIVE', 'TRIALING'] }, tenant: { deletedAt: null } },
    _count: { _all: true },
  });
  if (!groups.length) return [];
  const plans = await prisma.subscriptionPlan.findMany({
    where: { id: { in: [...new Set(groups.map((g) => g.planId))] } },
  });
  const byId = new Map(plans.map((p) => [p.id, p]));
  return groups.flatMap((g) => {
    const p = byId.get(g.planId);
    return p
      ? [
          {
            planId: p.id,
            planName: p.name,
            currency: p.currency,
            billingCycle: g.billingCycle,
            status: g.status,
            count: g._count._all,
            priceMonthly: Number(p.priceMonthly),
            priceYearly: Number(p.priceYearly),
          },
        ]
      : [];
  });
}

/** Payments grouped by (event day, status, stale-pending) in one currency across [winStart, endExcl). */
export async function loadDayStatus(
  winStart: Date,
  endExcl: Date,
  currency: string,
  staleBefore: Date,
): Promise<DayStatusRow[]> {
  const rows = await prisma.$queryRaw<
    Array<{ d: string; status: string; stale: boolean; amt: Dec; n: number }>
  >`
    SELECT to_char(COALESCE(paid_at, created_at), 'YYYY-MM-DD') AS d, status::text AS status,
           (status::text = 'PENDING' AND created_at < ${staleBefore}) AS stale,
           sum(amount)::float8 AS amt, count(*)::int AS n
    FROM payments
    WHERE currency = ${currency} AND COALESCE(paid_at, created_at) >= ${winStart} AND COALESCE(paid_at, created_at) < ${endExcl}
    GROUP BY 1, 2, 3`;
  return rows.map((r) => ({
    d: r.d,
    status: r.status,
    stale: r.stale,
    amt: num(r.amt),
    n: Number(r.n),
  }));
}

/** Currencies seen in payments over [winStart, endExcl) with the SUCCEEDED total of each. */
export async function loadPaymentCurrencies(winStart: Date, endExcl: Date) {
  const rows = await prisma.$queryRaw<Array<{ currency: string; amount: Dec }>>`
    SELECT currency, COALESCE(sum(amount) FILTER (WHERE status::text = 'SUCCEEDED'), 0)::float8 AS amount
    FROM payments WHERE COALESCE(paid_at, created_at) >= ${winStart} AND COALESCE(paid_at, created_at) < ${endExcl}
    GROUP BY 1`;
  return rows.map((r) => ({ currency: r.currency.trim(), amount: num(r.amount) }));
}

export async function loadFailureReasons(from: Date, endExcl: Date, currency: string) {
  const rows = await prisma.$queryRaw<Array<{ reason: string; n: number; amt: Dec }>>`
    SELECT COALESCE(NULLIF(trim(failure_reason), ''), 'Unspecified') AS reason, count(*)::int AS n, sum(amount)::float8 AS amt
    FROM payments
    WHERE status::text = 'FAILED' AND currency = ${currency}
      AND COALESCE(paid_at, created_at) >= ${from} AND COALESCE(paid_at, created_at) < ${endExcl}
    GROUP BY 1 ORDER BY n DESC, amt DESC, reason ASC LIMIT 8`;
  return rows.map((r) => ({ reason: r.reason, count: Number(r.n), amount: money(num(r.amt)) }));
}

export class RevenueInsightsService {
  /** Dominant currency for money KPIs (most collected in the window, then most MRR, else INR) + every currency seen. */
  async resolveCurrency(winStart: Date, endExcl: Date, mrrRows?: MrrRow[]) {
    const [paid, rows] = await Promise.all([
      loadPaymentCurrencies(winStart, endExcl),
      mrrRows ? Promise.resolve(mrrRows) : loadMrrRows(),
    ]);
    const agg = aggregateMrr(rows);
    const picked = pickDominantCurrency(
      paid,
      agg.byCurrency.map((c) => ({ currency: c.currency, mrr: c.mrr })),
      rows.map((r) => r.currency),
    );
    return { ...picked, mrrRows: rows, agg };
  }

  async overview(rangeKey: RevenueRange) {
    const now = new Date();
    const { range, previousRange } = resolveRevenueRanges(rangeKey, now);
    const winStart = dayStart(previousRange.from);
    const curStart = dayStart(range.from);
    const endExcl = dayStart(addDaysStr(range.to, 1));
    const today = now.toISOString().slice(0, 10);
    const staleBefore = new Date(now.getTime() - DAY_MS);
    const months = lastMonths(now, 12);
    const monthStart = dayStart(`${months[0]}-01`);

    const { currency, currencies, agg } = await this.resolveCurrency(winStart, endExcl);

    const [
      dayRows,
      monthlyRows,
      provRows,
      byCurrencyRows,
      countryRows,
      failureReasons,
      dunningRows,
      agingRows,
      topRows,
      avgInvoiceRows,
    ] = await Promise.all([
      loadDayStatus(winStart, endExcl, currency, staleBefore),
      prisma.$queryRaw<Array<{ m: string; amt: Dec }>>`
        SELECT to_char(COALESCE(paid_at, created_at), 'YYYY-MM') AS m, sum(amount)::float8 AS amt FROM payments
        WHERE status::text = 'SUCCEEDED' AND currency = ${currency}
          AND COALESCE(paid_at, created_at) >= ${monthStart} AND COALESCE(paid_at, created_at) < ${endExcl}
        GROUP BY 1`,
      prisma.$queryRaw<Array<{ provider: string; status: string; n: number; amt: Dec }>>`
        SELECT provider::text AS provider, status::text AS status, count(*)::int AS n, sum(amount)::float8 AS amt FROM payments
        WHERE currency = ${currency} AND COALESCE(paid_at, created_at) >= ${curStart} AND COALESCE(paid_at, created_at) < ${endExcl}
        GROUP BY 1, 2`,
      prisma.$queryRaw<Array<{ currency: string; amt: Dec }>>`
        SELECT currency, sum(amount)::float8 AS amt FROM payments
        WHERE status::text = 'SUCCEEDED' AND COALESCE(paid_at, created_at) >= ${curStart} AND COALESCE(paid_at, created_at) < ${endExcl}
        GROUP BY 1 ORDER BY amt DESC`,
      prisma.$queryRaw<Array<{ country: string; amt: Dec; tenants: number }>>`
        SELECT COALESCE(NULLIF(ba.country, ''), 'Unknown') AS country, sum(p.amount)::float8 AS amt,
               count(DISTINCT p.tenant_id)::int AS tenants
        FROM payments p LEFT JOIN billing_addresses ba ON ba.tenant_id = p.tenant_id
        WHERE p.status::text = 'SUCCEEDED' AND p.currency = ${currency}
          AND COALESCE(p.paid_at, p.created_at) >= ${curStart} AND COALESCE(p.paid_at, p.created_at) < ${endExcl}
        GROUP BY 1 ORDER BY amt DESC LIMIT 12`,
      loadFailureReasons(curStart, endExcl, currency),
      prisma.$queryRaw<
        Array<{
          tenant_id: string;
          slug: string;
          name: string;
          plan: string;
          status: string;
          grace_ends_at: Date | null;
          current_period_end: Date | null;
          amt: Dec;
          due: Date | null;
        }>
      >`
        SELECT s.tenant_id, t.slug, t.name, sp.name AS plan, s.status::text AS status, s.grace_ends_at,
               s.current_period_end, inv.amt::text AS amt, inv.due
        FROM subscriptions s
        JOIN tenants t ON t.id = s.tenant_id AND t.deleted_at IS NULL
        JOIN subscription_plans sp ON sp.id = s.plan_id
        LEFT JOIN LATERAL (SELECT sum(i.total) AS amt, min(i.due_date) AS due FROM invoices i
                           WHERE i.tenant_id = s.tenant_id AND i.status::text = 'OPEN') inv ON true
        WHERE s.status::text IN ('PAST_DUE', 'GRACE')
        ORDER BY s.grace_ends_at ASC NULLS LAST, s.updated_at DESC LIMIT 10`,
      prisma.$queryRaw<Array<{ due: string | null; n: number; amt: Dec }>>`
        SELECT to_char(due_date, 'YYYY-MM-DD') AS due, count(*)::int AS n, sum(total)::float8 AS amt FROM invoices
        WHERE status::text = 'OPEN' AND currency = ${currency} GROUP BY 1`,
      prisma.$queryRaw<
        Array<{ tenant_id: string; slug: string; name: string; amt: Dec; plan: string | null }>
      >`
        SELECT p.tenant_id, t.slug, t.name, sum(p.amount)::float8 AS amt,
               (SELECT sp.name FROM subscriptions s JOIN subscription_plans sp ON sp.id = s.plan_id
                WHERE s.tenant_id = p.tenant_id ORDER BY s.created_at DESC LIMIT 1) AS plan
        FROM payments p JOIN tenants t ON t.id = p.tenant_id
        WHERE p.status::text = 'SUCCEEDED' AND p.currency = ${currency}
          AND COALESCE(p.paid_at, p.created_at) >= ${curStart} AND COALESCE(p.paid_at, p.created_at) < ${endExcl}
        GROUP BY p.tenant_id, t.slug, t.name ORDER BY amt DESC, t.name ASC LIMIT 5`,
      prisma.$queryRaw<Array<{ avg: Dec }>>`
        SELECT avg(total)::float8 AS avg FROM invoices
        WHERE status::text = 'PAID' AND currency = ${currency}
          AND COALESCE(paid_at, created_at) >= ${curStart} AND COALESCE(paid_at, created_at) < ${endExcl}`,
    ]);

    const cur = windowStats(dayRows, range);
    const prev = windowStats(dayRows, previousRange);
    const succ = fillDays(range, dayMap(dayRows, 'SUCCEEDED', 'amt'));
    const succPrev = fillDays(previousRange, dayMap(dayRows, 'SUCCEEDED', 'amt'));
    const failed = fillDays(range, dayMap(dayRows, 'FAILED', 'n'));

    const mine = agg.byCurrency.find((c) => c.currency === currency);
    const mrr = mine?.mrr ?? 0;
    const activeSubs = mine?.activeSubscribers ?? 0;
    const outstandingCount = agingRows.reduce((a, r) => a + Number(r.n), 0);
    const outstandingAmount = agingRows.reduce((a, r) => a + num(r.amt), 0);

    const monthMap = new Map(monthlyRows.map((r) => [r.m, num(r.amt)]));
    const prov = new Map<
      string,
      { collected: number; transactions: number; succ: number; failed: number }
    >();
    for (const r of provRows) {
      const e = prov.get(r.provider) ?? { collected: 0, transactions: 0, succ: 0, failed: 0 };
      e.transactions += Number(r.n);
      if (r.status === 'SUCCEEDED') {
        e.collected += num(r.amt);
        e.succ += Number(r.n);
      } else if (r.status === 'FAILED') e.failed += Number(r.n);
      prov.set(r.provider, e);
    }

    const dunning = sortDunning(
      dunningRows.map((r) => ({
        ...r,
        graceEndsAt: r.grace_ends_at,
      })),
    ).map((r) => ({
      tenantId: r.tenant_id,
      slug: r.slug,
      name: r.name,
      plan: r.plan,
      status: r.status as 'PAST_DUE' | 'GRACE',
      graceEndsAt: r.graceEndsAt ? r.graceEndsAt.toISOString() : null,
      amountDue: r.amt === null ? null : money(num(r.amt)),
      daysOverdue: daysOverdue(r.due ?? r.current_period_end, today),
    }));

    return {
      range,
      previousRange,
      currency,
      ...(currencies.length > 1
        ? {
            currencies,
            currencyNote: `Multiple currencies exist; money KPIs and charts are computed in ${currency} only (the dominant currency).`,
          }
        : {}),
      kpis: {
        mrr: { value: money(mrr), previous: null },
        arr: { value: money(mrr * 12) },
        arpa: activeSubs > 0 ? { value: money(mrr / activeSubs) } : null,
        collected: { value: money(cur.succeededAmount), previous: money(prev.succeededAmount) },
        failed: {
          count: cur.failedCount,
          amount: money(cur.failedAmount),
          previousCount: prev.failedCount,
        },
        collectionRate: {
          value: collectionRate(cur.succeededAmount, cur.failedAmount, cur.stalePendingAmount),
          previous: collectionRate(
            prev.succeededAmount,
            prev.failedAmount,
            prev.stalePendingAmount,
          ),
        },
        avgInvoice:
          avgInvoiceRows[0]?.avg == null ? null : { value: money(num(avgInvoiceRows[0].avg)) },
        outstanding: { value: money(outstandingAmount), invoiceCount: outstandingCount },
        pipelineMrr: { value: money(mine?.mrrTrialing ?? 0) },
      },
      daily: succ.map((p, i) => ({
        date: p.date,
        collected: money(p.value),
        failed: failed[i]!.value,
        previousCollected: money(succPrev[i]?.value ?? 0),
      })),
      monthly: months.map((month) => ({ month, collected: money(monthMap.get(month) ?? 0) })),
      mrrByPlan: agg.byPlan
        .filter((p) => p.currency === currency)
        .map((p) => ({
          planId: p.planId,
          planName: p.planName,
          mrr: money(p.mrr),
          activeSubscribers: p.activeSubscribers,
          share: mrr > 0 ? Math.round((p.mrr / mrr) * 10_000) / 10_000 : 0,
        })),
      byGateway: [...prov.entries()]
        .map(([provider, e]) => ({
          provider,
          collected: money(e.collected),
          transactions: e.transactions,
          successRate:
            e.succ + e.failed > 0
              ? Math.round((e.succ / (e.succ + e.failed)) * 10_000) / 10_000
              : 0,
        }))
        .sort((a, b) => Number(b.collected) - Number(a.collected)),
      byCurrency: byCurrencyRows.map((r) => ({
        currency: r.currency.trim(),
        collected: money(num(r.amt)),
      })),
      byCountry: countryRows.map((r) => ({
        country: r.country,
        collected: money(num(r.amt)),
        tenants: Number(r.tenants),
      })),
      statusMix: statusMix(provRows.map((r) => ({ status: r.status, n: r.n, amt: num(r.amt) }))),
      failureReasons,
      dunning,
      invoiceAging: bucketAging(
        agingRows.map((r) => ({ due: r.due, count: r.n, amount: num(r.amt) })),
        today,
      ),
      topTenants: topRows.map((r) => ({
        tenantId: r.tenant_id,
        slug: r.slug,
        name: r.name,
        collected: money(num(r.amt)),
        plan: r.plan,
      })),
      // No historical MRR snapshots exist (plan changes overwrite planId; no activation timestamps). A daily
      // snapshot table would be required to chart MRR history / new-vs-churned MRR; deliberately not estimated.
      mrrHistory: null,
      newVsChurnedMrr: null,
    };
  }

  /** Single-table CSV: one row per UTC day of the range. Returns the body and row count. */
  async exportCsv(rangeKey: RevenueRange) {
    const now = new Date();
    const { range } = resolveRevenueRanges(rangeKey, now);
    const curStart = dayStart(range.from);
    const endExcl = dayStart(addDaysStr(range.to, 1));
    const { currency } = await this.resolveCurrency(curStart, endExcl);
    const rows = await loadDayStatus(curStart, endExcl, currency, new Date(now.getTime() - DAY_MS));
    const collected = dayMap(rows, 'SUCCEEDED', 'amt');
    const count = dayMap(rows, 'SUCCEEDED', 'n');
    const failed = dayMap(rows, 'FAILED', 'n');
    const out = fillDays(range, collected).map((p) => ({
      date: p.date,
      collected: money(p.value),
      failed: failed.get(p.date) ?? 0,
      payments: count.get(p.date) ?? 0,
    }));
    return { range, currency, rows: out.length, csv: buildRevenueCsv(out, currency) };
  }
}

export const revenueInsightsService = new RevenueInsightsService();
