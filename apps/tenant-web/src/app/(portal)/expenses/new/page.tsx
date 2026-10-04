'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { DEFAULT_EXPENSE_FORM_STATE, ExpenseFormFields, type ExpenseFormState } from '@/features/finance/components/expense-form-fields';
import { ExpenseSummaryCard } from '@/features/finance/components/ledger/expense-summary-card';
import { PaymentsHero } from '@/features/finance/components/payments/payments-hero';
import { PanelCard } from '@/features/finance/components/payments/payments-ui';
import { StepHeader } from '@/features/finance/components/payments/record-payment-parts';
import { toFinanceError, useCreateExpense } from '@/features/finance/hooks/use-finance';

// No client-side `finance:expense-manage` gate here on purpose: none of the other /new pages (payments, members, staff, …) redirect on a
// missing permission — the API enforces it and surfaces the error in the form — so this page follows that established pattern.
export default function NewExpensePage() {
  const router = useRouter();
  const createExpense = useCreateExpense();
  const [form, setForm] = React.useState<ExpenseFormState>(DEFAULT_EXPENSE_FORM_STATE);
  const [error, setError] = React.useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.amount || Number(form.amount) <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    createExpense.mutate(
      {
        category: form.category,
        amount: Number(form.amount),
        expenseDate: form.expenseDate,
        description: form.description || undefined,
        receiptFileName: form.receiptFileName || undefined,
        receiptDataUrl: form.receiptDataUrl || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Expense recorded.');
          router.push('/expenses');
        },
        onError: (err) => setError(toFinanceError(err).message),
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <PaymentsHero backHref="/expenses" backLabel="Back to expenses" eyebrow="Finance · New" title="Add an expense" subtitle="Log rent, salaries, utilities or any other cost — attach the receipt so the books stay audit-ready." />

      <section className="flex flex-wrap items-start gap-3.5">
        <div className="flex min-w-0 flex-[2_1_640px] flex-col gap-3.5">
          <PanelCard className="p-6">
            <StepHeader n={1} title="Expense details" hint="category, amount, date, receipt" />
            {error ? (
              <p role="alert" className="mb-4 text-sm font-semibold text-destructive">
                {error}
              </p>
            ) : null}
            <ExpenseFormFields value={form} onChange={setForm} disabled={createExpense.isPending} />
          </PanelCard>
        </div>

        <div className="flex min-w-0 flex-[1_1_330px] flex-col gap-3.5 lg:sticky lg:top-4">
          <ExpenseSummaryCard
            amount={Number(form.amount) || 0}
            category={form.category}
            date={form.expenseDate}
            receiptName={form.receiptFileName}
            submit={
              <>
                <LoadingButton type="submit" className="h-12 rounded-xl font-bold" loading={createExpense.isPending} loadingText="Saving…">
                  Add expense
                </LoadingButton>
                <Button type="button" variant="outline" className="h-12 rounded-xl font-bold" onClick={() => router.push('/expenses')}>
                  Cancel
                </Button>
              </>
            }
          />
        </div>
      </section>
    </form>
  );
}
