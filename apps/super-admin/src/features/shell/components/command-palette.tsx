'use client';

import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Building2, Loader2, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { pushRecentTenant, readRecentTenants, type RecentTenant } from '@/features/dashboard/components/recent-tenants';
import { useTenantSearch } from '@/features/tenants/hooks/use-tenants';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Ctrl/Cmd+K tenant palette. Selecting a tenant navigates to its full page. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<RecentTenant[]>([]);
  const listRef = useRef<HTMLUListElement>(null);
  const debounced = useDebounced(q, 250);
  const { data, isFetching } = useTenantSearch(debounced);

  useEffect(() => {
    if (open) { setQ(''); setActive(0); setRecent(readRecentTenants()); }
  }, [open]);

  const searching = q.trim().length > 0;
  const items: RecentTenant[] = searching ? (data?.items ?? []).map((t) => ({ id: t.id, slug: t.slug, name: t.name })) : recent;

  const go = (t: RecentTenant) => {
    pushRecentTenant(t);
    onOpenChange(false);
    router.push(`/tenants/${t.id}`);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px]" />
        <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl outline-none">
          <Dialog.Title className="sr-only">Find a tenant</Dialog.Title>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              role="combobox"
              aria-expanded
              aria-controls="palette-list"
              aria-label="Search tenants by name or slug"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Search tenants by name or slug…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setActive(0); }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
                else if (e.key === 'Enter' && items[active]) { e.preventDefault(); go(items[active]); }
              }}
            />
            {isFetching ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden /> : <kbd className="rounded border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">Esc</kbd>}
          </div>
          <div className="max-h-80 overflow-y-auto p-1.5">
            {!searching ? <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{recent.length ? 'Recent tenants' : 'Type to search'}</p> : null}
            {searching && items.length === 0 && !isFetching ? <p className="px-3 py-6 text-center text-sm text-muted-foreground">No tenants match “{q.trim()}”.</p> : null}
            <ul id="palette-list" role="listbox" ref={listRef}>
              {items.map((t, i) => (
                <li key={t.id} role="option" aria-selected={i === active}>
                  <button type="button" onMouseEnter={() => setActive(i)} onClick={() => go(t)} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm ${i === active ? 'bg-accent' : ''}`}>
                    <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{t.slug}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
