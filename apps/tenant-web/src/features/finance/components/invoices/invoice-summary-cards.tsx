'use client';

import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { useCurrencySymbol } from '@/lib/currency';
import type { MemberInvoiceDetail } from '../../types';
import { fmtDate } from '../payments/payments-ui';
import { dueLabel, type InvoiceMath } from './invoice-math';

const TONE_COLOR = { ok: 'var(--success)', warn: 'var(--warning)', bad: 'var(--destructive)', muted: 'var(--muted-foreground)' } as const;

export function InvoiceSummaryCards({ invoice, math }: { invoice: MemberInvoiceDetail; math: InvoiceMath }) {
  const sym = useCurrencySymbol();
  const due = dueLabel(math);
  const mix = (c?: string) => (c ? `color-mix(in oklch, ${c} 75%, var(--foreground))` : undefined);
  const cards = [
    { label: 'Invoice total', value: formatMoney(sym, math.total), sub: Number(invoice.taxAmount) > 0 ? `incl. ${formatMoney(sym, invoice.taxAmount)} tax` : 'no tax applied' },
    { label: 'Paid so far', value: formatMoney(sym, math.paid), sub: `${math.paidCount} payment${math.paidCount === 1 ? '' : 's'} · ${math.paidPct}%`, color: math.paid > 0 ? 'var(--success)' : undefined },
    {
      label: 'Balance due',
      value: math.balance === null ? '—' : formatMoney(sym, math.balance),
      sub: math.balance === null ? 'invoice cancelled' : math.balance > 0 ? `${math.balancePct}% remaining` : 'nothing outstanding',
      color: math.balance !== null && math.balance > 0 ? 'var(--warning)' : undefined,
    },
    { label: 'Due date', value: fmtDate(invoice.dueDate, { day: 'numeric', month: 'short', year: 'numeric' }), sub: due.text, subColor: TONE_COLOR[due.tone], bold: true },
  ];
  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3.5">
      {cards.map((c) => (
        <div key={c.label} className="rounded-[20px] border bg-card p-[18px] shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{c.label}</div>
          <div className="mt-2 truncate text-[28px] font-extrabold tabular-nums" style={{ color: mix(c.color) }}>
            {c.value}
          </div>
          <div className={`mt-0.5 text-[12.5px] ${c.bold ? 'font-bold' : 'font-semibold text-muted-foreground'}`} style={c.subColor ? { color: mix(c.subColor) } : undefined}>
            {c.sub}
          </div>
        </div>
      ))}
    </section>
  );
}
