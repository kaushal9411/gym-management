'use client';

import * as React from 'react';
import Link from 'next/link';

import { Skeleton } from '@/components/ui/skeleton';
import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { useCurrencySymbol } from '@/lib/currency';
import { usePaymentList } from '../../hooks/use-finance';
import type { MemberPaymentDetail } from '../../types';
import { METHOD_LABELS, PAYMENT_STATUS_META, PaymentStatusBadge } from '../finance-badges';
import { Donut, PanelCard, fmtDateTime, num } from './payments-ui';

export function SummaryCards({ payment }: { payment: MemberPaymentDetail }) {
  const sym = useCurrencySymbol();
  const final = num(payment.finalAmount);
  const refunded = num(payment.totalRefunded);
  const received = ['SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status);
  const refundable = ['SUCCESS', 'PARTIALLY_REFUNDED'].includes(payment.status) ? Math.max(final - refunded, 0) : 0;
  const pct = (n: number) => (final > 0 ? Math.round((n / final) * 100) : 0);
  const cards = [
    { label: 'Amount paid', value: formatMoney(sym, final), sub: num(payment.tax) > 0 ? `incl. ${formatMoney(sym, payment.tax)} tax` : 'no tax applied' },
    { label: 'Refunded', value: formatMoney(sym, refunded), sub: `${pct(refunded)}% · ${payment.refunds.length} refund${payment.refunds.length === 1 ? '' : 's'}`, color: refunded > 0 ? 'var(--destructive)' : undefined },
    { label: 'Refundable balance', value: formatMoney(sym, refundable), sub: refundable > 0 ? `${pct(refundable)}% remaining` : 'nothing left to refund', color: refundable > 0 ? 'var(--success)' : undefined },
    { label: 'Net received', value: formatMoney(sym, received ? final - refunded : 0), sub: received ? 'after refunds' : 'not received yet' },
  ];
  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3.5">
      {cards.map((c) => (
        <div key={c.label} className="rounded-[20px] border bg-card p-[18px] shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{c.label}</div>
          <div className="mt-2 truncate text-[28px] font-extrabold tabular-nums" style={{ color: c.color ? `color-mix(in oklch, ${c.color} 75%, var(--foreground))` : undefined }}>
            {c.value}
          </div>
          <div className="mt-0.5 text-[12.5px] font-semibold text-muted-foreground">{c.sub}</div>
        </div>
      ))}
    </section>
  );
}

function Row({ label, children, first }: { label: string; children: React.ReactNode; first?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-3 text-sm ${first ? '' : 'border-t'}`}>
      <span className="font-semibold text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right font-bold">{children}</span>
    </div>
  );
}

export function DetailsCard({ payment }: { payment: MemberPaymentDetail }) {
  const sym = useCurrencySymbol();
  return (
    <PanelCard title="Payment details" className="p-6">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-x-10">
        <div>
          <Row label="Member" first>
            <Link href={`/members/${payment.member.id}`} className="hover:underline">
              {payment.member.name}
            </Link>{' '}
            · {payment.member.memberId}
          </Row>
          <Row label="Plan">{payment.membership?.planName ?? '—'}</Row>
          <Row label="Branch">{payment.branch.name}</Row>
          <Row label="Recorded by">{payment.recordedBy?.name ?? '—'}</Row>
          {payment.invoiceId ? (
            <Row label="Invoice">
              <Link href={`/invoices/${payment.invoiceId}`} className="text-primary hover:underline">
                View invoice
              </Link>
            </Row>
          ) : null}
        </div>
        <div>
          <Row label="Method" first>
            {METHOD_LABELS[payment.method]}
          </Row>
          <Row label="Reference">
            <span className="tabular-nums">{payment.transactionReference ?? '—'}</span>
          </Row>
          <Row label="Gross / discount / tax">
            <span className="tabular-nums">
              {formatMoney(sym, payment.amount)} / {formatMoney(sym, payment.discount)} / {formatMoney(sym, payment.tax)}
            </span>
          </Row>
          <Row label="Payment date">{new Date(payment.paymentDate).toLocaleDateString()}</Row>
          <Row label="Notes">{payment.notes ?? '—'}</Row>
        </div>
      </div>
    </PanelCard>
  );
}

export function TimelineCard({ payment }: { payment: MemberPaymentDetail }) {
  const sym = useCurrencySymbol();
  const refunds = [...payment.refunds].sort((a, b) => new Date(b.refundedAt).getTime() - new Date(a.refundedAt).getTime());
  const received = ['SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(payment.status);
  const baseTitle = received ? 'Payment received' : payment.status === 'PENDING' ? 'Payment pending' : payment.status === 'FAILED' ? 'Payment failed' : 'Payment cancelled';
  const events = [
    ...refunds.map((r) => ({
      key: r.id,
      color: 'var(--chart-5)',
      title: (
        <>
          Refunded <span className="tabular-nums text-destructive">{formatMoney(sym, r.amount)}</span>
        </>
      ),
      sub: `${r.reason ? `“${r.reason}” · ` : ''}${r.refundedBy ? `by ${r.refundedBy.name} · ` : ''}${fmtDateTime(r.refundedAt)}`,
    })),
    {
      key: 'base',
      color: received ? 'var(--chart-3)' : PAYMENT_STATUS_META[payment.status].color,
      title: (
        <>
          {baseTitle} <span className="tabular-nums">{formatMoney(sym, payment.finalAmount)}</span>
        </>
      ),
      sub: `via ${METHOD_LABELS[payment.method]} · ${fmtDateTime(payment.createdAt)}`,
    },
  ];
  return (
    <PanelCard title="Activity timeline" action={<span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold">{events.length} event{events.length === 1 ? '' : 's'}</span>} className="p-6">
      <ol className="mt-1 flex flex-col">
        {events.map((e, i) => (
          <li key={e.key} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className="size-3.5 rounded-full border-[3px]" style={{ backgroundColor: e.color, borderColor: `color-mix(in oklch, ${e.color} 25%, var(--card))` }} />
              {i < events.length - 1 ? <span className="w-0.5 flex-1 bg-border" /> : null}
            </div>
            <div className={i < events.length - 1 ? 'pb-[22px]' : ''}>
              <div className="text-sm font-extrabold">{e.title}</div>
              <div className="mt-0.5 text-[13px] text-muted-foreground">{e.sub}</div>
            </div>
          </li>
        ))}
      </ol>
    </PanelCard>
  );
}

export function RefundSplitCard({ payment }: { payment: MemberPaymentDetail }) {
  const sym = useCurrencySymbol();
  const final = num(payment.finalAmount);
  const refunded = Math.min(num(payment.totalRefunded), final);
  const kept = Math.max(final - refunded, 0);
  return (
    <PanelCard title="Refund split" className="p-6">
      <div className="flex flex-col items-center">
        <div className="my-2.5">
          <Donut size={170} segments={[{ value: kept, color: 'var(--chart-3)' }, { value: refunded, color: 'var(--chart-5)' }]}>
            <span className="text-[22px] font-extrabold">{final > 0 ? Math.round((refunded / final) * 100) : 0}%</span>
            <span className="text-[11px] font-bold uppercase text-muted-foreground">Refunded</span>
          </Donut>
        </div>
        <div className="flex flex-wrap justify-center gap-[18px] text-[13px] font-bold">
          <span className="inline-flex items-center gap-[7px]">
            <span className="size-2 rounded-full" style={{ background: 'var(--chart-3)' }} />
            Kept {formatMoney(sym, kept)}
          </span>
          <span className="inline-flex items-center gap-[7px]">
            <span className="size-2 rounded-full" style={{ background: 'var(--chart-5)' }} />
            Refunded {formatMoney(sym, refunded)}
          </span>
        </div>
      </div>
    </PanelCard>
  );
}

/** Other payments by the same member — from the regular list endpoint (`memberId` filter). No "lifetime paid": it would need a dedicated aggregate. */
export function OtherPaymentsCard({ payment }: { payment: MemberPaymentDetail }) {
  const sym = useCurrencySymbol();
  const list = usePaymentList({ page: 1, limit: 6, memberId: payment.member.id, sortBy: 'paymentDate', sortDir: 'desc' });
  const others = (list.data?.items ?? []).filter((p) => p.id !== payment.id).slice(0, 4);
  const first = payment.member.name.split(/\s+/)[0];
  return (
    <PanelCard title={`Other payments by ${first}`} className="p-6">
      {list.isPending ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : others.length === 0 ? (
        <p className="text-sm text-muted-foreground">No other payments from this member.</p>
      ) : (
        <div>
          {others.map((p, i) => (
            <div key={p.id} className={`flex items-center justify-between gap-3 py-3 text-sm ${i > 0 ? 'border-t' : ''}`}>
              <Link href={`/payments/${p.id}`} className="font-semibold tabular-nums text-primary hover:underline">
                {p.paymentNumber}
              </Link>
              <span className="flex items-center gap-2 font-bold">
                <span className="tabular-nums">{formatMoney(sym, p.finalAmount)}</span>
                <PaymentStatusBadge status={p.status} />
              </span>
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}
