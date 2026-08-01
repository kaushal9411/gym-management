'use client';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import * as React from 'react';
import Link from 'next/link';
import { Apple, ArrowDown, ArrowUp, ArrowUpDown, Copy, MoreHorizontal, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Pagination } from '@/components/ui/pagination';
import { SearchBar } from '@/components/ui/search-bar';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { toDietError, useDietPlanList, useDietPlanStatusAction, useDuplicateDietPlan } from '@/features/diet/hooks/use-diet';
import type { DietPlanListItem, ListDietPlansParams } from '@/features/diet/types';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-9 rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs transition-all duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring',
);

type SortableColumn = NonNullable<ListDietPlansParams['sortBy']>;
type StatusAction = 'activate' | 'deactivate' | 'restore' | 'delete';

export default function DietPlansPage() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('diets:create');
  const canUpdate = hasPermission('diets:update');
  const canDelete = hasPermission('diets:delete');
  const canRestore = hasPermission('diets:restore');

  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [isActiveFilter, setIsActiveFilter] = React.useState<'true' | 'false' | ''>('');
  const [page, setPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState<SortableColumn>('createdAt');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [confirmAction, setConfirmAction] = React.useState<{ action: StatusAction; plan: DietPlanListItem } | null>(null);

  const plans = useDietPlanList({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    isActive: isActiveFilter === '' ? undefined : isActiveFilter === 'true',
    includeDeleted: true,
    sortBy,
    sortDir,
  });
  const statusAction = useDietPlanStatusAction();
  const duplicatePlan = useDuplicateDietPlan();

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
        onError: (err) => toast.error(toDietError(err).message),
      },
    );
    setConfirmAction(null);
  };

  const handleDuplicate = (plan: DietPlanListItem) => {
    duplicatePlan.mutate(plan.id, {
      onSuccess: (created) => toast.success(`Duplicated as "${created.name}" (inactive draft).`),
      onError: (err) => toast.error(toDietError(err).message),
    });
  };

  const columns: DataTableColumn<DietPlanListItem>[] = [
    {
      key: 'name',
      header: sortableHeader('Plan', 'name'),
      render: (p) => (
        <Link href={`/diet-plans/${p.id}`} className="hover:underline">
          <span className="block font-medium">{p.name}</span>
          <span className="block text-xs text-muted-foreground">{p.goal ?? '—'}</span>
        </Link>
      ),
    },
    { key: 'calories', header: 'Daily calories', render: (p) => (p.dailyCalories ? `${p.dailyCalories} kcal` : '—') },
    { key: 'duration', header: sortableHeader('Duration', 'durationDays'), render: (p) => `${p.durationDays}d` },
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
              <Link href={`/diet-plans/${p.id}`}>View / edit</Link>
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
        <div className="flex items-center gap-3.5">
          <div
            className="hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex"
            style={{
              backgroundColor: 'color-mix(in oklch, var(--success) 16%, transparent)',
              color: 'var(--success)',
              boxShadow: '0 0 0 1px color-mix(in oklch, var(--success) 18%, transparent)',
            }}
          >
            <Apple className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Diet Plans</h1>
            <p className="text-muted-foreground">Meal plans, nutrition templates, and member diet assignments.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/diet-plans/foods">
              <Apple className="size-4" /> Food library
            </Link>
          </Button>
          {canCreate ? (
            <Button size="sm" asChild>
              <Link href="/diet-plans/new">
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

      <DataTable columns={columns} rows={items} rowKey={(p) => p.id} loading={plans.isPending} error={plans.error} onRetry={() => plans.refetch()} emptyMessage="No diet plans match these filters." />

      {data ? (
        <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} totalItems={data.total} pageSize={20} />
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
