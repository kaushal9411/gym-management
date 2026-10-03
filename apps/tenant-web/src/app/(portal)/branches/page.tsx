'use client';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import * as React from 'react';
import Link from 'next/link';
import { Building2, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { BranchCard, type BranchCardAction } from '@/features/branch/components/branch-card';
import { BranchesHero } from '@/features/branch/components/branches-hero';
import { BranchesInsights, BranchesKpis } from '@/features/branch/components/branches-overview';
import { BranchesToolbar } from '@/features/branch/components/branches-toolbar';
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
  const [view, setView] = React.useState<'grid' | 'list'>('grid');
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
  // Separate, unfiltered fetch (branches are few per tenant, so one generous-limit
  // call is enough) — feeds the hero/KPI tiles/insights so those always reflect
  // every branch, not whatever search/status filter the list below is under.
  const allBranches = useBranchList({ page: 1, limit: 100, includeDeleted: true });

  const activateBranch = useActivateBranch();
  const deactivateBranch = useDeactivateBranch();
  const deleteBranch = useDeleteBranch();
  const restoreBranch = useRestoreBranch();
  const setDefaultBranch = useSetDefaultBranch();

  const data = branches.data;
  const items = data?.items ?? [];
  const allItems = allBranches.data?.items ?? [];

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

  return (
    <div className="w-full space-y-5">
      <BranchesHero
        total={allBranches.data?.total ?? 0}
        branches={allItems}
        actions={
          canCreate ? (
            <Button size="sm" asChild data-solid className="border-0 bg-white text-indigo-700 shadow-lg hover:bg-white/90">
              <Link href="/branches/new">
                <Plus className="size-4" /> New branch
              </Link>
            </Button>
          ) : null
        }
      />

      <BranchesKpis
        branches={allItems}
        loading={allBranches.isPending}
        isActiveFilter={isActiveFilter}
        onStatus={(v) => {
          setIsActiveFilter(v);
          setPage(1);
        }}
      />

      <BranchesInsights branches={allItems} loading={allBranches.isPending} />

      <BranchesToolbar
        search={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        status={isActiveFilter}
        onStatus={(v) => {
          setIsActiveFilter(v);
          setPage(1);
        }}
        sort={`${sortBy}:${sortDir}`}
        onSort={(v) => {
          const [by, dir] = v.split(':') as [SortableColumn, 'asc' | 'desc'];
          setSortBy(by);
          setSortDir(dir);
        }}
        view={view}
        onView={setView}
      />

      {branches.error ? (
        <EmptyState
          title="Couldn't load this data"
          description={branches.error instanceof Error ? branches.error.message : 'Something went wrong loading this data.'}
          className="border-destructive/30"
          action={
            <Button variant="outline" size="sm" onClick={() => branches.refetch()}>
              Retry
            </Button>
          }
        />
      ) : branches.isPending ? (
        <div className={view === 'grid' ? 'grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4' : 'space-y-3'}>
          {Array.from({ length: view === 'grid' ? 6 : 4 }).map((_, i) => (
            <Skeleton key={i} className={view === 'grid' ? 'h-[300px] w-full rounded-3xl' : 'h-20 w-full rounded-2xl'} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Building2} title={!search && !isActiveFilter ? 'Add your first branch to get started.' : 'No branches match these filters.'} />
      ) : (
        <div className={view === 'grid' ? 'grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4' : 'space-y-2.5'}>
          {items.map((b, i) => (
            <BranchCard
              key={b.id}
              branch={b}
              index={i}
              variant={view}
              canUpdate={canUpdate}
              canActivate={canActivate}
              canDelete={canDelete}
              canRestore={canRestore}
              onRequestAction={(action) => setConfirmAction({ action, branch: b })}
            />
          ))}
        </div>
      )}

      {data ? <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} totalItems={data.total} pageSize={20} /> : null}

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
