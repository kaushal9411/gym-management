'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarPlus, Loader2, Power, Repeat, Search, ShieldAlert, UserCog, Wrench, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { useTenantSearch } from '@/features/tenants/hooks/use-tenants';
import type { TenantStatus } from '@/features/tenants/types';
import { cn } from '@/lib/utils';
import { readRecentTenants, type RecentTenant } from './recent-tenants';
import { Chip, type ChipTone } from './ui';

export interface TenantRef { id: string; slug: string; name: string; status?: TenantStatus }
/** Quick action requested from the command bar; the inline control card focuses the matching group. */
export type ConsoleIntent = 'extend' | 'maintenance' | 'impersonate' | 'suspend';

const STATUS_TONE: Record<TenantStatus, ChipTone> = { ACTIVE: 'green', TRIAL: 'amber', PAST_DUE: 'red', SUSPENDED: 'red', CANCELLED: 'slate' };

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

interface CommandBarProps {
  target: TenantRef | null;
  onTarget: (t: TenantRef | null) => void;
  onQuick: (intent: ConsoleIntent) => void;
}

/** Tenant command card: search → target chip, quick actions (focus the matching group of the inline control card), recent tenants. */
export function CommandBar({ target, onTarget, onQuick }: CommandBarProps) {
  const canManage = useHasPermission('tenants:manage');
  const [q, setQ] = useState('');
  const [hint, setHint] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [recent, setRecent] = useState<RecentTenant[]>([]);
  const debounced = useDebounced(q, 300);
  const { data, isFetching } = useTenantSearch(debounced);
  useEffect(() => setRecent(readRecentTenants()), [target]);
  const items = data?.items ?? [];
  const showList = q.trim().length > 0 && debounced.trim() === q.trim();

  const choose = (t: TenantRef) => {
    onTarget(t);
    setHint(false);
    setQ('');
  };
  const quick = (intent: ConsoleIntent) => {
    if (!target) { setHint(true); inputRef.current?.focus(); return; }
    onQuick(intent);
  };
  const suspended = target?.status === 'SUSPENDED';
  const actions: Array<{ intent: ConsoleIntent; label: string; icon: typeof Wrench; danger?: boolean }> = [
    { intent: 'extend', label: 'Extend trial', icon: CalendarPlus },
    { intent: 'maintenance', label: 'Maintenance mode', icon: Wrench },
    { intent: 'impersonate', label: 'Impersonate', icon: UserCog },
    { intent: 'suspend', label: suspended ? 'Reactivate' : 'Suspend', icon: suspended ? Power : ShieldAlert, danger: !suspended },
  ];

  return (
    <section aria-label="Tenant command" className="relative z-20 rounded-[14px] border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="text-[13px] font-semibold">Tenant command</h2>
        <div className="relative min-w-[240px] flex-1 basis-72">
          <label className="flex h-10 items-center gap-2 rounded-[10px] border border-input bg-muted/50 px-3 focus-within:ring-2 focus-within:ring-ring">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={inputRef}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Find a tenant to manage — name or slug"
              aria-label="Search tenants"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && items[0]) choose(items[0]);
                if (e.key === 'Escape') setQ('');
              }}
            />
            {isFetching ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden /> : null}
          </label>
          {showList ? (
            <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border bg-popover p-1 shadow-xl">
              {items.length === 0 && !isFetching ? <li className="p-3 text-sm text-muted-foreground">No tenants match.</li> : null}
              {items.map((t) => (
                <li key={t.id}>
                  <button type="button" className="flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none" onClick={() => choose({ id: t.id, slug: t.slug, name: t.name, status: t.status })}>
                    <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
                    <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{t.slug}</span>
                    <Chip tone={STATUS_TONE[t.status]}>{t.status}</Chip>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {target ? (
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-accent py-1 pl-3 pr-1 text-xs font-semibold">
            <span className="truncate">{target.name}</span>
            <button type="button" onClick={() => onTarget(null)} aria-label="Clear selected tenant" className="grid size-5 place-items-center rounded-full hover:bg-muted"><X className="size-3" aria-hidden /></button>
          </span>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {actions.map((a) => (
            <Button key={a.intent} size="sm" variant="outline" className={cn(a.danger && 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300')} disabled={!!target && !canManage} title={target && !canManage ? 'Requires tenants:manage' : undefined} onClick={() => quick(a.intent)}>
              <a.icon className="size-3.5" aria-hidden />{a.label}
            </Button>
          ))}
          {target ? (
            <Button size="sm" variant="outline" asChild><Link href={`/tenants/${target.id}`}><Repeat className="size-3.5" aria-hidden />Change plan</Link></Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => { setHint(true); inputRef.current?.focus(); }}><Repeat className="size-3.5" aria-hidden />Change plan</Button>
          )}
        </div>
      </div>
      {hint && !target ? <p role="status" className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-300">Select a tenant first — search above, then pick an action.</p> : null}
      {recent.length ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          Recent:
          {recent.map((r, i) => (
            <span key={r.id}>
              <button type="button" className="rounded font-semibold text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onTarget(r)}>{r.name}</button>
              {i < recent.length - 1 ? ' ·' : ''}
            </span>
          ))}
        </p>
      ) : null}
    </section>
  );
}
