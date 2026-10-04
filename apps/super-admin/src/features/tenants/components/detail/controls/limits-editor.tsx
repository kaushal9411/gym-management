'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { toTenantError } from '@/features/tenants/hooks/use-tenants';
import { useSaveLimits, useTenantLimits, type LimitRow } from '@/features/tenants/api/detail';
import { Chip } from '@/features/dashboard/components/ui';
import { cn } from '@/lib/utils';
import { READONLY_TIP } from './confirm';

const fmtLimit = (v: number | null) => (v === null ? '—' : v.toLocaleString('en-IN'));
const parse = (s: string): number | null | 'bad' => {
  const t = s.trim();
  if (t === '') return null;
  if (!/^\d+$/.test(t)) return 'bad';
  const n = Number(t);
  return n > 1_000_000 ? 'bad' : n;
};

/**
 * Shared limit-overrides editor (control panel + Usage & limits tab). Plan value / override input / effective.
 * Only edited rows are sent; an empty input clears the override (null). Overrides survive plan changes.
 */
export function LimitsEditor({ tenantId, canManage }: { tenantId: string; canManage: boolean }) {
  const q = useTenantLimits(tenantId);
  const save = useSaveLimits(tenantId);
  const [draft, setDraft] = useState<Record<string, string>>({});

  if (q.isLoading) return <div className="h-40 animate-pulse rounded-lg bg-muted" aria-busy="true" />;
  if (q.isError || !q.data) return <p className="text-sm text-destructive">Could not load limits.</p>;

  const current = (r: LimitRow) => draft[r.key] ?? (r.override === null ? '' : String(r.override));
  const dirty = q.data.filter((r) => draft[r.key] !== undefined && parse(draft[r.key]!) !== r.override);
  const invalid = dirty.some((r) => parse(draft[r.key]!) === 'bad');

  const submit = async (rows: Array<[string, number | null]>, msg: string) => {
    const id = toast.loading('Saving limit overrides…');
    try {
      await save.mutateAsync(Object.fromEntries(rows));
      setDraft({});
      toast.success(msg, { id });
    } catch (e) { toast.error(toTenantError(e).message, { id }); }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[minmax(0,1fr)_52px_84px_64px] items-center gap-x-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Limit</span><span className="text-right">Plan</span><span>Override</span><span className="text-right">Effective</span>
      </div>
      {q.data.map((r) => {
        const val = current(r);
        const p = parse(val);
        const eff = p === 'bad' ? r.effective : (p ?? r.planValue ?? r.effective);
        const changed = draft[r.key] !== undefined && p !== r.override;
        return (
          <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_52px_84px_64px] items-center gap-x-2">
            <span className="flex min-w-0 flex-col items-start gap-0.5 text-[13px]">
              <span className="max-w-full">{r.label}</span>
              {r.override !== null ? <Chip tone="violet">overridden</Chip> : null}
            </span>
            <span className="text-right font-mono text-xs text-muted-foreground">{fmtLimit(r.planValue)}</span>
            <input
              inputMode="numeric"
              value={val}
              placeholder="plan"
              aria-label={`${r.label} override`}
              aria-invalid={p === 'bad'}
              disabled={!canManage || save.isPending}
              title={canManage ? undefined : READONLY_TIP}
              onChange={(e) => setDraft((d) => ({ ...d, [r.key]: e.target.value }))}
              className={cn('h-8 w-full rounded-md border bg-background px-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60', p === 'bad' && 'border-destructive', changed && 'border-primary')}
            />
            <span className="text-right font-mono text-xs font-semibold">{fmtLimit(eff)}</span>
            {r.override !== null && canManage ? (
              <button type="button" disabled={save.isPending} onClick={() => void submit([[r.key, null]], `${r.label} override cleared`)} className="col-span-4 -mt-0.5 justify-self-end text-[11px] font-medium text-primary underline-offset-2 hover:underline focus-visible:underline disabled:opacity-50">
                Clear override (back to plan)
              </button>
            ) : null}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="button" size="sm" disabled={!canManage || dirty.length === 0 || invalid || save.isPending} title={canManage ? undefined : READONLY_TIP} onClick={() => void submit(dirty.map((r) => [r.key, parse(draft[r.key]!) as number | null]), 'Limit overrides saved')}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}Save overrides{dirty.length ? ` (${dirty.length})` : ''}
        </Button>
        {dirty.length ? <Button type="button" size="sm" variant="outline" onClick={() => setDraft({})}>Discard</Button> : null}
        {invalid ? <span className="text-xs text-destructive">Whole numbers 0 – 1,000,000 only.</span> : null}
      </div>
      <p className="text-xs text-muted-foreground">Blank = follow the plan. Overrides survive plan changes.</p>
    </div>
  );
}
