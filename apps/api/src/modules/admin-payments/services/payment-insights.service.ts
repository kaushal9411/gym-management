import { AppError } from '../../../core/errors/app-error';
import { ErrorCode } from '../../../core/errors/error-codes';
import { prisma } from '../../../infrastructure/database/prisma';
import {
  loadDayStatus,
  loadFailureReasons,
  revenueInsightsService,
} from '../../admin-revenue/services/revenue-insights.service';
import {
  dayMap,
  dayStart,
  fillDays,
  money,
  resolveRevenueRanges,
  statusMix,
  successRate,
  windowStats,
  type RevenueRange,
} from '../../admin-revenue/utils/revenue-insights.util';
import { addDaysStr } from '../../finance/utils/payments-analytics.util';
import { buildPaymentTimeline, maskSensitive } from '../utils/payment-detail.util';
import {
  PAYMENT_EXPORT_CAP,
  buildInvoiceOrderBy,
  buildInvoiceWhere,
  buildPaymentOrderBy,
  buildPaymentWhere,
  invoiceCounts,
  invoiceSummary,
  paymentCounts,
  paymentSummary,
  todayStart,
  type InvoiceFilters,
  type InvoiceSort,
  type PaymentFilters,
  type PaymentSort,
  type SortDir,
} from '../utils/payment-filters.util';

const DAY_MS = 86_400_000;
type Dec = number | string | null;
const num = (v: Dec): number => Number(v ?? 0);

export type PaymentListParams = PaymentFilters & {
  sort?: PaymentSort;
  sortDir?: SortDir;
  page: number;
  limit: number;
};
export type InvoiceListParams = InvoiceFilters & {
  sort?: InvoiceSort;
  sortDir?: SortDir;
  page: number;
  limit: number;
};

const tenantSel = { select: { id: true, name: true, slug: true } } as const;

export class PaymentInsightsService {
  async list(p: PaymentListParams) {
    const where = buildPaymentWhere(p);
    const whereAllStatuses = buildPaymentWhere(p, { ignoreStatus: true });
    const [items, countGroups, sumGroups] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          tenant: tenantSel,
          invoice: { select: { invoiceNumber: true } },
          subscription: { select: { plan: { select: { name: true } } } },
        },
        orderBy: buildPaymentOrderBy(p.sort, p.sortDir),
        skip: (p.page - 1) * p.limit,
        take: p.limit,
      }),
      prisma.payment.groupBy({ by: ['status'], where: whereAllStatuses, _count: { _all: true } }),
      prisma.payment.groupBy({
        by: ['status', 'currency'],
        where,
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);
    const summary = paymentSummary(
      sumGroups.map((g) => ({
        status: g.status,
        currency: g.currency,
        count: g._count._all,
        amount: num(g._sum.amount?.toString() ?? null),
      })),
    );
    return {
      items: items.map(({ invoice, subscription, ...rest }) => ({
        ...rest,
        planName: subscription?.plan.name ?? null,
        invoiceNumber: invoice?.invoiceNumber ?? null,
      })),
      page: p.page,
      limit: p.limit,
      total: summary.count,
      totalPages: Math.ceil(summary.count / p.limit),
      counts: paymentCounts(
        countGroups.map((g) => ({ status: g.status, count: g._count._all, amount: 0 })),
      ),
      summary,
    };
  }

  async exportRows(f: PaymentFilters & { sort?: PaymentSort; sortDir?: SortDir }) {
    const where = buildPaymentWhere(f);
    const [matched, rows] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        include: {
          tenant: { select: { name: true, slug: true } },
          invoice: { select: { invoiceNumber: true } },
        },
        orderBy: buildPaymentOrderBy(f.sort, f.sortDir),
        take: PAYMENT_EXPORT_CAP,
      }),
    ]);
    return { rows, matched };
  }

  async getById(id: string) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        tenant: tenantSel,
        invoice: true,
        subscription: { select: { plan: { select: { name: true } } } },
        transactions: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!payment) throw new AppError(ErrorCode.NOT_FOUND, 'Payment not found', 404);
    const { subscription, ...rest } = payment;
    return {
      ...rest,
      planName: subscription?.plan.name ?? null,
      // Gateway payloads can carry card/UPI/email/phone — masked before leaving the API.
      metadata: maskSensitive(payment.metadata),
      transactions: payment.transactions.map((t) => ({
        ...t,
        rawPayload: maskSensitive(t.rawPayload),
      })),
      timeline: buildPaymentTimeline(payment),
    };
  }

  // ── Invoices ─────────────────────────────────────────────────────────────
  async listInvoices(p: InvoiceListParams) {
    const where = buildInvoiceWhere(p);
    const whereAll = buildInvoiceWhere(p, { ignoreStatus: true });
    const [items, countGroups, sumGroups, overdue] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: { tenant: tenantSel, coupon: { select: { code: true } } },
        orderBy: buildInvoiceOrderBy(p.sort, p.sortDir),
        skip: (p.page - 1) * p.limit,
        take: p.limit,
      }),
      prisma.invoice.groupBy({ by: ['status'], where: whereAll, _count: { _all: true } }),
      prisma.invoice.groupBy({
        by: ['status', 'currency'],
        where,
        _count: { _all: true },
        _sum: { total: true },
      }),
      prisma.invoice.count({
        where: { AND: [whereAll, { status: 'OPEN', dueDate: { lt: todayStart() } }] },
      }),
    ]);
    const summary = invoiceSummary(
      sumGroups.map((g) => ({
        status: g.status,
        currency: g.currency,
        count: g._count._all,
        amount: num(g._sum.total?.toString() ?? null),
      })),
    );
    return {
      items: items.map(({ coupon, ...rest }) => ({ ...rest, couponCode: coupon?.code ?? null })),
      page: p.page,
      limit: p.limit,
      total: summary.count,
      totalPages: Math.ceil(summary.count / p.limit),
      counts: invoiceCounts(
        countGroups.map((g) => ({ status: g.status, count: g._count._all, amount: 0 })),
        overdue,
      ),
      summary,
    };
  }

  async getInvoice(id: string) {
    const inv = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        tenant: tenantSel,
        coupon: { select: { code: true } },
        payment: {
          select: {
            id: true,
            provider: true,
            status: true,
            amount: true,
            currency: true,
            paidAt: true,
            gatewayReference: true,
          },
        },
        subscription: { select: { id: true, status: true, plan: { select: { name: true } } } },
      },
    });
    if (!inv) throw new AppError(ErrorCode.NOT_FOUND, 'Invoice not found', 404);
    const { payment, subscription, ...invoice } = inv;
    return {
      invoice,
      payments: payment ? [payment] : [],
      subscription: subscription
        ? { id: subscription.id, plan: subscription.plan.name, status: subscription.status }
        : null,
    };
  }

  // ── Overview ─────────────────────────────────────────────────────────────
  async overview(rangeKey: RevenueRange) {
    const now = new Date();
    const { range, previousRange } = resolveRevenueRanges(rangeKey, now);
    const winStart = dayStart(previousRange.from);
    const curStart = dayStart(range.from);
    const endExcl = dayStart(addDaysStr(range.to, 1));
    const staleBefore = new Date(now.getTime() - DAY_MS);

    const { currency, currencies } = await revenueInsightsService.resolveCurrency(
      winStart,
      endExcl,
    );

    const [dayRows, grouped, failureReasons, pendingNow, stuck, recent] = await Promise.all([
      loadDayStatus(winStart, endExcl, currency, staleBefore),
      prisma.$queryRaw<
        Array<{ provider: string; mode: string | null; status: string; n: number; amt: Dec }>
      >`
        SELECT provider::text AS provider, payment_mode::text AS mode, status::text AS status, count(*)::int AS n, sum(amount)::float8 AS amt
        FROM payments
        WHERE currency = ${currency} AND COALESCE(paid_at, created_at) >= ${curStart} AND COALESCE(paid_at, created_at) < ${endExcl}
        GROUP BY 1, 2, 3`,
      loadFailureReasons(curStart, endExcl, currency),
      prisma.payment.aggregate({
        where: { status: 'PENDING', currency },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.payment.findMany({
        where: { status: 'PENDING', createdAt: { lt: staleBefore } },
        orderBy: { createdAt: 'asc' },
        take: 8,
        include: { tenant: tenantSel },
      }),
      prisma.payment.findMany({
        where: {
          status: 'FAILED',
          OR: [
            { paidAt: { gte: curStart, lt: endExcl } },
            { paidAt: null, createdAt: { gte: curStart, lt: endExcl } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { tenant: tenantSel },
      }),
    ]);

    const cur = windowStats(dayRows, range);
    const prev = windowStats(dayRows, previousRange);
    const succN = dayMap(dayRows, 'SUCCEEDED', 'n');
    const succA = dayMap(dayRows, 'SUCCEEDED', 'amt');
    const failN = dayMap(dayRows, 'FAILED', 'n');
    const sc = fillDays(range, succN);
    const scPrev = fillDays(previousRange, succN);
    const sa = fillDays(range, succA);
    const fl = fillDays(range, failN);

    type Agg = { count: number; amount: number; succ: number; failed: number };
    const byProv = new Map<string, Agg>();
    const byMode = new Map<string, Agg>();
    const bump = (m: Map<string, Agg>, key: string, r: { status: string; n: number; amt: Dec }) => {
      const e = m.get(key) ?? { count: 0, amount: 0, succ: 0, failed: 0 };
      e.count += Number(r.n);
      if (r.status === 'SUCCEEDED') {
        e.amount += num(r.amt);
        e.succ += Number(r.n);
      } else if (r.status === 'FAILED') e.failed += Number(r.n);
      m.set(key, e);
    };
    for (const r of grouped) {
      bump(byProv, r.provider, r);
      bump(byMode, r.mode ?? 'GATEWAY', r);
    }
    const hours = (d: Date) => Math.floor((now.getTime() - d.getTime()) / 3_600_000);

    return {
      range,
      previousRange,
      currency,
      ...(currencies.length > 1
        ? {
            currencies,
            currencyNote: `Multiple currencies exist; amounts and charts are computed in ${currency} only (the dominant currency).`,
          }
        : {}),
      kpis: {
        collected: { value: money(cur.succeededAmount), previous: money(prev.succeededAmount) },
        succeededCount: { value: cur.succeededCount, previous: prev.succeededCount },
        failedCount: { value: cur.failedCount, previous: prev.failedCount },
        successRate: {
          value: successRate(cur.succeededCount, cur.failedCount),
          previous: successRate(prev.succeededCount, prev.failedCount),
        },
        pending: {
          count: pendingNow._count._all,
          amount: money(num(pendingNow._sum.amount?.toString() ?? null)),
        },
        avgTicket:
          cur.succeededCount > 0
            ? { value: money(cur.succeededAmount / cur.succeededCount) }
            : null,
      },
      daily: sc.map((p, i) => ({
        date: p.date,
        succeeded: p.value,
        failed: fl[i]!.value,
        previousSucceeded: scPrev[i]?.value ?? 0,
        succeededAmount: money(sa[i]!.value),
      })),
      byProvider: [...byProv.entries()]
        .map(([provider, e]) => ({
          provider,
          count: e.count,
          amount: money(e.amount),
          successRate: successRate(e.succ, e.failed),
        }))
        .sort((a, b) => b.count - a.count),
      byMode: [...byMode.entries()]
        .map(([mode, e]) => ({ mode, count: e.count, amount: money(e.amount) }))
        .sort((a, b) => b.count - a.count),
      statusMix: statusMix(grouped.map((r) => ({ status: r.status, n: r.n, amt: num(r.amt) }))),
      failureReasons,
      pendingStuck: stuck.map((p) => ({
        paymentId: p.id,
        tenant: p.tenant,
        amount: p.amount.toFixed(2),
        currency: p.currency,
        createdAt: p.createdAt.toISOString(),
        ageHours: hours(p.createdAt),
      })),
      recentFailures: recent.map((p) => ({
        paymentId: p.id,
        tenant: p.tenant,
        amount: p.amount.toFixed(2),
        currency: p.currency,
        reason: p.failureReason,
        at: (p.paidAt ?? p.createdAt).toISOString(),
      })),
    };
  }
}

export const paymentInsightsService = new PaymentInsightsService();
