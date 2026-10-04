'use client';

import * as React from 'react';

import { formatMoney } from '@/features/members/components/detail/detail-ui';
import { useCurrencySymbol } from '@/lib/currency';
import { CategoryBadge } from '../finance-badges';
import { PanelCard, fmtDate, num } from '../payments/payments-ui';
import type { PanelProps } from './ledger-theme';

/** Top-5 entries of the period (`analytics.topEntries`), bar length relative to the largest. */
export function TopEntriesPanel({ analytics, loading, error, theme }: PanelProps) {
  const sym = useCurrencySymbol();
  const entries = (analytics?.topEntries ?? []).slice(0, 5);
  const max = Math.max(...entries.map((e) => num(e.amount)), 1);
  return (
    <PanelCard title={`Top ${theme.nounPlural}`} subtitle="Largest entries in this period" loading={loading} error={error} skeletonHeight={260} className="flex-[1_1_380px]">
      {entries.length === 0 ? (
        <p className="flex h-[160px] items-center justify-center text-sm text-muted-foreground">No {theme.nounPlural} in this period yet.</p>
      ) : (
        <ol className="flex flex-col gap-3.5">
          {entries.map((e, i) => (
            <li key={e.id}>
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-extrabold text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold">{e.description || theme.categoryMeta[e.category]?.label || e.category}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <CategoryBadge category={e.category} meta={theme.categoryMeta} /> {fmtDate(e.date)}
                    </span>
                  </span>
                </span>
                <b className="shrink-0 text-[14px] tabular-nums">{formatMoney(sym, e.amount)}</b>
              </div>
              <div className="ml-[34px] mt-2 h-1.5 rounded bg-muted">
                <div className="h-full rounded" style={{ width: `${Math.max((num(e.amount) / max) * 100, 2)}%`, background: theme.accent }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </PanelCard>
  );
}
