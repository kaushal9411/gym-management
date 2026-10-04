'use client';

import { Info, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { fmtInt } from '@/features/dashboard/components/format';
import { money } from '@/features/tenants/components/detail/tabs/_shared/kit';
import type { PriceImpact } from '../api/insights';

/** Read-only price-impact result: affected subscribers, current -> projected MRR, delta, renewals and the API's own note (verbatim). */
export function ImpactView({ data, loading, error, currency }: { data?: PriceImpact; loading: boolean; error?: string; currency: string }) {
  if (error) return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">Couldn&apos;t simulate: {error}</p>;
  if (!data) return <p className="flex items-center gap-2 text-sm text-muted-foreground">{loading ? <><Loader2 className="size-4 animate-spin" aria-hidden />Calculating impact…</> : 'Change a price to preview its impact.'}</p>;
  const delta = Number(data.mrrDelta);
  const tone = delta === 0 ? 'text-muted-foreground' : delta > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400';
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  return (
    <div className={cn('space-y-3 transition-opacity', loading && 'opacity-60')} aria-busy={loading}>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><dt className="text-xs text-muted-foreground">Active subscribers affected</dt><dd className="text-lg font-semibold tabular-nums">{fmtInt(data.affected.activeSubscribers)}</dd><dd className="text-xs text-muted-foreground">{data.affected.monthlyCycle} monthly · {data.affected.yearlyCycle} yearly</dd></div>
        <div><dt className="text-xs text-muted-foreground">MRR now → projected</dt><dd className="text-lg font-semibold tabular-nums">{money(data.currentMrr, currency)} → {money(data.projectedMrr, currency)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">MRR change</dt><dd className={cn('text-lg font-semibold tabular-nums', tone)}>{sign}{money(Math.abs(delta), currency)}{data.mrrDeltaPct !== null ? ` (${sign}${Math.abs(Math.round(data.mrrDeltaPct * 10) / 10)}%)` : ''}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Renewals in next 30 days</dt><dd className="text-lg font-semibold tabular-nums">{fmtInt(data.renewalsInNext30Days)}</dd></div>
      </dl>
      <p className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[13px] text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden /><span>{data.note}</span>
      </p>
    </div>
  );
}
