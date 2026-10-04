'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import { useCurrencySymbol } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { toFinanceError, useCreateIncome } from '../../hooks/use-finance';
import type { IncomeCategory } from '../../types';
import { INCOME_CATEGORY_META } from '../finance-badges';
import { DEFAULT_INCOME_FORM_STATE, type IncomeFormState } from '../income-form-fields';
import { Chip, FieldLabel } from '../payments/payments-ui';

const CATEGORIES = Object.keys(INCOME_CATEGORY_META) as IncomeCategory[];

/**
 * Restyled "Add income" dialog (gradient header like the Refund dialog). Same `IncomeFormState` shape, same validation
 * (amount > 0) and the same `useCreateIncome` payload as the old `IncomeFormFields` flow — only the controls changed
 * (category select → chips; the amount/date/description fields are restyled inline).
 */
export function AddIncomeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const sym = useCurrencySymbol();
  const createIncome = useCreateIncome();
  const [form, setForm] = React.useState<IncomeFormState>(DEFAULT_INCOME_FORM_STATE);
  const [error, setError] = React.useState<string | null>(null);

  // Fresh form on every open.
  React.useEffect(() => {
    if (open) {
      setForm({ ...DEFAULT_INCOME_FORM_STATE, incomeDate: new Date().toISOString().slice(0, 10) });
      setError(null);
    }
  }, [open]);

  const set = <K extends keyof IncomeFormState>(key: K, v: IncomeFormState[K]) => setForm((f) => ({ ...f, [key]: v }));
  const busy = createIncome.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.amount || Number(form.amount) <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    createIncome.mutate(
      { category: form.category, amount: Number(form.amount), incomeDate: form.incomeDate, description: form.description || undefined },
      {
        onSuccess: () => {
          toast.success('Income recorded.');
          onOpenChange(false);
        },
        onError: (err) => setError(toFinanceError(err).message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[560px] gap-0 overflow-y-auto rounded-3xl p-0 [&>button:last-child]:right-5 [&>button:last-child]:top-5 [&>button:last-child]:z-10 [&>button:last-child]:bg-white/20 [&>button:last-child]:text-white [&>button:last-child]:opacity-100 [&>button:last-child]:hover:bg-white/30">
        <div className="px-6 py-[22px] text-white" style={{ backgroundImage: 'linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80">Finance · Income</p>
          <DialogTitle className="mt-1 pr-10 text-[22px] font-extrabold">Add income</DialogTitle>
          <DialogDescription className="sr-only">Record a manual income entry in the ledger.</DialogDescription>
        </div>
        <form onSubmit={submit}>
          <div className="flex flex-col gap-5 px-6 py-6">
            {error ? (
              <p role="alert" className="text-sm font-semibold text-destructive">
                {error}
              </p>
            ) : null}
            <div>
              <FieldLabel className="mb-2.5 block">Category</FieldLabel>
              <div role="radiogroup" aria-label="Category" className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <Chip key={c} active={form.category === c} dotColor={INCOME_CATEGORY_META[c].color} disabled={busy} onClick={() => set('category', c)}>
                    {INCOME_CATEGORY_META[c].label}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel className="mb-2.5 block">Amount</FieldLabel>
              <div className="flex h-[52px] items-center gap-2 rounded-[14px] border-2 border-input px-4 transition-shadow focus-within:border-primary focus-within:shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_14%,transparent)]">
                <span className="text-xl font-extrabold text-muted-foreground">{sym}</span>
                <input type="number" min={0} step="0.01" inputMode="decimal" aria-label="Amount" value={form.amount} disabled={busy} onChange={(e) => set('amount', e.target.value)} className="w-full bg-transparent text-[22px] font-extrabold tabular-nums outline-none" />
              </div>
            </div>
            <div>
              <FieldLabel className="mb-2.5 block">Date</FieldLabel>
              <Input type="date" aria-label="Date" className={cn('h-12 rounded-xl')} value={form.incomeDate} disabled={busy} onChange={(e) => set('incomeDate', e.target.value)} />
            </div>
            <div>
              <FieldLabel className="mb-2.5 block">Description</FieldLabel>
              <textarea
                aria-label="Description"
                placeholder="What is this income for? (optional)"
                value={form.description}
                disabled={busy}
                onChange={(e) => set('description', e.target.value)}
                className="min-h-[84px] w-full rounded-[14px] border border-input bg-background px-3.5 py-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
              />
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2.5 border-t px-6 py-[18px]">
            <Button type="button" variant="outline" className="h-11 rounded-xl px-5 font-bold" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <LoadingButton type="submit" className="h-11 rounded-xl px-5 font-bold" loading={busy} loadingText="Saving…">
              Add income
            </LoadingButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
