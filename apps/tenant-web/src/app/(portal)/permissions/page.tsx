'use client';

import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import { Check, KeyRound } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { IamHero } from '@/features/iam/components/iam-hero';
import { usePermissionMatrix, usePermissionRegistry } from '@/features/iam/hooks/use-iam';
import { type Accent, PanelCard, accentVar, tint } from '@/features/members/components/detail/detail-ui';
import { cn } from '@/lib/utils';

const MATRIX_ROW_HEIGHT = 41;
const ROLE_DOT: Accent[] = ['destructive', 'primary', 'aqua', 'violet', 'success', 'warning'];
const MATRIX_VIEWPORT_HEIGHT = 600;

export default function PermissionsPage() {
  const [tab, setTab] = React.useState<'registry' | 'matrix'>('registry');

  return (
    <div className="w-full space-y-5">
      <IamHero title="Permissions" subtitle="The central registry every module authorizes against." />

      <div className="inline-flex rounded-xl border bg-muted/50 p-0.5" role="group" aria-label="Permissions view">
        {(['registry', 'matrix'] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className={cn('rounded-[10px] px-5 py-1.5 text-sm font-bold capitalize transition-all', tab === t ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          >
            {t}
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
        {tab === 'registry' ? <Registry /> : <Matrix />}
      </motion.div>
    </div>
  );
}

const GROUP_TONES: Accent[] = ['primary', 'aqua', 'success', 'violet', 'warning', 'destructive'];

function Registry() {
  const registry = usePermissionRegistry();
  if (registry.isPending) return <Skeleton className="h-96 w-full" />;
  if (!registry.data) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {registry.data.groups.map((group, gi) => {
        const tone = GROUP_TONES[gi % GROUP_TONES.length]!;
        return (
          <PanelCard
            key={group.resource}
            icon={KeyRound}
            accent={tone}
            title={group.resource.replace(/-/g, ' ')}
            delay={Math.min(gi * 0.04, 0.4)}
            right={<span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums" style={{ backgroundColor: tint(tone, 14), color: accentVar(tone) }}>{group.permissions.length}</span>}
          >
            <div className="-my-1.5">
              {group.permissions.map((p) => (
                <div key={p.key} className="flex items-baseline gap-2 border-b border-dashed py-1.5 text-[12.5px] last:border-0">
                  <code className="shrink-0 rounded-lg px-2 py-0.5 font-mono text-[11.5px]" style={{ backgroundColor: tint(tone, 12), color: accentVar(tone) }}>{p.key}</code>
                  <span className="text-muted-foreground">{p.description}</span>
                </div>
              ))}
            </div>
          </PanelCard>
        );
      })}
    </div>
  );
}

function Matrix() {
  const matrix = usePermissionMatrix();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const { roles, permissions } = matrix.data ?? { roles: [], permissions: [] };

  // Row virtualization (Prompt 23: Global Loading & Performance
  // Optimization) — the permission catalog already exceeds 100 rows across
  // every role column, and only grows as more modules are added. Two spacer
  // `<tr>`s (top/bottom) sized to the un-rendered rows keep the real
  // `<table>`/`<tbody>` semantics intact — no `display: grid` override
  // needed — while only the rows in (and just around) the viewport are
  // ever mounted.
  const virtualizer = useVirtualizer({
    count: permissions.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => MATRIX_ROW_HEIGHT,
    overscan: 8,
  });

  if (matrix.isPending) return <Skeleton className="h-96 w-full" />;
  if (!matrix.data) return null;

  const roleSets = roles.map((r) => new Set(r.permissionKeys));
  const virtualRows = virtualizer.getVirtualItems();
  const topPad = virtualRows[0]?.start ?? 0;
  const bottomPad = virtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end ?? 0);

  return (
    <div ref={scrollRef} className="overflow-auto rounded-2xl border bg-card shadow-xs" style={{ maxHeight: MATRIX_VIEWPORT_HEIGHT }}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 border-b bg-[color-mix(in_oklch,var(--primary)_9%,var(--card))] text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="sticky left-0 bg-[color-mix(in_oklch,var(--primary)_9%,var(--card))] px-4 py-2.5 text-left font-medium">Permission</th>
            {roles.map((role) => (
              <th key={role.id} className="whitespace-nowrap px-3 py-2.5 text-center font-medium">
                {role.name}
                {!role.isSystem ? <span className="block text-[10px] normal-case text-muted-foreground">custom</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {topPad > 0 ? <tr aria-hidden style={{ height: topPad }} /> : null}
          {virtualRows.map((virtualRow) => {
            const permission = permissions[virtualRow.index]!;
            return (
              <tr key={permission.key} className="hover:bg-accent/40">
                <td className="sticky left-0 bg-card px-4 py-2 font-mono text-xs">{permission.key}</td>
                {roles.map((role, i) => (
                  <td key={role.id} className="px-3 py-2 text-center">
                    {roleSets[i]!.has(permission.key) ? (
                      <span className="mx-auto grid size-5 place-items-center rounded-full text-white" style={{ backgroundColor: accentVar(ROLE_DOT[i % ROLE_DOT.length]!), boxShadow: `0 0 0 4px ${tint(ROLE_DOT[i % ROLE_DOT.length]!, 18)}` }}>
                        <Check className="size-3" strokeWidth={3} aria-label={`${role.name} has ${permission.key}`} />
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40" aria-hidden>—</span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
          {bottomPad > 0 ? <tr aria-hidden style={{ height: bottomPad }} /> : null}
        </tbody>
      </table>
    </div>
  );
}
