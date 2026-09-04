'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus, Ruler } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchBar } from '@/components/ui/search-bar';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { useMeasuredMembers } from '@/features/measurements/hooks/use-measurements';
import type { MeasuredMember } from '@/features/measurements/types';
import { summarizeMeasurement } from '@/features/measurements/utils';

/**
 * Entry point into the per-member body-measurement history. Deliberately
 * NOT the full member roster — this lists only members who already have at
 * least one measurement recorded (`GET /measurements/members`, distinct
 * from the full `useMemberList`), each row showing their latest reading and
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

  const measuredMembers = useMeasuredMembers();

  const rows = React.useMemo(() => {
    const all = measuredMembers.data ?? [];
    const branchFiltered = currentBranchId ? all.filter((r) => r.member.branch.id === currentBranchId) : all;
    const q = search.trim().toLowerCase();
    if (!q) return branchFiltered;
    return branchFiltered.filter((r) => r.member.name.toLowerCase().includes(q) || r.member.memberId.toLowerCase().includes(q));
  }, [measuredMembers.data, currentBranchId, search]);

  const columns: DataTableColumn<MeasuredMember>[] = [
    {
      key: 'member',
      header: 'Member',
      render: (r) => (
        <Link href={`/measurements/${r.member.id}`} className="flex items-center gap-2.5 hover:underline">
          <Avatar className="size-8">
            {r.member.profilePhotoUrl ? <AvatarImage src={r.member.profilePhotoUrl} alt="" /> : null}
            <AvatarFallback className="text-xs">
              {r.member.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span>
            <span className="block font-medium">{r.member.name}</span>
            <span className="block text-xs text-muted-foreground">{r.member.memberId || '—'}</span>
          </span>
        </Link>
      ),
    },
    { key: 'branch', header: 'Branch', render: (r) => r.member.branch.name },
    { key: 'trainer', header: 'Trainer', render: (r) => r.member.trainer?.name ?? '—' },
    {
      key: 'latest',
      header: 'Latest reading',
      render: (r) => (
        <span>
          <span className="block text-sm">{summarizeMeasurement(r.latest)}</span>
          <span className="block text-xs text-muted-foreground">{new Date(r.latest.recordedAt).toLocaleDateString()}</span>
        </span>
      ),
    },
    { key: 'count', header: 'Entries', render: (r) => <Badge variant="secondary">{r.count}</Badge> },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (r) => (
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/measurements/${r.member.id}`}>View / edit</Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div
            className="hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex"
            style={{
              backgroundColor: 'color-mix(in oklch, var(--primary) 16%, transparent)',
              color: 'var(--primary)',
              boxShadow: '0 0 0 1px color-mix(in oklch, var(--primary) 18%, transparent)',
            }}
          >
            <Ruler className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Body Measurements</h1>
            <p className="text-muted-foreground">Members with a recorded measurement history.</p>
          </div>
        </div>
        {canCreate ? (
          <Button size="sm" asChild>
            <Link href="/measurements/new">
              <Plus className="size-4" /> Record measurement
            </Link>
          </Button>
        ) : null}
      </div>

      {!measuredMembers.isPending && (measuredMembers.data?.length ?? 0) === 0 ? (
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
          <SearchBar
            containerClassName="max-w-xs"
            placeholder="Search name or member ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.member.id}
            loading={measuredMembers.isPending}
            error={measuredMembers.error}
            onRetry={() => measuredMembers.refetch()}
            emptyMessage="No members match this search."
          />
        </>
      )}
    </div>
  );
}
