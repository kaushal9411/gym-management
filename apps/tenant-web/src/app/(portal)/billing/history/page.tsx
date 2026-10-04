'use client';

import * as React from 'react';
import { AlertTriangle, CalendarClock, Hash, Receipt, Wallet } from 'lucide-react';

import { FormAlert } from '@/features/auth/components/form-alert';
import { BillingHero } from '@/features/billing/components/billing-hero';
import { EmptyBlock, formatMoney, StatusPill, SummaryCard } from '@/features/billing/components/billing-ui';
import { SpendChart } from '@/features/billing/components/spend-chart';
import { toBillingError, usePaymentHistory } from '@/features/billing/hooks/use-billing';
import { Chip, PanelCard } from '@/features/finance/components/payments/payments-ui';
import { Skeleton } from '@/components/ui/skeleton';

const FILTERS = ['ALL', 'SUCCEEDED', 'PENDING', 'FAILED', 'REFUNDED'] as const;
type Filter = (typeof FILTERS)[number];

export default function PaymentHistoryPage() {
  const { data: payments, isLoading, isError, error } = usePaymentHistory();
  const [filter, setFilter] = React.useState<Filter>('ALL');

  const derived = React.useMemo(() => {
    const list = payments ?? [];
    const paid = list.filter((p) => p.status === 'SUCCEEDED');
    const currency = list[0]?.currency ?? 'USD';
    const sameCurrency = paid.filter((p) => p.currency === currency);
    const total = sameCurrency.reduce((s, p) => s + p.amount, 0);
    const failed = list.filter((p) => p.status === 'FAILED').length;
    const last = [...paid].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];

    // Spend by calendar month (successful payments only), chronological.
    const byMonth = new Map<string, number>();
    for (const p of sameCurrency) {
      const d = new Date(p.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(key, (byMonth.get(key) ?? 0) + p.amount);
    }
    const points = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, amount]) => {
        const [y, m] = key.split('-').map(Number);
        return { label: new Date(y!, m! - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), amount };
      });
    return { currency, total, failed, last, points, paidCount: paid.length };
  }, [payments]);

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { ALL: payments?.length ?? 0 };
    for (const p of payments ?? []) {
      const key = p.status === 'PARTIALLY_REFUNDED' ? 'REFUNDED' : p.status;
      c[key] = (c[key] ?? 0) + 1;
    }
    return c;
  }, [payments]);

  const visible = (payments ?? []).filter((p) => filter === 'ALL' || (filter === 'REFUNDED' ? p.status === 'REFUNDED' || p.status === 'PARTIALLY_REFUNDED' : p.status === filter));
  const has = !!payments && payments.length > 0;

  return (
    <div className="space-y-6">
      <BillingHero
        subtitle="Every payment attempt for your FitCloud subscription."
        statsLoading={isLoading}
        stats={[
          { value: formatMoney(derived.total, derived.currency), label: 'Total paid' },
          { value: payments?.length ?? 0, label: 'Payments' },
        ]}
      />

      {isError ? (
        <FormAlert variant="error" message={toBillingError(error).message} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard loading={isLoading} icon={<Wallet />} label="Total paid" value={formatMoney(derived.total, derived.currency)} hint={`${derived.paidCount} successful`} color="var(--chart-1)" />
            <SummaryCard loading={isLoading} icon={<Hash />} label="Payments" value={payments?.length ?? 0} hint="All attempts" color="var(--chart-2)" />
            <SummaryCard
              loading={isLoading}
              icon={<CalendarClock />}
              label="Last payment"
              value={derived.last ? new Date(derived.last.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
              hint={derived.last ? formatMoney(derived.last.amount, derived.last.currency) : 'None yet'}
              color="var(--chart-3)"
            />
            <SummaryCard loading={isLoading} icon={<AlertTriangle />} label="Failed" value={derived.failed} hint="Failed attempts" color="var(--destructive)" />
          </div>

          <PanelCard title="Spend over time" subtitle="Successful payments by month" loading={isLoading} skeletonHeight={240}>
            {derived.points.length > 0 ? <SpendChart points={derived.points} currency={derived.currency} /> : <p className="py-10 text-center text-sm text-muted-foreground">No successful payments to chart yet.</p>}
          </PanelCard>

          <PanelCard
            title="Payment attempts"
            action={
              has ? (
                <div className="flex flex-wrap gap-2">
                  {FILTERS.map((f) => (
                    <Chip key={f} small active={filter === f} onClick={() => setFilter(f)}>
                      {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()} · {counts[f] ?? 0}
                    </Chip>
                  ))}
                </div>
              ) : undefined
            }
          >
            {isLoading ? (
              <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            ) : !has ? (
              <EmptyBlock icon={<Receipt />} title="No payment attempts yet">Payments for your subscription will appear here.</EmptyBlock>
            ) : visible.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No payments match this filter.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <th className="py-2.5 pr-3">Date</th>
                      <th className="py-2.5 pr-3">Provider</th>
                      <th className="py-2.5 pr-3">Status</th>
                      <th className="py-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-3 pr-3 tabular-nums">{new Date(p.createdAt).toLocaleString()}</td>
                        <td className="py-3 pr-3">
                          <span className="font-semibold capitalize">{p.provider}</span>
                          {p.failureReason ? <p className="text-xs text-destructive">{p.failureReason}</p> : null}
                        </td>
                        <td className="py-3 pr-3"><StatusPill status={p.status} /></td>
                        <td className="py-3 text-right font-bold tabular-nums">{formatMoney(p.amount, p.currency, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PanelCard>
        </>
      )}
    </div>
  );
}
