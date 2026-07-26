'use client';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import * as React from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, Copy, Dumbbell, MoreHorizontal, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SearchBar } from '@/components/ui/search-bar';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { WorkoutLevelBadge } from '@/features/workouts/components/workout-badges';
import { toWorkoutError, useDuplicateWorkoutPlan, useWorkoutPlanList, useWorkoutPlanStatusAction } from '@/features/workouts/hooks/use-workouts';
import type { ListWorkoutPlansParams, WorkoutLevel, WorkoutPlanListItem } from '@/features/workouts/types';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
);

type SortableColumn = NonNullable<ListWorkoutPlansParams['sortBy']>;
type StatusAction = 'activate' | 'deactivate' | 'restore' | 'delete';

export default function WorkoutPlansPage() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('workouts:create');
  const canUpdate = hasPermission('workouts:update');
  const canDelete = hasPermission('workouts:delete');
  const canRestore = hasPermission('workouts:restore');

  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [levelFilter, setLevelFilter] = React.useState<WorkoutLevel | ''>('');
  const [isActiveFilter, setIsActiveFilter] = React.useState<'true' | 'false' | ''>('');
  const [page, setPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState<SortableColumn>('createdAt');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [confirmAction, setConfirmAction] = React.useState<{ action: StatusAction; plan: WorkoutPlanListItem } | null>(null);

  const plans = useWorkoutPlanList({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    level: levelFilter || undefined,
    isActive: isActiveFilter === '' ? undefined : isActiveFilter === 'true',
    includeDeleted: true,
    sortBy,
    sortDir,
  });
  const statusAction = useWorkoutPlanStatusAction();
  const duplicatePlan = useDuplicateWorkoutPlan();

  const data = plans.data;
  const items = data?.items ?? [];

  const toggleSort = (column: SortableColumn) => {
    if (sortBy === column) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(column);
      setSortDir('asc');
    }
  };
  const sortIcon = (column: SortableColumn) => {
    if (sortBy !== column) return <ArrowUpDown className="size-3.5 text-muted-foreground" />;
    return sortDir === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />;
  };
  const sortableHeader = (label: string, column: SortableColumn) => (
    <button type="button" className="flex items-center gap-1 font-medium hover:text-foreground" onClick={() => toggleSort(column)}>
      {label} {sortIcon(column)}
    </button>
  );

  const runStatusAction = () => {
    if (!confirmAction) return;
    statusAction.mutate(
      { id: confirmAction.plan.id, action: confirmAction.action },
      {
        onSuccess: () => toast.success(`Plan ${confirmAction.action}d.`),
        onError: (err) => toast.error(toWorkoutError(err).message),
      },
    );
    setConfirmAction(null);
  };

  const handleDuplicate = (plan: WorkoutPlanListItem) => {
    duplicatePlan.mutate(plan.id, {
      onSuccess: (created) => toast.success(`Duplicated as "${created.name}" (inactive draft).`),
      onError: (err) => toast.error(toWorkoutError(err).message),
    });
  };

  const columns: DataTableColumn<WorkoutPlanListItem>[] = [
    {
      key: 'name',
      header: sortableHeader('Plan', 'name'),
      render: (p) => (
        <Link href={`/workout-plans/${p.id}`} className="hover:underline">
          <span className="block font-medium">{p.name}</span>
          <span className="block text-xs text-muted-foreground">{p.goal ?? '—'}</span>
        </Link>
      ),
    },
    { key: 'level', header: 'Level', render: (p) => <WorkoutLevelBadge level={p.level} /> },
    { key: 'duration', header: sortableHeader('Duration', 'durationWeeks'), render: (p) => `${p.durationWeeks}w` },
    { key: 'trainer', header: 'Trainer', render: (p) => p.trainer?.name ?? '—' },
    { key: 'members', header: 'Active members', render: (p) => p.activeMemberCount },
    {
      key: 'status',
      header: 'Status',
      render: (p) =>
        p.deletedAt ? (
          <Badge variant="outline" className="border-dashed text-muted-foreground">Deleted</Badge>
        ) : (
          <Badge variant={p.isActive ? 'secondary' : 'outline'}>{p.isActive ? 'Active' : 'Inactive'}</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (p) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${p.name}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/workout-plans/${p.id}`}>View / edit</Link>
            </DropdownMenuItem>
            {canCreate ? (
              <DropdownMenuItem onClick={() => handleDuplicate(p)}>
                <Copy className="size-4" /> Duplicate
              </DropdownMenuItem>
            ) : null}
            {p.deletedAt ? (
              canRestore ? (
                <DropdownMenuItem onClick={() => setConfirmAction({ action: 'restore', plan: p })}>Restore</DropdownMenuItem>
              ) : null
            ) : canUpdate ? (
              p.isActive ? (
                <DropdownMenuItem onClick={() => setConfirmAction({ action: 'deactivate', plan: p })}>Deactivate</DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setConfirmAction({ action: 'activate', plan: p })}>Activate</DropdownMenuItem>
              )
            ) : null}
            {!p.deletedAt && canDelete ? (
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmAction({ action: 'delete', plan: p })}>
                Delete
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workout Plans</h1>
          <p className="text-muted-foreground">Plans, exercises, trainer assignments, and member progress.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/workout-plans/exercises">
              <Dumbbell className="size-4" /> Exercise library
            </Link>
          </Button>
          {canCreate ? (
            <Button size="sm" asChild>
              <Link href="/workout-plans/new">
                <Plus className="size-4" /> New plan
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar
          containerClassName="max-w-xs"
          placeholder="Search name, goal, description…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={selectClassName}
          value={levelFilter}
          onChange={(e) => {
            setLevelFilter(e.target.value as WorkoutLevel | '');
            setPage(1);
          }}
          aria-label="Filter by level"
        >
          <option value="">All levels</option>
          <option value="BEGINNER">Beginner</option>
          <option value="INTERMEDIATE">Intermediate</option>
          <option value="ADVANCED">Advanced</option>
        </select>
        <select
          className={selectClassName}
          value={isActiveFilter}
          onChange={(e) => {
            setIsActiveFilter(e.target.value as 'true' | 'false' | '');
            setPage(1);
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      <DataTable columns={columns} rows={items} rowKey={(p) => p.id} loading={plans.isPending} error={plans.error} onRetry={() => plans.refetch()} emptyMessage="No workout plans match these filters." />

      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.page} of {data.totalPages} · {data.total} plans
          </span>
          <span className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </span>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction ? `${confirmAction.action[0]!.toUpperCase()}${confirmAction.action.slice(1)} "${confirmAction.plan.name}"?` : ''}
        description={
          confirmAction?.action === 'delete'
            ? 'This soft-deletes the plan — it can no longer be assigned to members until restored.'
            : 'This action can be reversed later if needed.'
        }
        destructive={confirmAction?.action === 'delete'}
        loading={statusAction.isPending}
        onConfirm={runStatusAction}
      />
    </div>
  );
}
