'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/features/dashboard/components/kpi-card';
import { fmtInt } from '@/features/dashboard/components/format';
import { Chip, EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { toSchedulerError } from '@/features/scheduler/hooks/use-scheduler';
import { GrowBar } from '@/features/plans/components/bars';
import { PageBanner } from '@/features/plans/components/banner';
import { InlineConfirm, Switch } from '@/features/tenants/components/detail/controls/confirm';
import { CountChips, ErrorNote } from '@/features/tenants/components/detail/tabs/_shared/kit';
import { useFeatureFlags, useSetFeatureFlag } from '@/features/feature-flags/hooks/use-feature-flags';
import type { FeatureFlag } from '@/features/feature-flags/types';

type StateFilter = 'all' | 'on' | 'off';
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function FeatureFlagsPage() {
  const { data: flags, isLoading, isError, error, refetch } = useFeatureFlags();
  const setFlag = useSetFeatureFlag();
  const [q, setQ] = React.useState('');
  const [state, setState] = React.useState<StateFilter>('all');
  const [cat, setCat] = React.useState('all');
  const [confirming, setConfirming] = React.useState<string | null>(null);

  const cats = React.useMemo(() => {
    const m = new Map<string, { on: number; total: number }>();
    for (const f of flags ?? []) {
      const c = f.category ?? 'other';
      const v = m.get(c) ?? { on: 0, total: 0 };
      v.total++;
      if (f.enabled) v.on++;
      m.set(c, v);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [flags]);

  const visible = (flags ?? []).filter((f) => (cat === 'all' || (f.category ?? 'other') === cat) && (state === 'all' || (state === 'on') === f.enabled) && (!q.trim() || `${f.label} ${f.key}`.toLowerCase().includes(q.trim().toLowerCase())));
  const on = (flags ?? []).filter((f) => f.enabled).length;
  const total = flags?.length ?? 0;

  const toggle = async (f: FeatureFlag) => {
    try {
      await setFlag.mutateAsync({ key: f.key, enabled: !f.enabled });
      toast.success(`${f.label} ${f.enabled ? 'disabled' : 'enabled'}.`);
    } catch (e) {
      toast.error(toSchedulerError(e).message);
    } finally {
      setConfirming(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageBanner title="Feature flags" subtitle="Enable or disable modules globally, across every tenant. Each change asks for inline confirmation." chips={flags ? <Chip tone="green">{on} of {total} enabled</Chip> : null} />
      {isError ? <ErrorNote what="feature flags" message={(error as Error)?.message} onRetry={() => void refetch()} /> : null}
      {isLoading || !flags ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-[14px]" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard index={0} label="Total flags" value={total} format={fmtInt} color="var(--chart-1)" fallbackCaption="Platform-wide" />
            <KpiCard index={1} label="Enabled" value={on} format={fmtInt} color="var(--chart-6)" fallbackCaption={`${total ? Math.round((on / total) * 100) : 0}% of flags`} />
            <KpiCard index={2} label="Disabled" value={total - on} format={fmtInt} color="var(--chart-4)" fallbackCaption="Hidden from all tenants" />
            <KpiCard index={3} label="Categories" value={cats.length} format={fmtInt} color="var(--chart-3)" fallbackCaption="Flag groups" />
          </div>

          <Panel title="Enabled share by category" hint="flags are global on/off; there is no per-plan or per-tenant rollout" index={1}>
            <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {cats.map(([c, v]) => (
                <li key={c}>
                  <div className="mb-1 flex gap-2 text-[13px]"><span className="font-medium">{cap(c)}</span><span className="ml-auto tabular-nums text-muted-foreground">{v.on}/{v.total}</span></div>
                  <GrowBar pct={(v.on / v.total) * 100} color="var(--chart-1)" />
                </li>
              ))}
            </ul>
          </Panel>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search flags…" aria-label="Search flags" className="h-9 rounded-[9px] bg-card pl-8" />
            </div>
            <CountChips label="State" value={state} onChange={setState} options={[{ value: 'all', label: 'All' }, { value: 'on', label: 'Enabled', count: on }, { value: 'off', label: 'Disabled', count: total - on }]} />
          </div>
          <CountChips label="Category" value={cat} onChange={setCat} options={[{ value: 'all', label: 'All categories' }, ...cats.map(([c, v]) => ({ value: c, label: cap(c), count: v.total }))]} />

          {visible.length === 0 ? <EmptyNote>No flags match these filters.</EmptyNote> : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((f) => (
                <article key={f.key} className="min-w-0 space-y-3 rounded-[14px] border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-semibold">{f.label}</h2>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">{f.key}</p>
                    </div>
                    <Switch checked={f.enabled} label={`${f.label}: ${f.enabled ? 'enabled' : 'disabled'}`} disabled={setFlag.isPending} onChange={() => setConfirming(confirming === f.key ? null : f.key)} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Chip tone={f.enabled ? 'green' : 'slate'}>{f.enabled ? 'Enabled' : 'Disabled'}</Chip>
                    <Chip tone="blue">{cap(f.category ?? 'other')}</Chip>
                  </div>
                  {confirming === f.key ? (
                    <InlineConfirm
                      slug=""
                      onCancel={() => setConfirming(null)}
                      cfg={{ title: `${f.enabled ? 'Disable' : 'Enable'} ${f.label}?`, text: f.enabled ? 'The module becomes unavailable to every tenant immediately.' : 'The module becomes available to every tenant whose plan allows it.', label: f.enabled ? 'Disable' : 'Enable', destructive: f.enabled, pending: setFlag.isPending, run: () => void toggle(f) }}
                    />
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
