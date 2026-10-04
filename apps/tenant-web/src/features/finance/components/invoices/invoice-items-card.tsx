'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { useCurrencySymbol } from '@/lib/currency';
import type { MemberInvoiceDetail } from '../../types';
import { PaymentStatusBadge } from '../finance-badges';
import { PanelCard, fmtDateTime } from '../payments/payments-ui';
import type { InvoiceMath } from './invoice-math';

// Dropped from the design: the per-item "3 months · dates" sub-line (InvoiceItem has no such field).

function Tot({ label, children, first }: { label: string; children: React.ReactNode; first?: boolean }) {
  return (
    <div className={`flex justify-between py-[9px] text-sm font-semibold text-foreground/80 ${first ? '' : 'border-t'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{children}</span>
    </div>
  );
}

export function InvoiceItemsCard({ invoice, math }: { invoice: MemberInvoiceDetail; math: InvoiceMath }) {
  const sym = useCurrencySymbol();
  const items = [...invoice.items].sort((a, b) => a.sortOrder - b.sortOrder);
  const hasDiscount = Number(invoice.discountAmount) > 0;
  return (
    <section className="min-w-0 overflow-hidden rounded-[20px] border bg-card text-card-foreground shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-6 py-[22px]">
        <h2 className="text-[17px] font-extrabold">Items</h2>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold">
          {items.length} line item{items.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50 text-left text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted-foreground">
              <th className="px-4 py-3 pl-6">Description</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Unit price</th>
              <th className="px-4 py-3 pr-6 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="px-4 py-4 pl-6 font-bold">{it.description}</td>
                <td className="px-4 py-4 text-right tabular-nums">{it.quantity}</td>
                <td className="px-4 py-4 text-right tabular-nums">{formatMoney(sym, it.unitPrice)}</td>
                <td className="px-4 py-4 pr-6 text-right font-extrabold tabular-nums">{formatMoney(sym, it.amount)}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr className="border-t">
                <td colSpan={4} className="px-6 py-6 text-center text-muted-foreground">
                  No line items.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap justify-between gap-6 border-t bg-muted/30 px-6 py-[22px]">
        <div className="min-w-[220px] flex-[1_1_260px] text-[13px] font-semibold leading-relaxed text-muted-foreground">
          <div className="mb-1.5 text-xs font-bold uppercase tracking-wider">Notes</div>
          {invoice.notes ? <p className="whitespace-pre-wrap break-words">{invoice.notes}</p> : <p className="font-medium">No notes.</p>}
        </div>
        <div className="min-w-[240px] flex-[0_1_320px]">
          <Tot label="Subtotal" first>
            {formatMoney(sym, invoice.subtotal)}
          </Tot>
          <Tot label="Discount">
            <span style={hasDiscount ? { color: 'var(--success)' } : undefined}>
              {hasDiscount ? '− ' : ''}
              {formatMoney(sym, invoice.discountAmount)}
            </span>
          </Tot>
          <Tot label="Tax">{formatMoney(sym, invoice.taxAmount)}</Tot>
          <div className="mt-2 flex items-center justify-between rounded-[14px] px-4 py-3.5 text-white" style={{ backgroundImage: 'linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}>
            <span className="font-bold">Total</span>
            <span className="text-2xl font-extrabold tabular-nums">{formatMoney(sym, invoice.totalAmount)}</span>
          </div>
          {math.balance !== null ? (
            <div className="mt-3 flex justify-between text-sm font-extrabold" style={{ color: math.balance > 0 ? 'color-mix(in oklch, var(--warning) 75%, var(--foreground))' : 'var(--success)' }}>
              <span>Balance due</span>
              <span className="tabular-nums">{formatMoney(sym, math.balance)}</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function SettlingPaymentsCard({ invoice, math, canRecord }: { invoice: MemberInvoiceDetail; math: InvoiceMath; canRecord: boolean }) {
  const sym = useCurrencySymbol();
  const payments = [...invoice.payments].sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
  const outstanding = math.balance !== null && math.balance > 0;
  return (
    <PanelCard
      title="Settling payments"
      className="p-6"
      action={
        // Plain /payments/new: that page keeps member/invoice in local state and resets the invoice in a [member] effect, so query-param preselect is not safe to bolt on.
        canRecord && !math.cancelled && !math.settled ? (
          <Button variant="outline" size="sm" className="h-9 rounded-xl font-bold" asChild>
            <Link href="/payments/new">
              <Plus className="size-4" /> Record payment
            </Link>
          </Button>
        ) : undefined
      }
    >
      {payments.length === 0 ? <p className="border-t pt-4 text-sm text-muted-foreground">No payments recorded against this invoice yet.</p> : null}
      {payments.map((p) => {
        const ok = p.status === 'SUCCESS' || p.status === 'PARTIALLY_REFUNDED';
        return (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-t py-3.5">
            <div className="flex items-center gap-3">
              <span
                className="flex size-[38px] items-center justify-center rounded-xl font-extrabold"
                style={{ backgroundColor: `color-mix(in oklch, ${ok ? 'var(--chart-3)' : 'var(--muted-foreground)'} 16%, transparent)`, color: `color-mix(in oklch, ${ok ? 'var(--chart-3)' : 'var(--muted-foreground)'} 62%, var(--foreground))` }}
                aria-hidden
              >
                {ok ? '✓' : '•'}
              </span>
              <div>
                <Link href={`/payments/${p.id}`} className="font-extrabold tabular-nums text-primary hover:underline">
                  {p.paymentNumber}
                </Link>
                <div className="text-[12.5px] font-semibold text-muted-foreground">{fmtDateTime(p.paymentDate)}</div>
              </div>
            </div>
            <div className="flex items-center gap-3.5">
              <span className="font-extrabold tabular-nums">{formatMoney(sym, p.finalAmount)}</span>
              <PaymentStatusBadge status={p.status} />
            </div>
          </div>
        );
      })}
      {outstanding ? (
        <div className="mt-1 rounded-[14px] border border-dashed bg-muted/30 p-3.5 text-[13px] font-semibold text-muted-foreground">
          {formatMoney(sym, math.balance ?? 0)} is still outstanding. A new payment linked to this invoice will settle it automatically.
        </div>
      ) : null}
    </PanelCard>
  );
}
