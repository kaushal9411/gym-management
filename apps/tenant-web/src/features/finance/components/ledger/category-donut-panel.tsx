'use client';

import * as React from 'react';

import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { useCurrencySymbol } from '@/lib/currency';
import { DeltaText, Donut, PanelCard, compactMoney, num, pctChange } from '../payments/payments-ui';
import type { PanelProps } from './ledger-theme';

/** Category share donut + legend (share %, amount, delta vs previous period when `compare`). */
export function CategoryDonutPanel({ analytics, loading, error, theme, compare }: PanelProps & { compare: boolean }) {
  const sym = useCurrencySymbol();
  const rows = [...(analytics?.categories ?? [])].filter((c) => num(c.amount) > 0).sort((a, b) => num(b.amount) - num(a.amount));
  const total = rows.reduce((s, c) => s + num(c.amount), 0);
  const metaOf = (c: string) => theme.categoryMeta[c] ?? { label: c, color: 'var(--muted-foreground)' };
  return (
    <PanelCard title={`${theme.kind === 'income' ? 'Income' : 'Expense'} by category`} subtitle="Share of the period total" loading={loading} error={error} skeletonHeight={260} className="flex-[1_1_340px]">
      {total === 0 ? (
        <p className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">No {theme.nounPlural} in this period yet.</p>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-[18px]">
          <Donut segments={rows.map((c) => ({ value: num(c.amount), color: metaOf(c.category).color }))}>
            <span className="text-[11px] font-bold uppercase text-muted-foreground">Total</span>
            <span className="text-base font-extrabold">{compactMoney(sym, total)}</span>
          </Donut>
          <div className="flex min-w-[170px] flex-1 flex-col gap-[9px] text-[13px] font-semibold">
            {rows.map((c) => (
              <div key={c.category} className="flex flex-col">
                <div className="flex justify-between gap-2.5">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: metaOf(c.category).color }} />
                    <span className="truncate">{metaOf(c.category).label}</span>
                  </span>
                  <b className="tabular-nums">{Math.round((num(c.amount) / total) * 100)}%</b>
                </div>
                <div className="flex justify-between gap-2 pl-4 text-xs text-muted-foreground">
                  <span className="tabular-nums">{formatMoney(sym, c.amount)}</span>
                  {compare ? <DeltaText pct={pctChange(num(c.amount), num(c.previousAmount))} goodWhenDown={theme.goodWhenDown} /> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </PanelCard>
  );
}
