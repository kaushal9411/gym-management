'use client';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import * as React from 'react';
import Link from 'next/link';
import { Apple, ArrowLeft, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { DEFAULT_FOOD_FORM_STATE, FoodFormFields, type FoodFormState } from '@/features/diet/components/food-form-fields';
import { FoodCard, type FoodCardAction } from '@/features/diet/components/food-card';
import { FoodsHero } from '@/features/diet/components/foods-hero';
import { FoodsInsights, FoodsKpis } from '@/features/diet/components/foods-overview';
import { FoodsToolbar } from '@/features/diet/components/foods-toolbar';
import { toDietError, useCreateFood, useFoodList, useFoodStatusAction, useUpdateFood } from '@/features/diet/hooks/use-diet';
import type { Food, ListFoodsParams } from '@/features/diet/types';

type SortableColumn = NonNullable<ListFoodsParams['sortBy']>;

function toFormState(food: Food): FoodFormState {
  return {
    name: food.name,
    category: food.category ?? '',
    servingSize: food.servingSize ?? '',
    calories: food.calories === null ? '' : String(food.calories),
    protein: food.protein ?? '',
    carbohydrates: food.carbohydrates ?? '',
    fat: food.fat ?? '',
    fiber: food.fiber ?? '',
    sugar: food.sugar ?? '',
    sodium: food.sodium ?? '',
    notes: food.notes ?? '',
    isActive: food.isActive,
  };
}

function toNumberOrUndefined(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

export default function FoodLibraryPage() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('diets:create');
  const canUpdate = hasPermission('diets:update');
  const canDelete = hasPermission('diets:delete');
  const canRestore = hasPermission('diets:restore');

  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [isActiveFilter, setIsActiveFilter] = React.useState<'true' | 'false' | ''>('');
  const [page, setPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState<SortableColumn>('name');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [view, setView] = React.useState<'grid' | 'list'>('grid');
  const [editing, setEditing] = React.useState<Food | 'new' | null>(null);
  const [form, setForm] = React.useState<FoodFormState>(DEFAULT_FOOD_FORM_STATE);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [confirmAction, setConfirmAction] = React.useState<{ action: 'delete' | 'restore'; food: Food } | null>(null);

  const foods = useFoodList({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    isActive: isActiveFilter === '' ? undefined : isActiveFilter === 'true',
    includeDeleted: true,
    sortBy,
    sortDir,
  });
  // Separate, unfiltered fetch (generous limit) — feeds the hero/KPI tiles/insights so
  // those always reflect the whole library, not whatever filter the list below is under.
  const allFoods = useFoodList({ page: 1, limit: 100, includeDeleted: true });

  const createFood = useCreateFood();
  const updateFood = useUpdateFood();
  const statusAction = useFoodStatusAction();

  const data = foods.data;
  const items = data?.items ?? [];
  const allItems = allFoods.data?.items ?? [];

  const openCreate = () => {
    setForm(DEFAULT_FOOD_FORM_STATE);
    setFormError(null);
    setEditing('new');
  };
  const openEdit = (food: Food) => {
    setForm(toFormState(food));
    setFormError(null);
    setEditing(food);
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Food name is required.');
      return;
    }
    const payload = {
      name: form.name,
      category: form.category || undefined,
      servingSize: form.servingSize || undefined,
      calories: toNumberOrUndefined(form.calories),
      protein: toNumberOrUndefined(form.protein),
      carbohydrates: toNumberOrUndefined(form.carbohydrates),
      fat: toNumberOrUndefined(form.fat),
      fiber: toNumberOrUndefined(form.fiber),
      sugar: toNumberOrUndefined(form.sugar),
      sodium: toNumberOrUndefined(form.sodium),
      notes: form.notes || undefined,
      isActive: form.isActive,
    };

    if (editing === 'new') {
      createFood.mutate(payload, {
        onSuccess: () => {
          toast.success('Food added.');
          setEditing(null);
        },
        onError: (err) => setFormError(toDietError(err).message),
      });
    } else if (editing) {
      updateFood.mutate(
        { id: editing.id, payload },
        {
          onSuccess: () => {
            toast.success('Food updated.');
            setEditing(null);
          },
          onError: (err) => setFormError(toDietError(err).message),
        },
      );
    }
  };

  const runStatusAction = () => {
    if (!confirmAction) return;
    statusAction.mutate(
      { id: confirmAction.food.id, action: confirmAction.action },
      {
        onSuccess: () => toast.success(`Food ${confirmAction.action}d.`),
        onError: (err) => toast.error(toDietError(err).message),
      },
    );
    setConfirmAction(null);
  };

  const handleCardAction = (food: Food, action: FoodCardAction) => {
    if (action === 'edit') {
      openEdit(food);
      return;
    }
    setConfirmAction({ action, food });
  };

  return (
    <div className="w-full space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/diet-plans">
          <ArrowLeft className="size-4" /> Back to diet plans
        </Link>
      </Button>

      <FoodsHero
        total={allFoods.data?.total ?? 0}
        foods={allItems}
        actions={
          canCreate ? (
            <Button size="sm" data-solid className="border-0 bg-white text-indigo-700 shadow-lg hover:bg-white/90" onClick={openCreate}>
              <Plus className="size-4" /> Add food
            </Button>
          ) : null
        }
      />

      <FoodsKpis
        foods={allItems}
        loading={allFoods.isPending}
        isActiveFilter={isActiveFilter}
        onStatus={(v) => {
          setIsActiveFilter(v);
          setPage(1);
        }}
      />

      <FoodsInsights foods={allItems} loading={allFoods.isPending} />

      <FoodsToolbar
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

      {foods.error ? (
        <EmptyState
          title="Couldn't load this data"
          description={foods.error instanceof Error ? foods.error.message : 'Something went wrong loading this data.'}
          className="border-destructive/30"
          action={
            <Button variant="outline" size="sm" onClick={() => foods.refetch()}>
              Retry
            </Button>
          }
        />
      ) : foods.isPending ? (
        <div className={view === 'grid' ? 'grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4' : 'space-y-3'}>
          {Array.from({ length: view === 'grid' ? 6 : 4 }).map((_, i) => (
            <Skeleton key={i} className={view === 'grid' ? 'h-[280px] w-full rounded-3xl' : 'h-20 w-full rounded-2xl'} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Apple} title={!search && !isActiveFilter ? 'Add your first food to get started.' : 'No foods match these filters.'} />
      ) : (
        <div className={view === 'grid' ? 'grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4' : 'space-y-2.5'}>
          {items.map((f, i) => (
            <FoodCard
              key={f.id}
              food={f}
              index={i}
              variant={view}
              canUpdate={canUpdate}
              canDelete={canDelete}
              canRestore={canRestore}
              onRequestAction={(action) => handleCardAction(f, action)}
            />
          ))}
        </div>
      )}

      {data ? <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} totalItems={data.total} pageSize={20} /> : null}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl gap-0 overflow-y-auto p-0">
          <div className="relative overflow-hidden p-5 text-white" style={{ backgroundImage: 'linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}>
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 14px)' }} />
            <div className="relative flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-white/30 bg-white/15">
                <Apple className="size-5" aria-hidden />
              </span>
              <DialogHeader className="min-w-0 text-left">
                <DialogTitle className="text-white">{editing === 'new' ? 'Add food' : `Edit ${editing?.name ?? ''}`}</DialogTitle>
                <DialogDescription className="text-white/80">Reusable across any diet plan&apos;s meal builder.</DialogDescription>
              </DialogHeader>
            </div>
          </div>
          <form onSubmit={submitForm} className="space-y-4 p-5">
            {formError ? (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            ) : null}
            <FoodFormFields value={form} onChange={setForm} disabled={createFood.isPending || updateFood.isPending} />
            <Button
              type="submit"
              className="w-full border-0 text-white shadow-md"
              style={{ backgroundImage: 'linear-gradient(120deg, var(--success), var(--chart-3))' }}
              disabled={createFood.isPending || updateFood.isPending}
            >
              {createFood.isPending || updateFood.isPending ? 'Saving…' : editing === 'new' ? 'Add food' : 'Save changes'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction ? `${confirmAction.action[0]!.toUpperCase()}${confirmAction.action.slice(1)} "${confirmAction.food.name}"?` : ''}
        description={
          confirmAction?.action === 'delete'
            ? 'This soft-deletes the food — plans that already use it are unaffected, but it can no longer be added to new plans until restored.'
            : 'This action can be reversed later if needed.'
        }
        destructive={confirmAction?.action === 'delete'}
        loading={statusAction.isPending}
        onConfirm={runStatusAction}
      />
    </div>
  );
}
