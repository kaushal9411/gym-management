'use client';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import * as React from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, CalendarRange, MoreHorizontal, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Pagination } from '@/components/ui/pagination';
import { SearchBar } from '@/components/ui/search-bar';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { toClassError, useClassList, useClassStatusAction } from '@/features/classes/hooks/use-classes';
import type { GroupClass, ListGroupClassesParams } from '@/features/classes/types';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-9 rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs transition-all duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring',
);

type SortableColumn = NonNullable<ListGroupClassesParams['sortBy']>;
type StatusAction = 'delete' | 'restore';

export default function ClassesPage() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('classes:create');
  const canDelete = hasPermission('classes:delete');
  const canRestore = hasPermission('classes:restore');

  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [isActiveFilter, setIsActiveFilter] = React.useState<'true' | 'false' | ''>('');
  const [page, setPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState<SortableColumn>('name');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [confirmAction, setConfirmAction] = React.useState<{ action: StatusAction; groupClass: GroupClass } | null>(null);

  const classes = useClassList({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    isActive: isActiveFilter === '' ? undefined : isActiveFilter === 'true',
    includeDeleted: true,
    sortBy,
    sortDir,
  });
  const statusAction = useClassStatusAction();

  const data = classes.data;
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
      { id: confirmAction.groupClass.id, action: confirmAction.action },
      {
        onSuccess: () => toast.success(`Class ${confirmAction.action === 'delete' ? 'deleted' : 'restored'}.`),
        onError: (err) => toast.error(toClassError(err).message),
      },
    );
    setConfirmAction(null);
  };

  const columns: DataTableColumn<GroupClass>[] = [
    {
      key: 'name',
      header: sortableHeader('Class', 'name'),
      render: (c) => (
        <Link href={`/classes/${c.id}`} className="hover:underline">
          <span className="block font-medium">{c.name}</span>
          <span className="block text-xs text-muted-foreground">{c.branch.name}</span>
        </Link>
      ),
    },
    { key: 'trainer', header: 'Trainer', render: (c) => c.trainer?.name ?? '—' },
    { key: 'capacity', header: 'Capacity', render: (c) => c.capacity },
    { key: 'duration', header: 'Duration', render: (c) => `${c.durationMinutes}m` },
    { key: 'schedule', header: 'Weekly slots', render: (c) => (c.schedule.length > 0 ? `${c.schedule.length} slot(s)` : 'Not scheduled') },
    {
      key: 'status',
      header: 'Status',
      render: (c) =>
        c.deletedAt ? (
          <Badge variant="outline" className="border-dashed text-muted-foreground">Deleted</Badge>
        ) : (
          <Badge variant={c.isActive ? 'secondary' : 'outline'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (c) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${c.name}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/classes/${c.id}`}>View / edit</Link>
            </DropdownMenuItem>
            {c.deletedAt ? (
              canRestore ? (
                <DropdownMenuItem onClick={() => setConfirmAction({ action: 'restore', groupClass: c })}>Restore</DropdownMenuItem>
              ) : null
            ) : canDelete ? (
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmAction({ action: 'delete', groupClass: c })}>
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
              backgroundColor: 'color-mix(in oklch, var(--chart-3) 16%, transparent)',
              color: 'var(--chart-3)',
              boxShadow: '0 0 0 1px color-mix(in oklch, var(--chart-3) 18%, transparent)',
            }}
          >
            <CalendarRange className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Classes</h1>
            <p className="text-muted-foreground">Recurring group classes, weekly schedules, and session capacity.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/classes/calendar">
              <CalendarDays className="size-4" /> Calendar
            </Link>
          </Button>
          {canCreate ? (
            <Button size="sm" asChild>
              <Link href="/classes/new">
                <Plus className="size-4" /> New class
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar
          containerClassName="max-w-xs"
          placeholder="Search class name…"
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

      <DataTable columns={columns} rows={items} rowKey={(c) => c.id} loading={classes.isPending} error={classes.error} onRetry={() => classes.refetch()} emptyMessage="No classes match these filters." />

      {data ? (
        <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} totalItems={data.total} pageSize={20} />
      ) : null}

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction ? `${confirmAction.action === 'delete' ? 'Delete' : 'Restore'} "${confirmAction.groupClass.name}"?` : ''}
        description={
          confirmAction?.action === 'delete'
            ? 'This soft-deletes the class and excludes it from future session generation — existing sessions are unaffected.'
            : 'This makes the class assignable and schedulable again.'
        }
        destructive={confirmAction?.action === 'delete'}
        loading={statusAction.isPending}
        onConfirm={runStatusAction}
      />
    </div>
  );
}
