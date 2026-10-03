'use client';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import * as React from 'react';
import Link from 'next/link';
import { IdCard, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useBranches, useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { MembershipPlanCard, type PlanCardAction } from '@/features/members/components/membership-plan-card';
import { MembershipsHero } from '@/features/members/components/memberships-hero';
import { MembershipsInsights, MembershipsKpis } from '@/features/members/components/memberships-overview';
import { MembershipsToolbar } from '@/features/members/components/memberships-toolbar';
import {
  toMemberError,
  useDuplicateMembershipPlan,
  useMembershipPlanList,
  useMembershipPlanStatusAction,
} from '@/features/members/hooks/use-members';
import type { ListMembershipPlansParams, MembershipPlan } from '@/features/members/types';
import { useCurrencySymbol } from '@/lib/currency';

type SortableColumn = NonNullable<ListMembershipPlansParams['sortBy']>;
type StatusAction = 'activate' | 'deactivate' | 'restore' | 'delete';

export default function MembershipPlansPage() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('memberships:create');
  const canUpdate = hasPermission('memberships:update');
  const canDelete = hasPermission('memberships:delete');
  const canRestore = hasPermission('memberships:restore');
  const { currentBranchId } = useCurrentBranch();
  const { data: branches } = useBranches();
  const currencySymbol = useCurrencySymbol();
  const branchNameById = React.useMemo(
    () => new Map((branches ?? []).map((b) => [b.id, b.name])),
    [branches],
  );

  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [isActiveFilter, setIsActiveFilter] = React.useState<'true' | 'false' | ''>('');
  const [page, setPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState<SortableColumn>('displayOrder');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [view, setView] = React.useState<'grid' | 'list'>('grid');
  const [confirmAction, setConfirmAction] = React.useState<{ action: StatusAction; plan: MembershipPlan } | null>(null);

  // Header branch switch re-scopes the whole list — back to page 1 like any other filter change.
  React.useEffect(() => {
    setPage(1);
  }, [currentBranchId]);

  const plans = useMembershipPlanList({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    isActive: isActiveFilter === '' ? undefined : isActiveFilter === 'true',
    branchId: currentBranchId ?? undefined,
    includeDeleted: true,
    sortBy,
    sortDir,
  });
  // Separate, unfiltered fetch (plans are few per tenant, so one generous-limit call
  // is enough) — feeds the hero/KPI tiles/insights so those always reflect every
  // plan, not whatever search/status filter the list below is under.
  const allPlans = useMembershipPlanList({ page: 1, limit: 100, includeDeleted: true });

  const statusAction = useMembershipPlanStatusAction();
  const duplicatePlan = useDuplicateMembershipPlan();

  const data = plans.data;
  const items = data?.items ?? [];
  const allItems = allPlans.data?.items ?? [];

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

  const handleCardAction = (plan: MembershipPlan, action: PlanCardAction) => {
    if (action === 'duplicate') {
      handleDuplicate(plan);
      return;
    }
    setConfirmAction({ action, plan });
  };

  return (
    <div className="w-full space-y-5">
      <MembershipsHero
        total={allPlans.data?.total ?? 0}
        plans={allItems}
        actions={
          canCreate ? (
            <Button size="sm" asChild data-solid className="border-0 bg-white text-indigo-700 shadow-lg hover:bg-white/90">
              <Link href="/memberships/new">
                <Plus className="size-4" /> New plan
              </Link>
            </Button>
          ) : null
        }
      />

      <MembershipsKpis
        plans={allItems}
        loading={allPlans.isPending}
        isActiveFilter={isActiveFilter}
        onStatus={(v) => {
          setIsActiveFilter(v);
          setPage(1);
        }}
      />

      <MembershipsInsights plans={allItems} loading={allPlans.isPending} />

      <MembershipsToolbar
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

      {plans.error ? (
        <EmptyState
          title="Couldn't load this data"
          description={plans.error instanceof Error ? plans.error.message : 'Something went wrong loading this data.'}
          className="border-destructive/30"
          action={
            <Button variant="outline" size="sm" onClick={() => plans.refetch()}>
              Retry
            </Button>
          }
        />
      ) : plans.isPending ? (
        <div className={view === 'grid' ? 'grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4' : 'space-y-3'}>
          {Array.from({ length: view === 'grid' ? 6 : 4 }).map((_, i) => (
            <Skeleton key={i} className={view === 'grid' ? 'h-[300px] w-full rounded-3xl' : 'h-20 w-full rounded-2xl'} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={IdCard} title={!search && !isActiveFilter ? 'Add your first membership plan to get started.' : 'No membership plans match these filters.'} />
      ) : (
        <div className={view === 'grid' ? 'grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4' : 'space-y-2.5'}>
          {items.map((p, i) => (
            <MembershipPlanCard
              key={p.id}
              plan={p}
              index={i}
              variant={view}
              currencySymbol={currencySymbol}
              branchNameById={branchNameById}
              canCreate={canCreate}
              canUpdate={canUpdate}
              canDelete={canDelete}
              canRestore={canRestore}
              onRequestAction={(action) => handleCardAction(p, action)}
            />
          ))}
        </div>
      )}

      {data ? <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} totalItems={data.total} pageSize={20} /> : null}

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
