'use client';

import * as React from 'react';
import Link from 'next/link';
import { Download, Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { useCurrencySymbol } from '@/lib/currency';
import type { MemberInvoiceDetail } from '../../types';
import { Donut, MemberAvatar, PanelCard, fmtDate, fmtDateTime } from '../payments/payments-ui';
import { dueLabel, type InvoiceMath } from './invoice-math';

export function CollectionProgressCard({ math }: { math: InvoiceMath }) {
  const sym = useCurrencySymbol();
  const due = math.balance ?? 0;
  return (
    <PanelCard title="Collection progress" className="p-6">
      <div className="flex flex-col items-center">
        <div className="my-2.5">
          <Donut size={170} segments={[{ value: Math.min(math.paid, math.total), color: 'var(--chart-3)' }, { value: due, color: 'var(--border)' }]}>
            <span className="text-[24px] font-extrabold">{math.cancelled ? '—' : `${math.paidPct}%`}</span>
            <span className="text-[11px] font-bold uppercase text-muted-foreground">Collected</span>
          </Donut>
        </div>
        <div className="flex flex-wrap justify-center gap-[18px] text-[13px] font-bold">
          <span className="inline-flex items-center gap-[7px]">
            <span className="size-2 rounded-full" style={{ background: 'var(--chart-3)' }} />
            Paid {formatMoney(sym, math.paid)}
          </span>
          <span className="inline-flex items-center gap-[7px]">
            <span className="size-2 rounded-full" style={{ background: 'var(--border)' }} />
            Due {math.balance === null ? '—' : formatMoney(sym, due)}
          </span>
        </div>
      </div>
    </PanelCard>
  );
}

export function InvoiceTimelineCard({ invoice, math }: { invoice: MemberInvoiceDetail; math: InvoiceMath }) {
  const sym = useCurrencySymbol();
  const due = dueLabel(math);
  const dueColor = math.settled ? 'var(--chart-3)' : math.cancelled ? 'var(--muted-foreground)' : math.daysToDue < 0 ? 'var(--destructive)' : 'var(--chart-4)';
  const received = invoice.payments
    .filter((p) => p.status === 'SUCCESS' || p.status === 'PARTIALLY_REFUNDED')
    .map((p) => ({ key: p.id, at: new Date(p.paymentDate).getTime(), color: 'var(--chart-3)', title: <>Payment received <span className="tabular-nums">{formatMoney(sym, p.finalAmount)}</span></>, sub: `${p.paymentNumber} · ${fmtDateTime(p.paymentDate)}` }));
  const events = [
    // Newest first, matching the design: due date on top, creation at the bottom.
    { key: 'due', at: Number.POSITIVE_INFINITY, color: dueColor, title: <>Due date</>, sub: `${fmtDate(invoice.dueDate, { day: 'numeric', month: 'short', year: 'numeric' })} · ${due.text}` },
    ...received.sort((a, b) => b.at - a.at),
    { key: 'created', at: 0, color: 'var(--primary)', title: <>Invoice created</>, sub: fmtDateTime(invoice.createdAt) },
  ];
  return (
    <PanelCard title="Timeline" className="p-6">
      <ol className="mt-1 flex flex-col">
        {events.map((e, i) => (
          <li key={e.key} className="flex gap-3.5">
            <div className="flex flex-col items-center">
              <span className="size-3.5 rounded-full border-[3px]" style={{ backgroundColor: e.color, borderColor: `color-mix(in oklch, ${e.color} 25%, var(--card))` }} />
              {i < events.length - 1 ? <span className="w-0.5 flex-1 bg-border" /> : null}
            </div>
            <div className={i < events.length - 1 ? 'pb-[18px]' : ''}>
              <div className="text-sm font-extrabold">{e.title}</div>
              <div className="text-[13px] font-semibold text-muted-foreground">{e.sub}</div>
            </div>
          </li>
        ))}
      </ol>
    </PanelCard>
  );
}

export function BilledToCard({ invoice, math }: { invoice: MemberInvoiceDetail; math: InvoiceMath }) {
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-3 border-t py-3 text-sm">
      <span className="font-semibold text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right font-bold">{value}</span>
    </div>
  );
  return (
    <PanelCard title="Billed to" className="p-6">
      <div className="my-3 flex items-center gap-3">
        <MemberAvatar name={invoice.member.name} seed={invoice.member.id} size={44} />
        <div className="min-w-0">
          <Link href={`/members/${invoice.member.id}`} className="font-extrabold hover:underline">
            {invoice.member.name}
          </Link>
          <div className="text-[12.5px] font-semibold text-muted-foreground">{invoice.member.memberId}</div>
        </div>
      </div>
      {row('Branch', invoice.branch.name)}
      {row('Invoice date', fmtDate(invoice.invoiceDate, { day: 'numeric', month: 'short', year: 'numeric' }))}
      {row('Payment terms', `${math.termsDays} day${math.termsDays === 1 ? '' : 's'}`)}
    </PanelCard>
  );
}

/** Dropped from the design: the "INV-….pdf · A4" filename/size line is replaced by the invoice number only — page size isn't known client-side. */
export function PdfCopyCard({ invoiceNumber, downloading, printing, onDownload, onPrint }: { invoiceNumber: string; downloading: boolean; printing: boolean; onDownload: () => void; onPrint: () => void }) {
  return (
    <section className="flex items-center gap-3.5 rounded-[20px] border bg-card p-5 shadow-xs">
      <div aria-hidden className="flex h-[84px] w-16 flex-none flex-col gap-[5px] rounded-lg border bg-background p-2 shadow-sm">
        <span className="h-1.5 w-3/5 rounded-sm bg-primary" />
        <span className="h-[3px] rounded-sm bg-muted" />
        <span className="h-[3px] rounded-sm bg-muted" />
        <span className="h-[3px] w-[70%] rounded-sm bg-muted" />
        <span className="mt-auto h-3 rounded bg-primary/10" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-extrabold">PDF copy</div>
        <div className="mb-2 mt-0.5 truncate text-[12.5px] font-semibold text-muted-foreground">{invoiceNumber}.pdf</div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="rounded-xl font-bold" disabled={downloading} onClick={onDownload}>
            <Download className="size-4" /> {downloading ? 'Downloading…' : 'Download'}
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl font-bold" disabled={printing} onClick={onPrint}>
            <Printer className="size-4" /> Print
          </Button>
        </div>
      </div>
    </section>
  );
}
