'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { LoadingButton } from '@/components/ui/loading-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DEFAULT_EXPENSE_FORM_STATE,
  ExpenseFormFields,
  type ExpenseFormState,
} from '@/features/finance/components/expense-form-fields';
import { toFinanceError, useCreateExpense } from '@/features/finance/hooks/use-finance';

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
    <div className="mx-auto max-w-2xl space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/expenses">
          <ArrowLeft className="size-4" /> Back to expenses
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Add an expense</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-6">
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <ExpenseFormFields value={form} onChange={setForm} disabled={createExpense.isPending} />
            <LoadingButton type="submit" className="w-full" loading={createExpense.isPending} loadingText="Saving…">
              Add expense
            </LoadingButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
