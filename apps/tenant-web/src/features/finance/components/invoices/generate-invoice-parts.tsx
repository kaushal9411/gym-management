'use client';

import * as React from 'react';
import { X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { formatMoney } from '@/features/members/components/detail/detail-ui';
import type { MemberListItem } from '@/features/members/types';
import { useCurrencySymbol } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { FieldLabel, MemberAvatar, PanelCard, fmtDate } from '../payments/payments-ui';

/** Currency-prefixed number input (same look as the Record-payment amount fields). */
export function AmountInput({ id, value, onChange, label }: { id?: string; value: string; onChange: (v: string) => void; label: string }) {
  const sym = useCurrencySymbol();
  return (
    <div className="flex h-12 items-center gap-2 rounded-xl border border-input bg-background px-3.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40">
      <b>{sym}</b>
      <input id={id} aria-label={label} type="number" min={0} step="0.01" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent text-sm tabular-nums outline-none" />
    </div>
  );
}

export interface LineItemView {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

/** One editable line (description / qty / unit price) with a live line total; validation stays in the page's submit handler. */
export function LineItemRow({ item, index, canRemove, onChange, onRemove }: { item: LineItemView; index: number; canRemove: boolean; onChange: (patch: Partial<LineItemView>) => void; onRemove: () => void }) {
  const sym = useCurrencySymbol();
  const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  return (
    <div className="rounded-2xl border bg-muted/20 p-3.5">
      <div className="flex flex-wrap items-end gap-3">
        <span className="mb-3 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-extrabold text-primary">{index + 1}</span>
        <div className="min-w-[200px] flex-[3_1_220px]">
          <FieldLabel className="mb-1.5 block">Description</FieldLabel>
          <Input aria-label={`Line ${index + 1} description`} className="h-11 rounded-xl" placeholder="e.g. Monthly membership" value={item.description} onChange={(e) => onChange({ description: e.target.value })} />
        </div>
        <div className="w-20">
          <FieldLabel className="mb-1.5 block">Qty</FieldLabel>
          <Input aria-label={`Line ${index + 1} quantity`} type="number" min={1} className="h-11 rounded-xl" value={item.quantity} onChange={(e) => onChange({ quantity: e.target.value })} />
        </div>
        <div className="w-32">
          <FieldLabel className="mb-1.5 block">Unit price</FieldLabel>
          <Input aria-label={`Line ${index + 1} unit price`} type="number" min={0} step="0.01" className="h-11 rounded-xl" value={item.unitPrice} onChange={(e) => onChange({ unitPrice: e.target.value })} />
        </div>
        <div className="mb-2.5 w-24 text-right text-sm font-extrabold tabular-nums">{formatMoney(sym, lineTotal)}</div>
        <button
          type="button"
          aria-label="Remove line item"
          disabled={!canRemove}
          onClick={onRemove}
          className="mb-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-destructive disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** Live summary: member, line items, subtotal/discount/tax, total, due date and notes preview. Everything is computed from the form's own values. */
export function InvoiceSummaryCard({
  member,
  lines,
  subtotal,
  discount,
  tax,
  total,
  dueDate,
  notes,
  submit,
}: {
  member: MemberListItem | null;
  lines: { key: string; description: string; amount: number }[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  dueDate: string;
  notes: string;
  submit: React.ReactNode;
}) {
  const sym = useCurrencySymbol();
  const row = 'flex justify-between gap-3 border-t py-2.5';
  return (
    <PanelCard title="Summary">
      {member ? (
        <div className="mb-3 flex items-center gap-3 rounded-2xl bg-primary/5 p-3">
          <MemberAvatar name={member.name} seed={member.id} size={38} />
          <div className="min-w-0">
            <b className="block truncate">{member.name}</b>
            <span className="block text-xs font-semibold text-muted-foreground">
              {member.memberId} · {member.branch.name}
            </span>
          </div>
        </div>
      ) : (
        <p className="mb-3 text-sm text-muted-foreground">No member selected yet.</p>
      )}
      <div className="text-sm font-semibold text-foreground/80">
        {lines.length === 0 ? (
          <p className="pb-2.5 text-muted-foreground">Line items appear here as you add them.</p>
        ) : (
          lines.map((l, i) => (
            <div key={l.key} className={cn('flex justify-between gap-3 py-2', i > 0 && 'border-t border-dashed')}>
              <span className="truncate">{l.description}</span>
              <span className="tabular-nums">{formatMoney(sym, l.amount)}</span>
            </div>
          ))
        )}
        <div className={row}>
          <span>Subtotal</span>
          <span className="tabular-nums">{formatMoney(sym, subtotal)}</span>
        </div>
        <div className={row}>
          <span>Discount</span>
          <span className="tabular-nums" style={{ color: 'var(--success)' }}>
            − {formatMoney(sym, discount)}
          </span>
        </div>
        <div className={row}>
          <span>Tax</span>
          <span className="tabular-nums">{formatMoney(sym, tax)}</span>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between rounded-2xl px-4 py-4 text-white" style={{ backgroundImage: 'linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}>
        <span className="font-bold">Invoice total</span>
        <span className="text-[26px] font-extrabold tabular-nums">{formatMoney(sym, total)}</span>
      </div>
      <dl className="mt-3.5 space-y-1.5 text-[13px] font-semibold text-muted-foreground">
        <div className="flex justify-between gap-3">
          <dt>Due date</dt>
          <dd className="text-foreground">{dueDate ? fmtDate(dueDate, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Default terms'}</dd>
        </div>
        {notes.trim() ? (
          <div>
            <dt>Notes</dt>
            <dd className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-foreground">{notes}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-[18px] flex flex-col gap-2.5">{submit}</div>
    </PanelCard>
  );
}
