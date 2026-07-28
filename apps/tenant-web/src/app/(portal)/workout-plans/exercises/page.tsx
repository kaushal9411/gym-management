'use client';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import * as React from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, MoreHorizontal, Plus } from 'lucide-react';
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
import {
  DEFAULT_EXERCISE_FORM_STATE,
  ExerciseFormFields,
  type ExerciseFormState,
} from '@/features/workouts/components/exercise-form-fields';
import { toWorkoutError, useCreateExercise, useExerciseList, useExerciseStatusAction, useUpdateExercise } from '@/features/workouts/hooks/use-workouts';
import type { Exercise, ListExercisesParams } from '@/features/workouts/types';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-9 rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs transition-all duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring',
);

type SortableColumn = NonNullable<ListExercisesParams['sortBy']>;

function toFormState(exercise: Exercise): ExerciseFormState {
  return {
    name: exercise.name,
    category: exercise.category ?? '',
    muscleGroup: exercise.muscleGroup ?? '',
    equipment: exercise.equipment ?? '',
    difficultyLevel: exercise.difficultyLevel,
    instructions: exercise.instructions ?? '',
    imageUrl: exercise.imageUrl ?? '',
    videoUrl: exercise.videoUrl ?? '',
    durationSeconds: exercise.durationSeconds === null ? '' : String(exercise.durationSeconds),
    defaultSets: exercise.defaultSets === null ? '' : String(exercise.defaultSets),
    defaultReps: exercise.defaultReps === null ? '' : String(exercise.defaultReps),
    restSeconds: exercise.restSeconds === null ? '' : String(exercise.restSeconds),
    caloriesBurnEstimate: exercise.caloriesBurnEstimate === null ? '' : String(exercise.caloriesBurnEstimate),
    isActive: exercise.isActive,
  };
}

function toNumberOrUndefined(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

export default function ExerciseLibraryPage() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('workouts:create');
  const canUpdate = hasPermission('workouts:update');
  const canDelete = hasPermission('workouts:delete');
  const canRestore = hasPermission('workouts:restore');

  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState<SortableColumn>('name');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [editing, setEditing] = React.useState<Exercise | 'new' | null>(null);
  const [form, setForm] = React.useState<ExerciseFormState>(DEFAULT_EXERCISE_FORM_STATE);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [confirmAction, setConfirmAction] = React.useState<{ action: 'delete' | 'restore'; exercise: Exercise } | null>(null);

  const exercises = useExerciseList({ page, limit: 20, search: debouncedSearch || undefined, includeDeleted: true, sortBy, sortDir });
  const createExercise = useCreateExercise();
  const updateExercise = useUpdateExercise();
  const statusAction = useExerciseStatusAction();

  const data = exercises.data;
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
    setForm(DEFAULT_EXERCISE_FORM_STATE);
    setFormError(null);
    setEditing('new');
  };
  const openEdit = (exercise: Exercise) => {
    setForm(toFormState(exercise));
    setFormError(null);
    setEditing(exercise);
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Exercise name is required.');
      return;
    }
    const payload = {
      name: form.name,
      category: form.category || undefined,
      muscleGroup: form.muscleGroup || undefined,
      equipment: form.equipment || undefined,
      difficultyLevel: form.difficultyLevel,
      instructions: form.instructions || undefined,
      imageUrl: form.imageUrl || undefined,
      videoUrl: form.videoUrl || undefined,
      durationSeconds: toNumberOrUndefined(form.durationSeconds),
      defaultSets: toNumberOrUndefined(form.defaultSets),
      defaultReps: toNumberOrUndefined(form.defaultReps),
      restSeconds: toNumberOrUndefined(form.restSeconds),
      caloriesBurnEstimate: toNumberOrUndefined(form.caloriesBurnEstimate),
      isActive: form.isActive,
    };

    if (editing === 'new') {
      createExercise.mutate(payload, {
        onSuccess: () => {
          toast.success('Exercise added.');
          setEditing(null);
        },
        onError: (err) => setFormError(toWorkoutError(err).message),
      });
    } else if (editing) {
      updateExercise.mutate(
        { id: editing.id, payload },
        {
          onSuccess: () => {
            toast.success('Exercise updated.');
            setEditing(null);
          },
          onError: (err) => setFormError(toWorkoutError(err).message),
        },
      );
    }
  };

  const runStatusAction = () => {
    if (!confirmAction) return;
    statusAction.mutate(
      { id: confirmAction.exercise.id, action: confirmAction.action },
      {
        onSuccess: () => toast.success(`Exercise ${confirmAction.action}d.`),
        onError: (err) => toast.error(toWorkoutError(err).message),
      },
    );
    setConfirmAction(null);
  };

  const columns: DataTableColumn<Exercise>[] = [
    {
      key: 'name',
      header: sortableHeader('Exercise', 'name'),
      render: (ex) => (
        <button type="button" className="flex items-center gap-2.5 text-left hover:underline" onClick={() => openEdit(ex)}>
          {ex.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data-URL, not an optimizable remote image
            <img src={ex.imageUrl} alt="" className="size-8 rounded object-cover" />
          ) : null}
          <span>
            <span className="block font-medium">{ex.name}</span>
            <span className="block text-xs text-muted-foreground">{ex.muscleGroup ?? '—'}</span>
          </span>
        </button>
      ),
    },
    { key: 'category', header: sortableHeader('Category', 'category'), render: (ex) => ex.category ?? '—' },
    { key: 'equipment', header: 'Equipment', render: (ex) => ex.equipment ?? '—' },
    { key: 'difficulty', header: 'Difficulty', render: (ex) => <Badge variant="secondary">{ex.difficultyLevel}</Badge> },
    {
      key: 'status',
      header: 'Status',
      render: (ex) =>
        ex.deletedAt ? (
          <Badge variant="outline" className="border-dashed text-muted-foreground">Deleted</Badge>
        ) : (
          <Badge variant={ex.isActive ? 'secondary' : 'outline'}>{ex.isActive ? 'Active' : 'Inactive'}</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-10',
      render: (ex) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${ex.name}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canUpdate ? <DropdownMenuItem onClick={() => openEdit(ex)}>Edit</DropdownMenuItem> : null}
            {ex.deletedAt ? (
              canRestore ? (
                <DropdownMenuItem onClick={() => setConfirmAction({ action: 'restore', exercise: ex })}>Restore</DropdownMenuItem>
              ) : null
            ) : canDelete ? (
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmAction({ action: 'delete', exercise: ex })}>
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
        <Link href="/workout-plans">
          <ArrowLeft className="size-4" /> Back to workout plans
        </Link>
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Exercise Library</h1>
          <p className="text-muted-foreground">Reusable exercises for building workout plans.</p>
        </div>
        {canCreate ? (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" /> Add exercise
          </Button>
        ) : null}
      </div>

      <SearchBar
        containerClassName="max-w-xs"
        placeholder="Search name, category, muscle group…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

      <DataTable columns={columns} rows={items} rowKey={(ex) => ex.id} loading={exercises.isPending} error={exercises.error} onRetry={() => exercises.refetch()} emptyMessage="No exercises match these filters." />

      {data ? (
        <Pagination page={page} totalPages={data.totalPages} onPageChange={setPage} totalItems={data.total} pageSize={20} />
      ) : null}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'Add exercise' : `Edit ${editing?.name ?? ''}`}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitForm} className="space-y-4">
            {formError ? (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            ) : null}
            <ExerciseFormFields value={form} onChange={setForm} disabled={createExercise.isPending || updateExercise.isPending} />
            <Button type="submit" className="w-full" disabled={createExercise.isPending || updateExercise.isPending}>
              {createExercise.isPending || updateExercise.isPending ? 'Saving…' : editing === 'new' ? 'Add exercise' : 'Save changes'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction ? `${confirmAction.action[0]!.toUpperCase()}${confirmAction.action.slice(1)} "${confirmAction.exercise.name}"?` : ''}
        description={
          confirmAction?.action === 'delete'
            ? 'This soft-deletes the exercise — plans that already use it are unaffected, but it can no longer be added to new plans until restored.'
            : 'This action can be reversed later if needed.'
        }
        destructive={confirmAction?.action === 'delete'}
        loading={statusAction.isPending}
        onConfirm={runStatusAction}
      />
    </div>
  );
}
