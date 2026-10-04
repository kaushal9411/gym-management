'use client';

import * as React from 'react';
import Link from 'next/link';
import { Banknote, Building2, CheckCircle2, CreditCard, FileText, Globe, Receipt, Smartphone, Undo2, Wallet, type LucideIcon } from 'lucide-react';

import { MEMBER_PORTAL_ROUTES } from '../../constants';
import { useMemberOverview, useMemberPayments } from '../../hooks/use-member-portal';
import { formatDate, parseMoney, plural, usePortalMoney } from '../../lib/format';
import { EmptyBlock, HeroChip, ListRow, PortalHero, PortalList, SectionCard, SkeletonCard, SkeletonHero, StatusChip, heroActionClass } from '../kit';
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS } from './invoice-utils';

const METHOD_ICON: Record<string, LucideIcon> = {
  CASH: Banknote,
  UPI: Smartphone,
  CREDIT_CARD: CreditCard,
  DEBIT_CARD: CreditCard,
  BANK_TRANSFER: Building2,
  CHEQUE: FileText,
  ONLINE_GATEWAY: Globe,
};
const PAGE = 20;

export function PaymentsPageContent() {
  const money = usePortalMoney();
  const [limit, setLimit] = React.useState(PAGE);
  const q = useMemberPayments(1, limit);
  const overview = useMemberOverview();
  const items = q.data?.items ?? [];

  // Honest data: "total paid" sums only the payments loaded on screen (SUCCESS / part-refunded, net of refunds).
  const loadedPaid = items.filter((p) => p.status === 'SUCCESS' || p.status === 'PARTIALLY_REFUNDED').reduce((s, p) => s + parseMoney(p.amount) - parseMoney(p.totalRefunded), 0);
  const complete = q.data ? q.data.total <= items.length : false;
  const paid90 = overview.data?.billing.paidLast90Days;

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonHero />
        <SkeletonCard lines={4} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PortalHero
        eyebrow="Billing"
        title="Payment history"
        subtitle={q.data?.total ? `${plural(q.data.total, 'payment')} on record` : 'No payments yet'}
        chips={complete && items.length ? <HeroChip><CheckCircle2 className="size-3" /> Full history</HeroChip> : undefined}
        stats={[
          { label: complete ? 'Total paid' : 'Paid (loaded)', value: loadedPaid, format: money.format, hidden: items.length === 0 },
          { label: 'Payments', value: q.data?.total ?? 0 },
          { label: '90 days', value: paid90 ? parseMoney(paid90.value) : 0, format: money.format, hidden: !paid90 },
        ]}
        actions={<Link href={MEMBER_PORTAL_ROUTES.invoices} className={heroActionClass('ghost')}><Receipt className="size-4" /> Invoices</Link>}
      />

      <SectionCard title="All payments" subtitle="Newest first" icon={Wallet} tone="success" flush>
        {items.length === 0 ? (
          <EmptyBlock icon={Wallet} title="No payments yet" description="Payments you make at the gym or online will be listed here." />
        ) : (
          <PortalList>
            {items.map((p) => {
              const ps = PAYMENT_STATUS[p.status] ?? { tone: 'muted' as const, label: p.status };
              const refunded = parseMoney(p.totalRefunded);
              return (
                <ListRow
                  key={p.id}
                  icon={METHOD_ICON[p.method] ?? Wallet}
                  tone={ps.tone}
                  title={
                    <span className="flex items-center gap-2">
                      <span className="truncate">{p.paymentNumber}</span>
                    </span>
                  }
                  subtitle={
                    <span>
                      {PAYMENT_METHOD_LABEL[p.method] ?? p.method} · {formatDate(p.paymentDate)}{p.invoiceNumber ? ` · ${p.invoiceNumber}` : null}
                      {refunded > 0 ? <span className="ml-1 inline-flex items-center gap-0.5" style={{ color: 'var(--chart-7)' }}><Undo2 className="size-3" /> {money.format(refunded)} refunded</span> : null}
                    </span>
                  }
                  trailing={
                    <div className="space-y-0.5">
                      <p className="font-semibold tabular-nums">{money.format(p.amount)}</p>
                      <StatusChip tone={ps.tone}>{ps.label}</StatusChip>
                    </div>
                  }
                  href={p.invoiceId ? MEMBER_PORTAL_ROUTES.invoice(p.invoiceId) : undefined}
                />
              );
            })}
          </PortalList>
        )}
      </SectionCard>

      {q.data && q.data.total > items.length ? (
        <button type="button" onClick={() => setLimit((l) => l + PAGE)} disabled={q.isFetching} className="min-h-11 w-full rounded-xl border bg-card text-sm font-semibold hover:bg-accent disabled:opacity-60">
          {q.isFetching ? 'Loading…' : `Load more (${q.data.total - items.length} left)`}
        </button>
      ) : null}
    </div>
  );
}
