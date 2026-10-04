'use client';

import Link from 'next/link';

import type { DashboardOverview } from '../types';
import type { ConsoleIntent, TenantRef } from './command-console';
import { actionColor, fmtInt, fmtMoney } from './format';
import { Bar, EmptyNote, Panel } from './ui';

export function TopTenants({ rows, onSelect, index }: { rows: DashboardOverview['topTenants']; onSelect: ((t: TenantRef, i?: ConsoleIntent) => void) | undefined; index: number }) {
  const hasMrr = rows.some((r) => r.mrr !== null && r.mrr !== undefined);
  const val = (r: DashboardOverview['topTenants'][number]) => (hasMrr ? Number(r.mrr ?? 0) : (r.members ?? 0));
  const sorted = [...rows].sort((a, b) => val(b) - val(a)).slice(0, 6);
  const max = Math.max(...sorted.map(val), 1);
  return (
    <Panel title="Top tenants" hint={hasMrr ? 'by MRR' : 'by members'} index={index} className="md:col-span-2 xl:col-span-7">
      {sorted.length === 0 ? <EmptyNote>No tenant usage data yet.</EmptyNote> : (
        <ol>
          {sorted.map((r, i) => {
            const body = (
              <>
                <span className="w-5 shrink-0 font-mono text-xs text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-semibold">{r.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[r.plan, r.branches !== null && r.branches !== undefined ? `${fmtInt(r.branches)} branch${r.branches === 1 ? '' : 'es'}` : null, r.members !== null ? `${fmtInt(r.members)} members` : null].filter(Boolean).join(' · ') || r.slug}</span>
                </span>
                <span className="hidden w-28 shrink-0 sm:block"><Bar pct={(val(r) / max) * 100} color="var(--chart-1)" /></span>
                <b className="w-[4.5rem] shrink-0 text-right font-mono text-xs tabular-nums sm:w-20">{hasMrr ? fmtMoney(val(r)) : fmtInt(val(r))}</b>
              </>
            );
            return (
              <li key={r.tenantId} className="border-t first:border-t-0">
                {onSelect ? <button type="button" onClick={() => onSelect({ id: r.tenantId, slug: r.slug, name: r.name })} aria-label={`Open console for ${r.name}`} className="flex w-full items-center gap-2.5 rounded-lg py-2 outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring">{body}</button> : <div className="flex items-center gap-2.5 py-2">{body}</div>}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

function when(iso: string, now: number | null): string {
  const d = new Date(iso);
  const sameDay = now !== null && new Date(now).toDateString() === d.toDateString();
  return sameDay ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function ActivityTimeline({ rows, now, index }: { rows: DashboardOverview['activity']; now: number | null; index: number }) {
  return (
    <Panel title="Recent activity" hint="admin audit" index={index} className="xl:col-span-6" right={<Link href="/audit-logs" className="text-xs font-semibold text-primary hover:underline">View all</Link>}>
      {rows.length === 0 ? <EmptyNote>No recent admin activity.</EmptyNote> : (
        <ul>
          {rows.slice(0, 8).map((a) => (
            <li key={a.id}>
              <Link href="/audit-logs" className="flex gap-2.5 rounded-md py-1.5 text-[12.5px] outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring">
                <i className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: actionColor(a.action) }} aria-hidden />
                <span className="min-w-0 flex-1"><b className="font-semibold">{a.actorName ?? 'System'}</b> <span className="text-muted-foreground">{a.summary}</span></span>
                <time dateTime={a.at} className="shrink-0 whitespace-nowrap font-mono text-[11px] text-muted-foreground">{when(a.at, now)}</time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
