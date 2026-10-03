'use client';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Dumbbell, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import {
  DEFAULT_EXERCISE_FORM_STATE,
  ExerciseFormFields,
  type ExerciseFormState,
} from '@/features/workouts/components/exercise-form-fields';
import { ExerciseCard, type ExerciseCardAction } from '@/features/workouts/components/exercise-card';
import { ExercisesHero } from '@/features/workouts/components/exercises-hero';
import { ExercisesInsights, ExercisesKpis } from '@/features/workouts/components/exercises-overview';
import { ExercisesToolbar } from '@/features/workouts/components/exercises-toolbar';
import { toWorkoutError, useCreateExercise, useExerciseList, useExerciseStatusAction, useUpdateExercise } from '@/features/workouts/hooks/use-workouts';
import type { DifficultyLevel, Exercise, ListExercisesParams } from '@/features/workouts/types';

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
  const [isActiveFilter, setIsActiveFilter] = React.useState<'true' | 'false' | ''>('');
  const [difficultyFilter, setDifficultyFilter] = React.useState<DifficultyLevel | ''>('');
  const [page, setPage] = React.useState(1);
  const [sortBy, setSortBy] = React.useState<SortableColumn>('name');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');
  const [view, setView] = React.useState<'grid' | 'list'>('grid');
  const [editing, setEditing] = React.useState<Exercise | 'new' | null>(null);
  const [form, setForm] = React.useState<ExerciseFormState>(DEFAULT_EXERCISE_FORM_STATE);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [confirmAction, setConfirmAction] = React.useState<{ action: 'delete' | 'restore'; exercise: Exercise } | null>(null);

  const exercises = useExerciseList({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    isActive: isActiveFilter === '' ? undefined : isActiveFilter === 'true',
    difficultyLevel: difficultyFilter || undefined,
    includeDeleted: true,
    sortBy,
    sortDir,
  });
  // Separate, unfiltered fetch (generous limit) — feeds the hero/KPI tiles/insights so
  // those always reflect the whole library, not whatever filter the list below is under.
  const allExercises = useExerciseList({ page: 1, limit: 100, includeDeleted: true });

  const createExercise = useCreateExercise();
  const updateExercise = useUpdateExercise();
  const statusAction = useExerciseStatusAction();

  const data = exercises.data;
  const items = data?.items ?? [];
  const allItems = allExercises.data?.items ?? [];

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

  const handleCardAction = (exercise: Exercise, action: ExerciseCardAction) => {
    if (action === 'edit') {
      openEdit(exercise);
      return;
    }
    setConfirmAction({ action, exercise });
  };

  return (
    <div className="w-full space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/workout-plans">
          <ArrowLeft className="size-4" /> Back to workout plans
        </Link>
      </Button>

      <ExercisesHero
        total={allExercises.data?.total ?? 0}
        exercises={allItems}
        actions={
          canCreate ? (
            <Button size="sm" data-solid className="border-0 bg-white text-indigo-700 shadow-lg hover:bg-white/90" onClick={openCreate}>
              <Plus className="size-4" /> Add exercise
            </Button>
          ) : null
        }
      />

      <ExercisesKpis
        exercises={allItems}
        loading={allExercises.isPending}
        isActiveFilter={isActiveFilter}
        onStatus={(v) => {
          setIsActiveFilter(v);
          setPage(1);
        }}
      />

      <ExercisesInsights exercises={allItems} loading={allExercises.isPending} />

      <ExercisesToolbar
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
        difficulty={difficultyFilter}
        onDifficulty={(v) => {
          setDifficultyFilter(v);
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

      {exercises.error ? (
        <EmptyState
          title="Couldn't load this data"
          description={exercises.error instanceof Error ? exercises.error.message : 'Something went wrong loading this data.'}
          className="border-destructive/30"
          action={
            <Button variant="outline" size="sm" onClick={() => exercises.refetch()}>
              Retry
            </Button>
          }
        />
      ) : exercises.isPending ? (
        <div className={view === 'grid' ? 'grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4' : 'space-y-3'}>
          {Array.from({ length: view === 'grid' ? 6 : 4 }).map((_, i) => (
            <Skeleton key={i} className={view === 'grid' ? 'h-[280px] w-full rounded-3xl' : 'h-20 w-full rounded-2xl'} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Dumbbell} title={!search && !isActiveFilter && !difficultyFilter ? 'Add your first exercise to get started.' : 'No exercises match these filters.'} />
      ) : (
        <div className={view === 'grid' ? 'grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4' : 'space-y-2.5'}>
          {items.map((ex, i) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              index={i}
              variant={view}
              canUpdate={canUpdate}
              canDelete={canDelete}
              canRestore={canRestore}
              onRequestAction={(action) => handleCardAction(ex, action)}
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
                <Dumbbell className="size-5" aria-hidden />
              </span>
              <DialogHeader className="min-w-0 text-left">
                <DialogTitle className="text-white">{editing === 'new' ? 'Add exercise' : `Edit ${editing?.name ?? ''}`}</DialogTitle>
                <DialogDescription className="text-white/80">Reusable across any workout plan&apos;s weekly schedule.</DialogDescription>
              </DialogHeader>
            </div>
          </div>
          <form onSubmit={submitForm} className="space-y-4 p-5">
            {formError ? (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            ) : null}
            <ExerciseFormFields value={form} onChange={setForm} disabled={createExercise.isPending || updateExercise.isPending} />
            <Button
              type="submit"
              className="w-full border-0 text-white shadow-md"
              style={{ backgroundImage: 'linear-gradient(120deg, var(--success), var(--chart-3))' }}
              disabled={createExercise.isPending || updateExercise.isPending}
            >
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
