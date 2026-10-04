'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, PanelRightOpen } from 'lucide-react';

import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, Chip, type ChipTone } from '@/features/dashboard/components/ui';
import { fmtInt, fmtMoneyCompact, timeAgo } from '@/features/dashboard/components/format';
import { cn } from '@/lib/utils';
import type { ListSort, TenantRow } from '../../api/list';
import { LIMITS, type ListFilters } from './url-state';

const STATUS: Record<string, { tone: ChipTone; label: string }> = {
  ACTIVE: { tone: 'green', label: 'Active' }, TRIAL: { tone: 'amber', label: 'Trial' }, PAST_DUE: { tone: 'red', label: 'Past due' },
  SUSPENDED: { tone: 'red', label: 'Suspended' }, CANCELLED: { tone: 'slate', label: 'Cancelled' },
};
const PLAN_TONES: ChipTone[] = ['blue', 'violet', 'green', 'amber', 'slate'];
const planTone = (n: string): ChipTone => PLAN_TONES[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % PLAN_TONES.length]!;
const dShort = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const DAY = 86_400_000;

function statusChip(t: TenantRow, now: number | null) {
  const s = STATUS[t.status] ?? { tone: 'slate' as ChipTone, label: t.status };
  if (t.status === 'TRIAL' && t.trialEndsAt && now !== null) {
    const d = Math.ceil((new Date(t.trialEndsAt).getTime() - now) / DAY);
    return <Chip tone={d <= 3 ? 'red' : 'amber'}>{d < 0 ? 'Trial · ended' : `Trial · ${d}d left`}</Chip>;
  }
  return <Chip tone={s.tone}>{s.label}</Chip>;
}

function renewCell(t: TenantRow) {
  if (t.status === 'TRIAL' && t.trialEndsAt) return <span title="Trial ends">{dShort(t.trialEndsAt)}<span className="ml-1 text-[11px] text-muted-foreground">trial end</span></span>;
  if (t.renewsAt) return dShort(t.renewsAt);
  return <span className="text-muted-foreground">—</span>;
}

function healthColor(s: number) { return s <= 40 ? '#dc2626' : s <= 70 ? '#d97706' : '#16a34a'; }

function MembersCell({ t }: { t: TenantRow }) {
  const reduce = useReducedMotion();
  if (t.members === null) return <span className="text-muted-foreground">—</span>;
  if (!t.membersLimit) return <span className="font-mono text-[12.5px]">{fmtInt(t.members)}</span>;
  const pct = (t.members / t.membersLimit) * 100;
  const color = pct >= 90 ? '#dc2626' : pct >= 80 ? '#d97706' : 'var(--chart-1)';
  return (
    <div className="flex items-center gap-2" title={`${Math.round(pct)}% of member limit`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" role="presentation">
        <motion.div className="h-full origin-left rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.25, ease: 'easeOut' }} />
      </div>
      <span className="whitespace-nowrap font-mono text-[12.5px]">{fmtInt(t.members)} / {fmtInt(t.membersLimit)}</span>
    </div>
  );
}

interface ColDef { label: string; sort?: ListSort; defDir?: 'asc' | 'desc' }
const COLS: ColDef[] = [
  { label: 'Tenant', sort: 'name', defDir: 'asc' }, { label: 'Plan' }, { label: 'Status' }, { label: 'Members / limit', sort: 'members' },
  { label: 'MRR', sort: 'mrr' }, { label: 'Renews / trial ends' }, { label: 'Last active', sort: 'lastActiveAt' }, { label: 'Health', sort: 'health' },
];

export function TenantTable({ rows, loading, now, filters, selected, onToggle, onTogglePage, onSort, quickId, onQuick }: {
  rows: TenantRow[]; loading: boolean; now: number | null; filters: ListFilters; selected: Map<string, string>;
  onToggle: (t: TenantRow) => void; onTogglePage: (on: boolean) => void; onSort: (s: ListSort, dir: 'asc' | 'desc') => void;
  quickId: string | null; onQuick: (t: TenantRow) => void;
}) {
  const router = useRouter();
  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someOn = rows.some((r) => selected.has(r.id));
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[1080px] border-collapse text-[13px]">
        <thead>
          <tr>
            <th scope="col" className="w-10 border-b bg-muted/50 px-3 py-2.5 text-left">
              <Checkbox aria-label="Select all tenants on this page" checked={allOn ? true : someOn ? 'indeterminate' : false} disabled={rows.length === 0} onCheckedChange={(v) => onTogglePage(v === true)} />
            </th>
            {COLS.map((c) => {
              const active = c.sort && filters.sort === c.sort;
              return (
                <th key={c.label} scope="col" aria-sort={active ? (filters.dir === 'asc' ? 'ascending' : 'descending') : c.sort ? 'none' : undefined} className="whitespace-nowrap border-b bg-muted/50 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  {c.sort ? (
                    <button type="button" className="inline-flex items-center gap-1 rounded uppercase outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onSort(c.sort!, active ? (filters.dir === 'asc' ? 'desc' : 'asc') : (c.defDir ?? 'desc'))}>
                      {c.label}{active ? (filters.dir === 'asc' ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />) : null}
                    </button>
                  ) : c.label}
                </th>
              );
            })}
            <th scope="col" className="w-12 border-b bg-muted/50 px-3 py-2.5"><span className="sr-only">Quick view</span></th>
          </tr>
        </thead>
        <tbody>
          {loading ? Array.from({ length: 8 }).map((_, i) => (
            <tr key={i}><td colSpan={10} className="border-b px-3 py-2.5"><Skeleton className="h-9 w-full" /></td></tr>
          )) : rows.map((t) => {
            const sel = selected.has(t.id);
            const h = t.healthComponents;
            return (
              <tr
                key={t.id}
                onClick={() => router.push(`/tenants/${t.id}`)}
                className={cn('group cursor-pointer transition-colors hover:bg-muted/50', sel && 'bg-primary/5 hover:bg-primary/10', quickId === t.id && 'bg-accent/60')}
              >
                <td className="border-b px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <Checkbox aria-label={`Select ${t.name}`} checked={sel} onCheckedChange={() => onToggle(t)} />
                </td>
                <td className="border-b px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={t.name} seed={t.slug} />
                    <div className="min-w-0 leading-tight">
                      <Link href={`/tenants/${t.id}`} onClick={(e) => e.stopPropagation()} className="block max-w-[220px] truncate font-semibold outline-none hover:text-primary focus-visible:underline">{t.name}</Link>
                      <span className="block max-w-[240px] truncate font-mono text-xs text-muted-foreground">{t.slug}{t.owner ? ` · ${t.owner.email}` : ''}</span>
                      {t.tags && t.tags.length > 0 ? (
                        <span className="mt-0.5 flex gap-1">{t.tags.slice(0, 2).map((g) => <span key={g} className="rounded bg-muted px-1.5 text-[10.5px] font-medium text-muted-foreground">{g}</span>)}{t.tags.length > 2 ? <span className="text-[10.5px] text-muted-foreground">+{t.tags.length - 2}</span> : null}</span>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="border-b px-3 py-2.5">{t.planName ? <Chip tone={planTone(t.planName)}>{t.planName}</Chip> : <span className="text-muted-foreground">—</span>}</td>
                <td className="border-b px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1">{statusChip(t, now)}{t.maintenanceMode ? <Chip tone="violet">Maintenance</Chip> : null}</div>
                </td>
                <td className="border-b px-3 py-2.5"><MembersCell t={t} /></td>
                <td className="border-b px-3 py-2.5 font-mono text-[12.5px]">{t.mrr !== null ? fmtMoneyCompact(t.mrr) : <span className="font-sans text-muted-foreground">—</span>}</td>
                <td className="whitespace-nowrap border-b px-3 py-2.5">{renewCell(t)}</td>
                <td className="whitespace-nowrap border-b px-3 py-2.5">{t.lastActiveAt && now !== null ? timeAgo(new Date(t.lastActiveAt).getTime(), now) : <span className="text-muted-foreground">Never</span>}</td>
                <td className="border-b px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums" title={`Engagement ${h.engagement} · Billing ${h.billing} · Utilisation ${h.utilisation} · Support ${h.support}`} aria-label={`Health ${t.healthScore}. Engagement ${h.engagement}, billing ${h.billing}, utilisation ${h.utilisation}, support ${h.support}`}>
                    <i className="size-[9px] rounded-full" style={{ background: healthColor(t.healthScore) }} aria-hidden />{t.healthScore}
                  </span>
                </td>
                <td className="border-b px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                  <button type="button" aria-label={`Quick view ${t.name}`} aria-pressed={quickId === t.id} title="Quick view" onClick={() => onQuick(t)} className={cn('rounded-md p-1.5 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring', quickId === t.id && 'bg-accent text-foreground')}>
                    <PanelRightOpen className="size-4" aria-hidden />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function pageWindow(page: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const s = new Set([1, total, page - 1, page, page + 1].filter((n) => n >= 1 && n <= total));
  const out: Array<number | '…'> = [];
  [...s].sort((a, b) => a - b).forEach((n, i, arr) => { if (i > 0 && n - arr[i - 1]! > 1) out.push('…'); out.push(n); });
  return out;
}

export function ListFooter({ page, limit, total, totalPages, onPage, onLimit }: { page: number; limit: number; total: number; totalPages: number; onPage: (p: number) => void; onLimit: (n: number) => void }) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  const btn = 'grid h-8 min-w-8 place-items-center rounded-md px-2 text-[13px] font-semibold outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:hover:bg-transparent';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px] text-muted-foreground">
      <span aria-live="polite">Showing {fmtInt(from)}–{fmtInt(to)} of {fmtInt(total)}</span>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5">Rows
          <select aria-label="Rows per page" value={limit} onChange={(e) => onLimit(Number(e.target.value))} className="h-8 rounded-md border border-input bg-card px-1.5 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {LIMITS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <nav className="flex items-center gap-0.5" aria-label="Pagination">
          <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="size-4" aria-hidden /></button>
          {pageWindow(page, totalPages).map((n, i) => n === '…' ? <span key={`e${i}`} className="px-1">…</span> : (
            <button key={n} type="button" className={cn(btn, n === page && 'bg-primary text-primary-foreground hover:bg-primary')} aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>{n}</button>
          ))}
          <button type="button" className={btn} disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="size-4" aria-hidden /></button>
        </nav>
      </div>
    </div>
  );
}
