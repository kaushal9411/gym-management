'use client';

import * as React from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissionRegistry } from '../hooks/use-iam';

interface PermissionTreeProps {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
}

/** Grouped-by-resource permission picker with per-group bulk select — used by the role editor and user overrides. */
export function PermissionTree({ selected, onChange, disabled }: PermissionTreeProps) {
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

  const toggle = (key: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(key);
    else next.delete(key);
    onChange(next);
  };

  const toggleGroup = (keys: string[], checked: boolean) => {
    const next = new Set(selected);
    for (const key of keys) {
      if (checked) next.add(key);
      else next.delete(key);
    }
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {registry.data.groups.map((group) => {
        const keys = group.permissions.map((p) => p.key);
        const selectedCount = keys.filter((k) => selected.has(k)).length;
        const allSelected = selectedCount === keys.length;
        return (
          <div key={group.resource} className="rounded-lg border">
            <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
              <Checkbox
                id={`group-${group.resource}`}
                checked={allSelected}
                disabled={disabled}
                onCheckedChange={(checked) => toggleGroup(keys, checked === true)}
              />
              <Label htmlFor={`group-${group.resource}`} className="cursor-pointer text-sm font-semibold capitalize">
                {group.resource.replace(/-/g, ' ')}
              </Label>
              <span className="ml-auto text-xs text-muted-foreground">
                {selectedCount}/{keys.length}
              </span>
            </div>
            <div className="grid gap-2 p-3 sm:grid-cols-2">
              {group.permissions.map((permission) => (
                <div key={permission.key} className="flex items-start gap-2">
                  <Checkbox
                    id={`perm-${permission.key}`}
                    checked={selected.has(permission.key)}
                    disabled={disabled}
                    onCheckedChange={(checked) => toggle(permission.key, checked === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor={`perm-${permission.key}`} className="cursor-pointer font-normal leading-snug">
                    <span className="font-mono text-xs">{permission.key}</span>
                    {permission.description ? (
                      <span className="block text-xs text-muted-foreground">{permission.description}</span>
                    ) : null}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
