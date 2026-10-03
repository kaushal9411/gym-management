'use client';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import * as React from 'react';
import Link from 'next/link';
import { CalendarDays, CalendarRange, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { ClassCard, type ClassCardAction } from '@/features/classes/components/class-card';
import { ClassesHero } from '@/features/classes/components/classes-hero';
import { ClassesInsights, ClassesKpis } from '@/features/classes/components/classes-overview';
import { ClassesToolbar } from '@/features/classes/components/classes-toolbar';
import { toClassError, useClassList, useClassStatusAction } from '@/features/classes/hooks/use-classes';
import type { GroupClass, ListGroupClassesParams } from '@/features/classes/types';

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
  const [view, setView] = React.useState<'grid' | 'list'>('grid');
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
  // Separate, unfiltered fetch (classes are few per tenant, so one generous-limit call is
  // enough) — feeds the hero/KPI tiles/insights so those always reflect every class, not
  // whatever search/status filter the list below is under.
  const allClasses = useClassList({ page: 1, limit: 100, includeDeleted: true });

  const statusAction = useClassStatusAction();

  const data = classes.data;
  const items = data?.items ?? [];
  const allItems = allClasses.data?.items ?? [];

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

  const handleCardAction = (groupClass: GroupClass, action: ClassCardAction) => {
    setConfirmAction({ action, groupClass });
  };

  return (
    <div className="w-full space-y-5">
      <ClassesHero
        total={allClasses.data?.total ?? 0}
        classes={allItems}
        actions={
          <>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/classes/calendar">
                <CalendarDays className="size-4" /> Calendar
              </Link>
            </Button>
            {canCreate ? (
              <Button size="sm" asChild data-solid className="border-0 bg-white text-indigo-700 shadow-lg hover:bg-white/90">
                <Link href="/classes/new">
                  <Plus className="size-4" /> New class
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <ClassesKpis
        classes={allItems}
        loading={allClasses.isPending}
        isActiveFilter={isActiveFilter}
        onStatus={(v) => {
          setIsActiveFilter(v);
          setPage(1);
        }}
      />

      <ClassesInsights classes={allItems} loading={allClasses.isPending} />

      <ClassesToolbar
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

      {classes.error ? (
        <EmptyState
          title="Couldn't load this data"
          description={classes.error instanceof Error ? classes.error.message : 'Something went wrong loading this data.'}
          className="border-destructive/30"
          action={
            <Button variant="outline" size="sm" onClick={() => classes.refetch()}>
              Retry
            </Button>
          }
        />
      ) : classes.isPending ? (
        <div className={view === 'grid' ? 'grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4' : 'space-y-3'}>
          {Array.from({ length: view === 'grid' ? 6 : 4 }).map((_, i) => (
            <Skeleton key={i} className={view === 'grid' ? 'h-[260px] w-full rounded-3xl' : 'h-20 w-full rounded-2xl'} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={CalendarRange} title={!search && !isActiveFilter ? 'Create your first class to get started.' : 'No classes match these filters.'} />
      ) : (
        <div className={view === 'grid' ? 'grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4' : 'space-y-2.5'}>
          {items.map((c, i) => (
            <ClassCard
              key={c.id}
              groupClass={c}
              index={i}
              variant={view}
              canDelete={canDelete}
              canRestore={canRestore}
              onRequestAction={(action) => handleCardAction(c, action)}
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
