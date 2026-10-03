'use client';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import * as React from 'react';
import Link from 'next/link';
import { Dumbbell, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { WorkoutPlanCard, type WorkoutPlanCardAction } from '@/features/workouts/components/workout-plan-card';
import { WorkoutPlansHero } from '@/features/workouts/components/workout-plans-hero';
import { WorkoutPlansInsights, WorkoutPlansKpis } from '@/features/workouts/components/workout-plans-overview';
import { WorkoutPlansToolbar } from '@/features/workouts/components/workout-plans-toolbar';
import { toWorkoutError, useDuplicateWorkoutPlan, useWorkoutPlanList, useWorkoutPlanStatusAction } from '@/features/workouts/hooks/use-workouts';
import type { ListWorkoutPlansParams, WorkoutLevel, WorkoutPlanListItem } from '@/features/workouts/types';

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
  const [view, setView] = React.useState<'grid' | 'list'>('grid');
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
  // Separate, unfiltered fetch (plans are few per tenant, so one generous-limit call is
  // enough) — feeds the hero/KPI tiles/insights so those always reflect every plan, not
  // whatever search/status/level filter the list below is under.
  const allPlans = useWorkoutPlanList({ page: 1, limit: 100, includeDeleted: true });

  const statusAction = useWorkoutPlanStatusAction();
  const duplicatePlan = useDuplicateWorkoutPlan();

  const data = plans.data;
  const items = data?.items ?? [];
  const allItems = allPlans.data?.items ?? [];

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

  const handleCardAction = (plan: WorkoutPlanListItem, action: WorkoutPlanCardAction) => {
    if (action === 'duplicate') {
      handleDuplicate(plan);
      return;
    }
    setConfirmAction({ action, plan });
  };

  return (
    <div className="w-full space-y-5">
      <WorkoutPlansHero
        total={allPlans.data?.total ?? 0}
        plans={allItems}
        actions={
          <>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/workout-plans/exercises">
                <Dumbbell className="size-4" /> Exercise library
              </Link>
            </Button>
            {canCreate ? (
              <Button size="sm" asChild data-solid className="border-0 bg-white text-indigo-700 shadow-lg hover:bg-white/90">
                <Link href="/workout-plans/new">
                  <Plus className="size-4" /> New plan
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <WorkoutPlansKpis
        plans={allItems}
        loading={allPlans.isPending}
        isActiveFilter={isActiveFilter}
        onStatus={(v) => {
          setIsActiveFilter(v);
          setPage(1);
        }}
      />

      <WorkoutPlansInsights plans={allItems} loading={allPlans.isPending} />

      <WorkoutPlansToolbar
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
        level={levelFilter}
        onLevel={(v) => {
          setLevelFilter(v);
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
        <EmptyState icon={Dumbbell} title={!search && !isActiveFilter && !levelFilter ? 'Create your first workout plan to get started.' : 'No workout plans match these filters.'} />
      ) : (
        <div className={view === 'grid' ? 'grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4' : 'space-y-2.5'}>
          {items.map((p, i) => (
            <WorkoutPlanCard
              key={p.id}
              plan={p}
              index={i}
              variant={view}
              canCreate={canCreate}
              canUpdate={canUpdate}
              canDelete={canDelete}
              canRestore={canRestore}
              onRequestAction={(action) => handleCardAction(p, action)}
            />
          ))}
        </div>
      )}

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
