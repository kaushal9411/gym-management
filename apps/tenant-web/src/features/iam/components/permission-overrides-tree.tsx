'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
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

const MODE_LABEL: Record<'INHERIT' | 'GRANT' | 'DENY', string> = {
  INHERIT: '·',
  GRANT: '✓',
  DENY: '✕',
};

/**
 * Grouped-by-resource permission override editor for one user. Unlike the
 * generic `PermissionTree` (a plain multi-select used by the role editor,
 * where there's no "current" state to reconcile against), every row here
 * shows whether the user *currently, actually* has that permission — role
 * grant plus any pending override combined — and the leading indicator is
 * itself a one-tap grant/deny shortcut, not just a passive readout. The
 * segmented Inherit/Grant/Deny control next to it is the only way back to
 * "no override" (removing an explicit grant/deny).
 */
export function PermissionOverridesTree({
  overrides,
  onChange,
  effective,
  disabled,
}: PermissionOverridesTreeProps) {
  const registry = usePermissionRegistry();

  if (registry.isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
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

  return (
    <div className="space-y-4">
      {registry.data.groups.map((group) => (
        <div key={group.resource} className="rounded-lg border">
          <div className="border-b bg-muted/40 px-3 py-2">
            <span className="text-sm font-semibold capitalize">{group.resource.replace(/-/g, ' ')}</span>
          </div>
          <div className="divide-y">
            {group.permissions.map((permission) => {
              const granted = isGranted(permission.key);
              const mode = modeOf(permission.key);
              return (
                <div key={permission.key} className="flex items-center gap-3 px-3 py-2">
                  <Button
                    type="button"
                    size="icon"
                    variant={granted ? 'success' : 'outline'}
                    disabled={disabled}
                    onClick={() => onChange(permission.key, granted ? 'DENY' : 'GRANT')}
                    className="size-6 shrink-0 rounded-full text-xs"
                    aria-label={
                      granted
                        ? `${permission.key} — currently granted, click to deny`
                        : `${permission.key} — currently not granted, click to grant`
                    }
                  >
                    {granted ? '✓' : ''}
                  </Button>
                  <div className="min-w-0 flex-1">
                    <span className="block font-mono text-xs">{permission.key}</span>
                    {permission.description ? (
                      <span className="block text-xs text-muted-foreground">{permission.description}</span>
                    ) : null}
                  </div>
                  <div className="inline-flex shrink-0 rounded-md border p-0.5">
                    {(['INHERIT', 'GRANT', 'DENY'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange(permission.key, m === 'INHERIT' ? null : m)}
                        className={cn(
                          'rounded px-2 py-0.5 text-xs font-medium',
                          mode === m
                            ? m === 'DENY'
                              ? 'bg-destructive text-destructive-foreground'
                              : m === 'GRANT'
                                ? 'bg-success text-success-foreground'
                                : 'bg-muted-foreground/20 text-foreground'
                            : 'text-muted-foreground hover:bg-accent',
                        )}
                      >
                        {MODE_LABEL[m]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
