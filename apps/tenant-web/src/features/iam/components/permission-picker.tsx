'use client';

import * as React from 'react';
import { Check, Minus, Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { usePermissionRegistry } from '../hooks/use-iam';

function TriBox({ state, onClick, disabled, label }: { state: 'on' | 'off' | 'some'; onClick?: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === 'some' ? 'mixed' : state === 'on'}
      aria-label={label}
      disabled={disabled || !onClick}
      onClick={onClick}
      className={cn(
        'grid size-[22px] shrink-0 place-items-center rounded-[7px] border-2 text-white transition-colors disabled:cursor-default',
        state === 'off' ? 'border-border bg-background' : 'border-primary bg-primary',
      )}
    >
      {state === 'on' ? <Check className="size-3" strokeWidth={3} /> : state === 'some' ? <Minus className="size-3" strokeWidth={3} /> : null}
    </button>
  );
}

interface PermissionPickerProps {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  /** The permission set as loaded — rows that differ from it get a "changed" marker. */
  baseline?: Set<string>;
  /** No inputs at all (system roles / no manage permission): selection is just displayed. */
  readOnly?: boolean;
  disabled?: boolean;
}

/** Grouped-by-resource permission picker: search, tri-state group boxes with counts, All/None per group, changed-since-load markers. */
export function PermissionPicker({ selected, onChange, baseline, readOnly, disabled }: PermissionPickerProps) {
  const registry = usePermissionRegistry();
  const [query, setQuery] = React.useState('');

  if (registry.isPending) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    );
  }
  if (!registry.data) return null;

  const q = query.trim().toLowerCase();
  const setMany = (keys: string[], on: boolean) => {
    const next = new Set(selected);
    for (const k of keys) {
      if (on) next.add(k);
      else next.delete(k);
    }
    onChange(next);
  };
  const toggle = (key: string) => setMany([key], !selected.has(key));

  const groups = registry.data.groups
    .map((g) => ({
      ...g,
      visible: q ? g.permissions.filter((p) => p.key.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)) : g.permissions,
    }))
    .filter((g) => g.visible.length > 0);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input aria-label="Search permissions" placeholder="Search permissions, e.g. members or invoices:read" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
      </div>
      {groups.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No permissions match “{query}”.</p> : null}
      {groups.map((group) => {
        const allKeys = group.permissions.map((p) => p.key);
        const visibleKeys = group.visible.map((p) => p.key);
        const count = allKeys.filter((k) => selected.has(k)).length;
        const state = count === 0 ? 'off' : count === allKeys.length ? 'on' : 'some';
        const label = group.resource.replace(/-/g, ' ');
        return (
          <div key={group.resource} className="overflow-hidden rounded-2xl border">
            <div className="flex flex-wrap items-center gap-2.5 border-b bg-muted/40 px-3.5 py-2.5">
              <TriBox
                state={state}
                label={`Select all ${label} permissions`}
                disabled={disabled}
                onClick={readOnly ? undefined : () => setMany(visibleKeys, !visibleKeys.every((k) => selected.has(k)))}
              />
              <span className="text-sm font-bold capitalize">{label}</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary">
                {count}/{allKeys.length}
              </span>
              {!readOnly ? (
                <span className="ml-auto flex gap-1">
                  <button type="button" disabled={disabled} onClick={() => setMany(visibleKeys, true)} className="rounded-lg px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary/10">
                    All
                  </button>
                  <button type="button" disabled={disabled} onClick={() => setMany(visibleKeys, false)} className="rounded-lg px-2 py-0.5 text-xs font-semibold text-muted-foreground hover:bg-accent">
                    None
                  </button>
                </span>
              ) : null}
            </div>
            <div className="grid gap-1.5 p-2.5 sm:grid-cols-2">
              {group.visible.map((p) => {
                const on = selected.has(p.key);
                const changed = baseline ? baseline.has(p.key) !== on : false;
                return (
                  <button
                    key={p.key}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={disabled || readOnly}
                    onClick={() => toggle(p.key)}
                    className={cn(
                      'flex min-w-0 items-start gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors disabled:cursor-default',
                      on ? 'border-primary/40 bg-primary/8' : 'border-transparent hover:bg-accent/60',
                      readOnly && !on && 'opacity-55',
                    )}
                  >
                    <span className={cn('mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-md border-2 text-white', on ? 'border-primary bg-primary' : 'border-border')}>
                      {on ? <Check className="size-2.5" strokeWidth={4} /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-mono text-xs font-semibold">{p.key}</span>
                        {changed ? <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: 'var(--warning)' }} title="Changed since load" /> : null}
                      </span>
                      {p.description ? <span className="block text-xs leading-snug text-muted-foreground">{p.description}</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
