'use client';

import * as React from 'react';

import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { useCurrencySymbol } from '@/lib/currency';
import type { ExpenseCategory } from '../../types';
import { CategoryBadge, EXPENSE_CATEGORY_META } from '../finance-badges';
import { PanelCard, fmtDate } from '../payments/payments-ui';

/** Live summary beside the new-expense form (mirrors Record-payment's SummaryCard: rows + gradient total + submit slot). */
export function ExpenseSummaryCard({ amount, category, date, receiptName, submit }: { amount: number; category: ExpenseCategory; date: string; receiptName: string; submit: React.ReactNode }) {
  const sym = useCurrencySymbol();
  return (
    <PanelCard title="Summary">
      <div className="text-sm font-semibold text-foreground/80">
        <div className="flex items-center justify-between py-2.5">
          <span>Category</span>
          <CategoryBadge category={category} meta={EXPENSE_CATEGORY_META} />
        </div>
        <div className="flex justify-between border-t py-2.5">
          <span>Date</span>
          <span className="tabular-nums">{date ? fmtDate(`${date}T00:00:00`, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
        </div>
        <div className="flex justify-between gap-3 border-t py-2.5">
          <span>Receipt</span>
          <span className="max-w-[170px] truncate" title={receiptName || undefined}>
            {receiptName ? `Attached · ${receiptName}` : 'None attached'}
          </span>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between rounded-2xl px-4 py-4 text-white" style={{ backgroundImage: 'linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}>
        <span className="font-bold">Amount</span>
        <span className="text-[26px] font-extrabold tabular-nums">{formatMoney(sym, amount)}</span>
      </div>
      <div className="mt-[18px] flex flex-col gap-2.5">{submit}</div>
    </PanelCard>
  );
}
