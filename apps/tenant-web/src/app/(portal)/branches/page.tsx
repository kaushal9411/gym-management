'use client';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import * as React from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal, Plus, Star } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SearchBar } from '@/components/ui/search-bar';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { BranchDefaultBadge, BranchStatusBadge } from '@/features/branch/components/branch-badges';
import {
  toBranchError,
  useActivateBranch,
  useBranchList,
  useDeactivateBranch,
  useDeleteBranch,
  useRestoreBranch,
  useSetDefaultBranch,
} from '@/features/branch/hooks/use-branches';
import type { BranchDetail, ListBranchesParams } from '@/features/branch/types';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
);

type SortableColumn = NonNullable<ListBranchesParams['sortBy']>;
type StatusAction = 'activate' | 'deactivate' | 'restore' | 'delete' | 'set-default';

export default function BranchesPage() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('branches:create');
  const canUpdate = hasPermission('branches:update');
  const canDelete = hasPermission('branches:delete');
  const canRestore = hasPermission('branches:restore');
  const canActivate = hasPermission('branches:activate');

  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [isActiveFilter, setIsActiveFilter] = React.useState<'true' | 'false' | ''>('');
  const [page, setPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState<SortableColumn>('name');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [confirmAction, setConfirmAction] = React.useState<{ action: StatusAction; branch: BranchDetail } | null>(null);

  const branches = useBranchList({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    isActive: isActiveFilter === '' ? undefined : isActiveFilter === 'true',
    includeDeleted: true,
    sortBy,
    sortDir,
  });
  const activateBranch = useActivateBranch();
  const deactivateBranch = useDeactivateBranch();
  const deleteBranch = useDeleteBranch();
  const restoreBranch = useRestoreBranch();
  const setDefaultBranch = useSetDefaultBranch();

  const data = branches.data;
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

  const runAction = () => {
    if (!confirmAction) return;
    const { action, branch } = confirmAction;
    const mutation =
      action === 'activate'
        ? activateBranch
        : action === 'deactivate'
          ? deactivateBranch
          : action === 'restore'
            ? restoreBranch
            : action === 'set-default'
              ? setDefaultBranch
              : deleteBranch;
    mutation.mutate(branch.id, {
      onSuccess: () => toast.success(action === 'set-default' ? 'Default branch updated.' : `Branch ${action}d.`),
      onError: (err) => toast.error(toBranchError(err).message),
    });
    setConfirmAction(null);
  };

  const columns: DataTableColumn<BranchDetail>[] = [
    {
      key: 'name',
      header: sortableHeader('Branch', 'name'),
      render: (b) => (
        <Link href={`/branches/${b.id}`} className="hover:underline">
          <span className="flex items-center gap-1.5 font-medium">
            {b.name} <BranchDefaultBadge isDefault={b.isDefault} />
          </span>
          <span className="block text-xs text-muted-foreground">{b.city ?? '—'}</span>
        </Link>
      ),
    },
    { key: 'branchCode', header: sortableHeader('Branch Code', 'branchCode'), render: (b) => b.branchCode },
    { key: 'phone', header: 'Phone', render: (b) => b.phone ?? '—' },
    { key: 'members', header: 'Members', render: (b) => b.memberCount },
    { key: 'staff', header: 'Staff', render: (b) => b.staffCount },
    {
      key: 'status',
      header: 'Status',
      render: (b) => (b.deletedAt ? <span className="text-xs text-muted-foreground">Deleted</span> : <BranchStatusBadge isActive={b.isActive} />),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (b) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${b.name}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/branches/${b.id}`}>View / edit</Link>
            </DropdownMenuItem>
            {b.deletedAt ? (
              canRestore ? <DropdownMenuItem onClick={() => setConfirmAction({ action: 'restore', branch: b })}>Restore</DropdownMenuItem> : null
            ) : (
              <>
                {canUpdate && !b.isDefault && b.isActive ? (
                  <DropdownMenuItem onClick={() => setConfirmAction({ action: 'set-default', branch: b })}>
                    <Star className="size-4" /> Set as default
                  </DropdownMenuItem>
                ) : null}
                {canActivate ? (
                  b.isActive ? (
                    <DropdownMenuItem onClick={() => setConfirmAction({ action: 'deactivate', branch: b })}>Deactivate</DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => setConfirmAction({ action: 'activate', branch: b })}>Activate</DropdownMenuItem>
                  )
                ) : null}
                {canDelete ? (
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmAction({ action: 'delete', branch: b })}>
                    Delete
                  </DropdownMenuItem>
                ) : null}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Branches</h1>
          <p className="text-muted-foreground">Manage every location your gym operates from.</p>
        </div>
        {canCreate ? (
          <Button size="sm" asChild>
            <Link href="/branches/new">
              <Plus className="size-4" /> New branch
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar
          containerClassName="max-w-xs"
          placeholder="Search name, code, city, email…"
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

      <DataTable columns={columns} rows={items} rowKey={(b) => b.id} loading={branches.isPending} error={branches.error} onRetry={() => branches.refetch()} emptyMessage="No branches match these filters." />

      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.page} of {data.totalPages} · {data.total} branches
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
        title={
          confirmAction
            ? confirmAction.action === 'set-default'
              ? `Set "${confirmAction.branch.name}" as the default branch?`
              : `${confirmAction.action[0]!.toUpperCase()}${confirmAction.action.slice(1)} "${confirmAction.branch.name}"?`
            : ''
        }
        description={
          confirmAction?.action === 'delete'
            ? "This soft-deletes the branch — it can be restored later. The default branch and a tenant's last active branch can't be deleted."
            : confirmAction?.action === 'deactivate'
              ? "The default branch and a tenant's last active branch can't be deactivated."
              : 'This action can be reversed later if needed.'
        }
        destructive={confirmAction?.action === 'delete'}
        loading={activateBranch.isPending || deactivateBranch.isPending || deleteBranch.isPending || restoreBranch.isPending || setDefaultBranch.isPending}
        onConfirm={runAction}
      />
    </div>
  );
}
