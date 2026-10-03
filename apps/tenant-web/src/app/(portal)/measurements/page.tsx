'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus, Ruler } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { MeasuredMemberCard } from '@/features/measurements/components/measured-member-card';
import { MeasurementsHero } from '@/features/measurements/components/measurements-hero';
import { MeasurementsInsights, MeasurementsKpis } from '@/features/measurements/components/measurements-overview';
import { MeasurementsToolbar } from '@/features/measurements/components/measurements-toolbar';
import { useMeasuredMembers } from '@/features/measurements/hooks/use-measurements';

/**
 * Entry point into the per-member body-measurement history. Deliberately
 * NOT the full member roster — this lists only members who already have at
 * least one measurement recorded (`GET /measurements/members`, distinct
 * from the full `useMemberList`), each card showing their latest reading and
 * total entry count, and links to `/measurements/[memberId]` — a focused
 * page showing just that member's measurement history (name/avatar for
 * context + the same `MemberMeasurementsCard` the full Member Detail page
 * also embeds), NOT the full member profile. The "Record measurement"
 * button (`/measurements/new`) is the entry point for a member who has none
 * yet — a create-and-assign-in-one-step flow (combines what Workout/Diet
 * Plans split across "Create" + "Assign to member", since a measurement has
 * no separate template to build first).
 */
export default function MeasurementsPage() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('measurements:create');
  const { currentBranchId } = useCurrentBranch();
  const [search, setSearch] = React.useState('');
  const [view, setView] = React.useState<'grid' | 'list'>('grid');

  const measuredMembers = useMeasuredMembers();

  const allRows = measuredMembers.data ?? [];
  const branchFiltered = currentBranchId ? allRows.filter((r) => r.member.branch.id === currentBranchId) : allRows;
  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return branchFiltered;
    return branchFiltered.filter((r) => r.member.name.toLowerCase().includes(q) || r.member.memberId.toLowerCase().includes(q));
  }, [branchFiltered, search]);

  return (
    <div className="w-full space-y-5">
      <MeasurementsHero
        total={branchFiltered.length}
        members={branchFiltered}
        actions={
          canCreate ? (
            <Button size="sm" asChild data-solid className="border-0 bg-white text-indigo-700 shadow-lg hover:bg-white/90">
              <Link href="/measurements/new">
                <Plus className="size-4" /> Record measurement
              </Link>
            </Button>
          ) : null
        }
      />

      {measuredMembers.error ? (
        <EmptyState
          title="Couldn't load this data"
          description={measuredMembers.error instanceof Error ? measuredMembers.error.message : 'Something went wrong loading this data.'}
          className="border-destructive/30"
          action={
            <Button variant="outline" size="sm" onClick={() => measuredMembers.refetch()}>
              Retry
            </Button>
          }
        />
      ) : !measuredMembers.isPending && branchFiltered.length === 0 ? (
        <EmptyState
          icon={Ruler}
          title="No measurements recorded yet"
          description={canCreate ? "Record a member's first measurement to see it here." : "A trainer, manager, or owner hasn't logged any yet."}
          action={
            canCreate ? (
              <Button size="sm" asChild>
                <Link href="/measurements/new">
                  <Plus className="size-4" /> Record measurement
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <MeasurementsKpis members={branchFiltered} loading={measuredMembers.isPending} />

          <MeasurementsInsights members={branchFiltered} loading={measuredMembers.isPending} />

          <MeasurementsToolbar search={search} onSearch={setSearch} view={view} onView={setView} />

          {measuredMembers.isPending ? (
            <div className={view === 'grid' ? 'grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4' : 'space-y-3'}>
              {Array.from({ length: view === 'grid' ? 6 : 4 }).map((_, i) => (
                <Skeleton key={i} className={view === 'grid' ? 'h-[280px] w-full rounded-3xl' : 'h-20 w-full rounded-2xl'} />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon={Ruler} title="No members match this search." />
          ) : (
            <div className={view === 'grid' ? 'grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4' : 'space-y-2.5'}>
              {rows.map((r, i) => (
                <MeasuredMemberCard key={r.member.id} row={r} index={i} variant={view} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
