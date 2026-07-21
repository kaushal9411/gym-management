'use client';

import * as React from 'react';
import { Check } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { IamNav } from '@/features/iam/components/iam-nav';
import { usePermissionMatrix, usePermissionRegistry } from '@/features/iam/hooks/use-iam';
import { cn } from '@/lib/utils';

export default function PermissionsPage() {
  const [tab, setTab] = React.useState<'registry' | 'matrix'>('registry');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Permissions</h1>
        <p className="text-muted-foreground">The central registry every module authorizes against.</p>
      </div>

      <IamNav />

      <div className="inline-flex rounded-md border p-0.5">
        {(['registry', 'matrix'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded px-3 py-1.5 text-sm font-medium capitalize transition-colors',
              tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'registry' ? <Registry /> : <Matrix />}
    </div>
  );
}

function Registry() {
  const registry = usePermissionRegistry();
  if (registry.isPending) return <Skeleton className="h-96 w-full" />;
  if (!registry.data) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {registry.data.groups.map((group) => (
        <Card key={group.resource}>
          <CardHeader>
            <CardTitle className="text-base capitalize">{group.resource.replace(/-/g, ' ')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {group.permissions.map((p) => (
              <div key={p.key} className="flex items-baseline gap-2 text-sm">
                <Badge variant="outline" className="shrink-0 font-mono text-xs font-normal">{p.key}</Badge>
                <span className="text-muted-foreground">{p.description}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Matrix() {
  const matrix = usePermissionMatrix();
  if (matrix.isPending) return <Skeleton className="h-96 w-full" />;
  if (!matrix.data) return null;

  const { roles, permissions } = matrix.data;
  const roleSets = roles.map((r) => new Set(r.permissionKeys));

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="sticky left-0 bg-muted/40 px-4 py-2.5 text-left font-medium">Permission</th>
            {roles.map((role) => (
              <th key={role.id} className="whitespace-nowrap px-3 py-2.5 text-center font-medium">
                {role.name}
                {!role.isSystem ? <span className="block text-[10px] normal-case text-muted-foreground">custom</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {permissions.map((permission) => (
            <tr key={permission.key} className="hover:bg-accent/40">
              <td className="sticky left-0 bg-background px-4 py-2 font-mono text-xs">{permission.key}</td>
              {roles.map((role, i) => (
                <td key={role.id} className="px-3 py-2 text-center">
                  {roleSets[i]!.has(permission.key) ? (
                    <Check className="mx-auto size-4 text-emerald-600 dark:text-emerald-400" aria-label={`${role.name} has ${permission.key}`} />
                  ) : (
                    <span className="text-muted-foreground/40" aria-hidden>—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
