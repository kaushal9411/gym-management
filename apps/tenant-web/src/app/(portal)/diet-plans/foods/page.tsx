'use client';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import * as React from 'react';
import Link from 'next/link';
import { Apple, ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, MoreHorizontal, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Pagination } from '@/components/ui/pagination';
import { SearchBar } from '@/components/ui/search-bar';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { DEFAULT_FOOD_FORM_STATE, FoodFormFields, type FoodFormState } from '@/features/diet/components/food-form-fields';
import { toDietError, useCreateFood, useFoodList, useFoodStatusAction, useUpdateFood } from '@/features/diet/hooks/use-diet';
import type { Food, ListFoodsParams } from '@/features/diet/types';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-9 rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs transition-all duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring',
);

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
  const [page, setPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState<SortableColumn>('name');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [editing, setEditing] = React.useState<Food | 'new' | null>(null);
  const [form, setForm] = React.useState<FoodFormState>(DEFAULT_FOOD_FORM_STATE);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [confirmAction, setConfirmAction] = React.useState<{ action: 'delete' | 'restore'; food: Food } | null>(null);

  const foods = useFoodList({ page, limit: 20, search: debouncedSearch || undefined, includeDeleted: true, sortBy, sortDir });
  const createFood = useCreateFood();
  const updateFood = useUpdateFood();
  const statusAction = useFoodStatusAction();

  const data = foods.data;
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

  const columns: DataTableColumn<Food>[] = [
    {
      key: 'name',
      header: sortableHeader('Food', 'name'),
      render: (f) => (
        <button type="button" className="text-left hover:underline" onClick={() => openEdit(f)}>
          <span className="block font-medium">{f.name}</span>
          <span className="block text-xs text-muted-foreground">{f.servingSize ?? '—'}</span>
        </button>
      ),
    },
    { key: 'category', header: sortableHeader('Category', 'category'), render: (f) => f.category ?? '—' },
    { key: 'calories', header: 'Calories', render: (f) => (f.calories ?? '—') },
    { key: 'protein', header: 'Protein (g)', render: (f) => f.protein ?? '—' },
    {
      key: 'status',
      header: 'Status',
      render: (f) =>
        f.deletedAt ? (
          <Badge variant="outline" className="border-dashed text-muted-foreground">Deleted</Badge>
        ) : (
          <Badge variant={f.isActive ? 'secondary' : 'outline'}>{f.isActive ? 'Active' : 'Inactive'}</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (f) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${f.name}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canUpdate ? <DropdownMenuItem onClick={() => openEdit(f)}>Edit</DropdownMenuItem> : null}
            {f.deletedAt ? (
              canRestore ? (
                <DropdownMenuItem onClick={() => setConfirmAction({ action: 'restore', food: f })}>Restore</DropdownMenuItem>
              ) : null
            ) : canDelete ? (
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmAction({ action: 'delete', food: f })}>
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
      <Button variant="ghost" size="sm" asChild>
        <Link href="/diet-plans">
          <ArrowLeft className="size-4" /> Back to diet plans
        </Link>
      </Button>

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
            <h1 className="text-2xl font-semibold tracking-tight">Food Library</h1>
            <p className="text-muted-foreground">Reusable foods for building diet plans.</p>
          </div>
        </div>
        {canCreate ? (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" /> Add food
          </Button>
        ) : null}
      </div>

      <SearchBar
        containerClassName="max-w-xs"
        placeholder="Search name, category…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

      <DataTable columns={columns} rows={items} rowKey={(f) => f.id} loading={foods.isPending} error={foods.error} onRetry={() => foods.refetch()} emptyMessage="No foods match these filters." />

      {data ? (
        <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} totalItems={data.total} pageSize={20} />
      ) : null}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'Add food' : `Edit ${editing?.name ?? ''}`}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitForm} className="space-y-4">
            {formError ? (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            ) : null}
            <FoodFormFields value={form} onChange={setForm} disabled={createFood.isPending || updateFood.isPending} />
            <Button type="submit" className="w-full" disabled={createFood.isPending || updateFood.isPending}>
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
