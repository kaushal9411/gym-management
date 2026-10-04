'use client';

import * as React from 'react';
import { Check, Search, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { usePermissionRegistry } from '../hooks/use-iam';

export type OverrideMode = 'GRANT' | 'DENY' | null;

interface PermissionOverridesTreeProps {
  /** key -> mode; a key absent from the map means "inherit" (no override). */
  overrides: Map<string, 'GRANT' | 'DENY'>;
  onChange: (key: string, mode: OverrideMode) => void;
  /** The user's real effective permission set, fetched once at load — combined with pending [overrides] to show what they'd actually have right now. */
  effective: Set<string>;
  disabled?: boolean;
}

const MODES = [
  { mode: 'INHERIT', label: 'Inherit' },
  { mode: 'GRANT', label: 'Grant' },
  { mode: 'DENY', label: 'Revoke' },
] as const;

/**
 * Grouped-by-resource permission override editor for one user. Every row shows whether the user currently,
 * actually has that permission (role grant plus any pending override), colour-coded: green = granted,
 * red = revoked by an override, grey = not granted. The round indicator is a one-tap grant/revoke shortcut;
 * the Inherit/Grant/Revoke control is the only way back to "no override". Search + "Overrides only" filter.
 */
export function PermissionOverridesTree({ overrides, onChange, effective, disabled }: PermissionOverridesTreeProps) {
  const registry = usePermissionRegistry();
  const [query, setQuery] = React.useState('');
  const [onlyOverrides, setOnlyOverrides] = React.useState(false);

  if (registry.isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (!registry.data) return null;

  const modeOf = (key: string): 'INHERIT' | 'GRANT' | 'DENY' => overrides.get(key) ?? 'INHERIT';
  const isGranted = (key: string) => {
    const mode = modeOf(key);
    if (mode === 'GRANT') return true;
    if (mode === 'DENY') return false;
    return effective.has(key);
  };

  const q = query.trim().toLowerCase();
  const groups = registry.data.groups
    .map((g) => ({
      ...g,
      visible: g.permissions.filter(
        (p) => (!q || p.key.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)) && (!onlyOverrides || overrides.has(p.key)),
      ),
    }))
    .filter((g) => g.visible.length > 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="Search permissions" placeholder="Search permissions" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
        <button
          type="button"
          aria-pressed={onlyOverrides}
          onClick={() => setOnlyOverrides((v) => !v)}
          className={cn('rounded-xl border px-3 py-2 text-sm font-semibold transition-colors', onlyOverrides ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent')}
        >
          Overrides only ({overrides.size})
        </button>
      </div>
      {groups.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nothing to show.</p> : null}
      {groups.map((group) => {
        const grantedCount = group.permissions.filter((p) => isGranted(p.key)).length;
        return (
          <div key={group.resource} className="overflow-hidden rounded-2xl border">
            <div className="flex items-center gap-2 border-b bg-muted/40 px-3.5 py-2.5">
              <span className="text-sm font-bold capitalize">{group.resource.replace(/-/g, ' ')}</span>
              <span className="ml-auto rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-bold tabular-nums" style={{ color: 'var(--success)' }}>
                {grantedCount}/{group.permissions.length} effective
              </span>
            </div>
            <div className="divide-y">
              {group.visible.map((permission) => {
                const granted = isGranted(permission.key);
                const mode = modeOf(permission.key);
                return (
                  <div
                    key={permission.key}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5"
                    style={mode !== 'INHERIT' ? { backgroundColor: `color-mix(in oklch, ${mode === 'GRANT' ? 'var(--success)' : 'var(--destructive)'} 7%, transparent)` } : undefined}
                  >
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange(permission.key, granted ? 'DENY' : 'GRANT')}
                      className={cn(
                        'grid size-6 shrink-0 place-items-center rounded-full border-2 text-white transition-colors',
                        granted ? 'border-success bg-success' : mode === 'DENY' ? 'border-destructive bg-destructive' : 'border-border',
                      )}
                      aria-label={granted ? `${permission.key} — currently granted, click to revoke` : `${permission.key} — currently not granted, click to grant`}
                    >
                      {granted ? <Check className="size-3.5" strokeWidth={3} /> : mode === 'DENY' ? <X className="size-3.5" strokeWidth={3} /> : null}
                    </button>
                    <div className="min-w-0 flex-1 basis-40">
                      <span className="block break-all font-mono text-xs font-semibold">{permission.key}</span>
                      {permission.description ? <span className="block text-xs text-muted-foreground">{permission.description}</span> : null}
                    </div>
                    <div role="group" aria-label={`${permission.key} override`} className="inline-flex shrink-0 rounded-xl border bg-background p-0.5">
                      {MODES.map(({ mode: m, label }) => (
                        <button
                          key={m}
                          type="button"
                          disabled={disabled}
                          aria-pressed={mode === m}
                          onClick={() => onChange(permission.key, m === 'INHERIT' ? null : m)}
                          className={cn(
                            'rounded-[9px] px-2.5 py-1 text-xs font-bold transition-colors',
                            mode === m
                              ? m === 'DENY'
                                ? 'bg-destructive text-white'
                                : m === 'GRANT'
                                  ? 'bg-success text-white'
                                  : 'bg-muted text-foreground'
                              : 'text-muted-foreground hover:bg-accent',
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
