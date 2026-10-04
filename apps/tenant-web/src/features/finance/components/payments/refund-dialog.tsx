'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { LoadingButton } from '@/components/ui/loading-button';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { useCurrencySymbol } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { toFinanceError, useRefundPayment } from '../../hooks/use-finance';
import type { MemberPaymentDetail } from '../../types';
import { PAYMENT_STATUS_META } from '../finance-badges';
import { Chip, FieldLabel, num } from './payments-ui';

type AmountMode = '25' | '50' | 'full' | 'custom';
const REASONS = ['Plan downgraded', 'Duplicate charge', 'Member left', 'Service issue', 'Other'];

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'danger' | 'success' }) {
  const color = tone === 'danger' ? 'var(--destructive)' : tone === 'success' ? 'var(--success)' : undefined;
  return (
    <div className="min-w-[150px] flex-1 rounded-[14px] p-3.5" style={{ background: color ? `color-mix(in oklch, ${color} 10%, transparent)` : 'var(--muted)' }}>
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-1 text-xl font-extrabold tabular-nums" style={{ color: color ? `color-mix(in oklch, ${color} 70%, var(--foreground))` : undefined }}>
        {value}
      </div>
    </div>
  );
}

export function RefundDialog({ payment, open, onOpenChange }: { payment: MemberPaymentDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const sym = useCurrencySymbol();
  const refundPayment = useRefundPayment();
  const paid = num(payment.finalAmount);
  const already = num(payment.totalRefunded);
  const remaining = Math.max(paid - already, 0);

  const [mode, setMode] = React.useState<AmountMode>('full');
  const [amount, setAmount] = React.useState(remaining.toFixed(2));
  const [reasonChip, setReasonChip] = React.useState('');
  const [note, setNote] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setMode('full');
      setAmount(remaining.toFixed(2));
      setReasonChip('');
      setNote('');
    }
  }, [open, remaining]);

  const pickMode = (m: AmountMode) => {
    setMode(m);
    if (m === '25') setAmount((remaining * 0.25).toFixed(2));
    if (m === '50') setAmount((remaining * 0.5).toFixed(2));
    if (m === 'full') setAmount(remaining.toFixed(2));
  };

  const value = num(amount);
  const valid = value > 0 && value <= remaining + 0.005;
  const pct = (n: number) => (paid > 0 ? Math.min(Math.max((n / paid) * 100, 0), 100) : 0);
  const left = Math.max(remaining - (valid ? value : 0), 0);
  const becomesFull = valid && left < 0.005;
  const afterStatus = PAYMENT_STATUS_META[becomesFull ? 'REFUNDED' : 'PARTIALLY_REFUNDED'].label;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const trimmed = note.trim();
    const reason = reasonChip && reasonChip !== 'Other' ? (trimmed ? `${reasonChip} — ${trimmed}` : reasonChip) : trimmed;
    refundPayment.mutate(
      { id: payment.id, payload: { amount: value, reason: reason || undefined } },
      {
        onSuccess: () => {
          toast.success('Refund recorded.');
          onOpenChange(false);
        },
        onError: (err) => toast.error(toFinanceError(err).message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[620px] gap-0 overflow-y-auto rounded-3xl p-0 [&>button:last-child]:right-5 [&>button:last-child]:top-5 [&>button:last-child]:z-10 [&>button:last-child]:bg-white/20 [&>button:last-child]:text-white [&>button:last-child]:opacity-100 [&>button:last-child]:hover:bg-white/30">
        <div className="px-6 py-[22px] text-white" style={{ backgroundImage: 'linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80">Refund payment</p>
          <DialogTitle className="mt-1 pr-10 text-[22px] font-extrabold tabular-nums">
            {payment.paymentNumber} · {payment.member.name}
          </DialogTitle>
          <DialogDescription className="sr-only">Refund part or all of the remaining balance of this payment.</DialogDescription>
        </div>
        <form onSubmit={submit}>
          <div className="flex flex-col gap-5 px-6 py-6">
            <div className="flex flex-wrap gap-3">
              <Stat label="Paid" value={formatMoney(sym, paid)} />
              <Stat label="Already refunded" value={formatMoney(sym, already)} tone="danger" />
              <Stat label="Refundable now" value={formatMoney(sym, remaining)} tone="success" />
            </div>

            <div>
              <FieldLabel className="mb-2.5 block">Refund amount</FieldLabel>
              <div className="mb-3 flex flex-wrap gap-2">
                <Chip active={mode === '25'} onClick={() => pickMode('25')}>25%</Chip>
                <Chip active={mode === '50'} onClick={() => pickMode('50')}>50%</Chip>
                <Chip active={mode === 'full'} onClick={() => pickMode('full')}>Full remainder</Chip>
                <Chip active={mode === 'custom'} onClick={() => setMode('custom')}>Custom</Chip>
              </div>
              <div className={cn('flex h-[52px] items-center gap-2 rounded-[14px] border-2 px-4 transition-shadow focus-within:border-primary focus-within:shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_14%,transparent)]', valid || amount === '' ? 'border-input' : 'border-destructive')}>
                <span className="text-xl font-extrabold text-muted-foreground">{sym}</span>
                <input
                  type="number"
                  min={0}
                  max={remaining}
                  step="0.01"
                  inputMode="decimal"
                  aria-label="Refund amount"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setMode('custom');
                  }}
                  className="w-full bg-transparent text-[22px] font-extrabold tabular-nums outline-none"
                />
              </div>
              {!valid && amount !== '' ? <p className="mt-1.5 text-xs font-semibold text-destructive">Enter an amount between 0 and {formatMoney(sym, remaining)}.</p> : null}
              <div className="mt-3.5 flex h-2 overflow-hidden rounded bg-muted" aria-hidden>
                <div style={{ width: `${pct(already)}%`, background: 'var(--chart-5)' }} />
                <div style={{ width: `${pct(valid ? value : 0)}%`, background: 'var(--primary)' }} />
              </div>
              <div className="mt-1.5 flex justify-between text-xs font-bold text-muted-foreground">
                <span>Past refunds {pct(already).toFixed(0)}%</span>
                <span>This refund {pct(valid ? value : 0).toFixed(1).replace(/\.0$/, '')}%</span>
                <span>Left {pct(left).toFixed(1).replace(/\.0$/, '')}%</span>
              </div>
            </div>

            <div>
              <FieldLabel className="mb-2.5 block">Reason</FieldLabel>
              <div className="mb-2.5 flex flex-wrap gap-2">
                {REASONS.map((r) => (
                  <Chip key={r} active={reasonChip === r} onClick={() => setReasonChip(reasonChip === r ? '' : r)}>
                    {r}
                  </Chip>
                ))}
              </div>
              <textarea
                aria-label="Refund note"
                placeholder="Add a note for the audit log (optional)…"
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-[70px] w-full rounded-[14px] border border-input bg-background px-3.5 py-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>

            <div className="flex flex-wrap justify-between gap-3 rounded-[14px] bg-primary/10 px-4 py-3.5 text-[13px] font-semibold text-primary">
              <span>
                After this refund · payment becomes <b>{afterStatus}</b>
              </span>
              <span className="tabular-nums">
                <b>{formatMoney(sym, left)}</b> left refundable
              </span>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2.5 border-t px-6 py-[18px]">
            <Button type="button" variant="outline" className="h-11 rounded-xl px-5 font-bold" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <LoadingButton type="submit" variant="destructive" className="h-11 rounded-xl px-5 font-bold" disabled={!valid} loading={refundPayment.isPending} loadingText="Processing…">
              Refund {valid ? formatMoney(sym, value) : ''}
            </LoadingButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
