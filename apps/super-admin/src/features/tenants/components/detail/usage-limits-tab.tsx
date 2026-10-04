'use client';

import { motion, useReducedMotion } from 'framer-motion';

import { fmtInt } from '@/features/dashboard/components/format';
import { Chip, EmptyNote, Panel } from '@/features/dashboard/components/ui';
import { useTenantOverview } from '@/features/tenants/api/detail';
import { LimitsEditor } from './controls/limits-editor';

const color = (pct: number | null) => (pct === null ? 'var(--chart-1)' : pct >= 90 ? 'var(--chart-5)' : pct >= 80 ? 'var(--chart-4)' : 'var(--chart-1)');

function Gauge({ pct, reduce }: { pct: number; reduce: boolean }) {
  const r = 28; const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 72 72" className="size-[72px] shrink-0" aria-hidden>
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--muted)" strokeWidth="7" />
      <motion.circle cx="36" cy="36" r={r} fill="none" stroke={color(pct)} strokeWidth="7" strokeLinecap="round" transform="rotate(-90 36 36)" strokeDasharray={c} initial={reduce ? false : { strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.min(100, pct) / 100) }} transition={{ duration: 0.6, ease: 'easeOut' }} />
      <text x="36" y="40" textAnchor="middle" className="fill-foreground text-[13px] font-semibold">{Math.round(pct)}%</text>
    </svg>
  );
}

/** Usage & limits tab: live usage gauges + the shared limit-overrides editor. */
export function UsageLimitsTab({ tenantId, canManage }: { tenantId: string; canManage: boolean }) {
  const reduce = !!useReducedMotion();
  const q = useTenantOverview(tenantId);
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Panel title="Live usage" hint={q.data?.tenant.plan ? `${q.data.tenant.plan} plan` : undefined} index={0}>
        {q.isLoading ? <div className="h-48 animate-pulse rounded-lg bg-muted" aria-busy="true" /> : q.isError || !q.data ? <EmptyNote>Could not load usage.</EmptyNote> : (
          <div className="grid gap-3 sm:grid-cols-2">
            {q.data.usage.map((u) => (
              <div key={u.key} className="flex items-center gap-3 rounded-xl border p-3">
                {u.pct !== null && u.used !== null ? <Gauge pct={u.pct} reduce={reduce} /> : <div className="grid size-[72px] shrink-0 place-items-center rounded-full border-4 border-dashed text-[11px] text-muted-foreground">n/a</div>}
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">{u.label}{u.overridden ? <Chip tone="violet">overridden</Chip> : null}</p>
                  <p className="font-mono text-xs">{u.used === null ? 'Not tracked' : fmtInt(u.used)} / {u.limit === null ? 'no limit' : fmtInt(u.limit)}{u.key === 'storage_gb' ? ' GB' : ''}</p>
                  {u.used === null ? <p className="text-[11px] text-muted-foreground">Storage consumption is not measured yet; only the limit is enforced.</p> : u.pct !== null && u.pct >= 80 ? <p className="text-[11px] font-medium" style={{ color: color(u.pct) }}>{u.pct >= 90 ? 'Near the limit' : 'Approaching the limit'}</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">Usage is counted live from members, staff and branches. Overrides survive plan changes — clear an override to return to the plan value.</p>
      </Panel>
      <Panel title="Limit overrides" hint="plan · override · effective" index={1}>
        <LimitsEditor tenantId={tenantId} canManage={canManage} />
      </Panel>
    </div>
  );
}
