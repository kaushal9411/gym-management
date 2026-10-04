'use client';

import * as React from 'react';

import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { useCurrencySymbol } from '@/lib/currency';
import { DeltaText, PanelCard, num, pctChange } from '../payments/payments-ui';
import type { PanelProps } from './ledger-theme';

const BRANCH_COLORS = ['var(--chart-1)', 'var(--chart-7)', 'var(--chart-5)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];

export function LedgerBranchComparePanel({ analytics, loading, error, theme, compare }: PanelProps & { compare: boolean }) {
  const sym = useCurrencySymbol();
  const branches = [...(analytics?.branches ?? [])].sort((a, b) => num(b.total) - num(a.total));
  const max = Math.max(...branches.map((b) => num(b.total)), 1);
  return (
    <PanelCard title="Branch comparison" subtitle={compare ? `${theme.kind === 'income' ? 'Income' : 'Expenses'} and change vs previous period` : `${theme.kind === 'income' ? 'Income' : 'Expenses'} by branch`} loading={loading} error={error} skeletonHeight={200} className="flex-[1_1_380px]">
      {branches.length === 0 ? (
        <p className="flex h-[160px] items-center justify-center text-sm text-muted-foreground">No branch {theme.noun} in this period yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {branches.map((b, i) => (
            <div key={b.branchId}>
              <div className="flex justify-between gap-2 text-[13px] font-bold">
                <span className="truncate">{b.name}</span>
                <span className="shrink-0 tabular-nums">
                  {formatMoney(sym, b.total)} {compare ? <DeltaText pct={pctChange(num(b.total), num(b.previousTotal))} goodWhenDown={theme.goodWhenDown} /> : null}
                </span>
              </div>
              <div className="mt-[7px] h-3 rounded-md bg-muted">
                <div className="h-full rounded-md" style={{ width: `${Math.max((num(b.total) / max) * 100, 1)}%`, background: BRANCH_COLORS[i % BRANCH_COLORS.length] }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </PanelCard>
  );
}
