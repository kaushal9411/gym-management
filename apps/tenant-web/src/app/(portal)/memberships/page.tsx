'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, Copy, MoreHorizontal, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SearchBar } from '@/components/ui/search-bar';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import {
  toMemberError,
  useDuplicateMembershipPlan,
  useMembershipPlanList,
  useMembershipPlanStatusAction,
} from '@/features/members/hooks/use-members';
import type { ListMembershipPlansParams, MembershipPlan } from '@/features/members/types';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
);

type SortableColumn = NonNullable<ListMembershipPlansParams['sortBy']>;
type StatusAction = 'activate' | 'deactivate' | 'restore' | 'delete';

export default function MembershipPlansPage() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('memberships:create');
  const canUpdate = hasPermission('memberships:update');
  const canDelete = hasPermission('memberships:delete');
  const canRestore = hasPermission('memberships:restore');

  const [search, setSearch] = React.useState('');
  const [isActiveFilter, setIsActiveFilter] = React.useState<'true' | 'false' | ''>('');
  const [page, setPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState<SortableColumn>('displayOrder');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [confirmAction, setConfirmAction] = React.useState<{ action: StatusAction; plan: MembershipPlan } | null>(null);

  const plans = useMembershipPlanList({
    page,
    limit: 20,
    search: search || undefined,
    isActive: isActiveFilter === '' ? undefined : isActiveFilter === 'true',
    includeDeleted: true,
    sortBy,
    sortDir,
  });
  const statusAction = useMembershipPlanStatusAction();
  const duplicatePlan = useDuplicateMembershipPlan();

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
      { planId: confirmAction.plan.id, action: confirmAction.action },
      {
        onSuccess: () => toast.success(`Plan ${confirmAction.action}d.`),
        onError: (err) => toast.error(toMemberError(err).message),
      },
    );
    setConfirmAction(null);
  };

  const handleDuplicate = (plan: MembershipPlan) => {
    duplicatePlan.mutate(plan.id, {
      onSuccess: (created) => toast.success(`Duplicated as "${created.name}" (inactive draft).`),
      onError: (err) => toast.error(toMemberError(err).message),
    });
  };

  const columns: DataTableColumn<MembershipPlan>[] = [
    {
      key: 'name',
      header: sortableHeader('Plan', 'name'),
      render: (p) => (
        <Link href={`/memberships/${p.id}`} className="hover:underline">
          <span className="block font-medium">{p.name}</span>
          <span className="block text-xs text-muted-foreground">{p.category ?? '—'}</span>
        </Link>
      ),
    },
    { key: 'planCode', header: sortableHeader('Plan Code', 'planCode'), render: (p) => p.planCode },
    { key: 'duration', header: 'Duration', render: (p) => `${p.durationValue} ${p.durationType.toLowerCase()}` },
    { key: 'price', header: sortableHeader('Price', 'price'), render: (p) => `$${p.price}` },
    { key: 'members', header: 'Members', render: (p) => p.memberCount },
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
              <Link href={`/memberships/${p.id}`}>View / edit</Link>
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
          <h1 className="text-2xl font-semibold tracking-tight">Membership Plans</h1>
          <p className="text-muted-foreground">The plan catalog members are assigned to (e.g. &quot;3-Month Cardio&quot;, &quot;Annual Gold&quot;).</p>
        </div>
        {canCreate ? (
          <Button size="sm" asChild>
            <Link href="/memberships/new">
              <Plus className="size-4" /> New plan
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBar
          containerClassName="max-w-xs"
          placeholder="Search name, plan code, description…"
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

      <DataTable columns={columns} rows={items} rowKey={(p) => p.id} loading={plans.isPending} emptyMessage="No membership plans match these filters." />

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
