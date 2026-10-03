'use client';

import * as React from 'react';
import { GripVertical, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { type Accent, accentVar, tint } from '@/features/members/components/detail/detail-ui';
import { cn } from '@/lib/utils';
import type { Exercise, PlanExercise, PlanExerciseInput, WeekDay } from '../types';
import { WEEK_DAYS } from '../types';

const DAY_ACCENTS: Record<WeekDay, Accent> = {
  MONDAY: 'primary',
  TUESDAY: 'violet',
  WEDNESDAY: 'aqua',
  THURSDAY: 'warning',
  FRIDAY: 'success',
  SATURDAY: 'destructive',
  SUNDAY: 'primary',
};

const selectClassName = cn(
  'h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs transition-all duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50',
);

const DAY_LABELS: Record<WeekDay, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};

interface ScheduleItem extends PlanExerciseInput {
  key: string;
  exerciseName: string;
}

function toScheduleItems(exercises: PlanExercise[]): ScheduleItem[] {
  return exercises.map((e) => ({
    key: e.id,
    exerciseId: e.exercise.id,
    exerciseName: e.exercise.name,
    dayOfWeek: e.dayOfWeek,
    sets: e.sets ?? undefined,
    repetitions: e.repetitions ?? undefined,
    restSeconds: e.restSeconds ?? undefined,
    notes: e.notes ?? undefined,
  }));
}

interface WeeklyScheduleEditorProps {
  initialExercises: PlanExercise[];
  exerciseOptions: Exercise[];
  disabled?: boolean;
  onChange: (exercises: PlanExerciseInput[], isDirty: boolean) => void;
}

/** Native HTML5 drag-and-drop — no extra dependency. Reordering is scoped WITHIN one day; moving to a different day is done by removing and re-adding. */
export function WeeklyScheduleEditor({ initialExercises, exerciseOptions, disabled, onChange }: WeeklyScheduleEditorProps) {
  const [items, setItems] = React.useState<ScheduleItem[]>(() => toScheduleItems(initialExercises));
  const baseline = React.useMemo(() => toScheduleItems(initialExercises), [initialExercises]);
  const [addDay, setAddDay] = React.useState<WeekDay>('MONDAY');
  const [addExerciseId, setAddExerciseId] = React.useState('');
  const dragKey = React.useRef<string | null>(null);

  const emit = (next: ScheduleItem[]) => {
    setItems(next);
    const dirty = JSON.stringify(next.map((i) => ({ e: i.exerciseId, d: i.dayOfWeek }))) !== JSON.stringify(baseline.map((i) => ({ e: i.exerciseId, d: i.dayOfWeek })));
    onChange(
      next.map(({ exerciseId, dayOfWeek, sets, repetitions, restSeconds, notes }) => ({ exerciseId, dayOfWeek, sets, repetitions, restSeconds, notes })),
      dirty,
    );
  };

  const addExercise = () => {
    if (!addExerciseId) return;
    const exercise = exerciseOptions.find((e) => e.id === addExerciseId);
    if (!exercise) return;
    emit([
      ...items,
      {
        key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        dayOfWeek: addDay,
        sets: exercise.defaultSets ?? undefined,
        repetitions: exercise.defaultReps ?? undefined,
        restSeconds: exercise.restSeconds ?? undefined,
      },
    ]);
    setAddExerciseId('');
  };

  const removeItem = (key: string) => emit(items.filter((i) => i.key !== key));

  const handleDrop = (day: WeekDay, targetKey: string) => {
    const draggedKey = dragKey.current;
    dragKey.current = null;
    if (!draggedKey || draggedKey === targetKey) return;
    const dayItems = items.filter((i) => i.dayOfWeek === day);
    const dragged = dayItems.find((i) => i.key === draggedKey);
    if (!dragged) return; // dragging across days isn't supported
    const withoutDragged = dayItems.filter((i) => i.key !== draggedKey);
    const targetIndex = withoutDragged.findIndex((i) => i.key === targetKey);
    withoutDragged.splice(targetIndex, 0, dragged);
    // Rendering re-groups by day regardless of flat array order, and the
    // backend tracks `sortOrder` per-day independently — so it's safe to
    // just append this day's reordered slice after everything else.
    emit([...items.filter((i) => i.dayOfWeek !== day), ...withoutDragged]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="scheduleDay">
            Day
          </label>
          <select id="scheduleDay" className={selectClassName} value={addDay} disabled={disabled} onChange={(e) => setAddDay(e.target.value as WeekDay)}>
            {WEEK_DAYS.map((d) => (
              <option key={d} value={d}>
                {DAY_LABELS[d]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-56 flex-1 space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="scheduleExercise">
            Exercise
          </label>
          <select
            id="scheduleExercise"
            className={selectClassName}
            value={addExerciseId}
            disabled={disabled}
            onChange={(e) => setAddExerciseId(e.target.value)}
          >
            <option value="">Select an exercise…</option>
            {exerciseOptions.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={disabled || !addExerciseId}
          onClick={addExercise}
          className="border-0 text-white shadow-md disabled:opacity-50"
          style={{ backgroundImage: 'linear-gradient(120deg, var(--primary), var(--chart-7))' }}
        >
          Add to schedule
        </Button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
        {WEEK_DAYS.map((day) => {
          const dayItems = items.filter((i) => i.dayOfWeek === day);
          const accent = DAY_ACCENTS[day];
          return (
            <div key={day} className="overflow-hidden rounded-2xl border shadow-xs" style={{ borderColor: tint(accent, 20) }}>
              <h4
                className="flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold text-foreground/90"
                style={{ backgroundImage: `linear-gradient(100deg, ${tint(accent, 15)}, transparent 85%)` }}
              >
                <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: accentVar(accent) }} aria-hidden="true" />
                {DAY_LABELS[day]}
              </h4>
              <div className="space-y-1.5 bg-card p-3">
                {dayItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Rest day / no exercises.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {dayItems.map((item) => (
                      <li
                        key={item.key}
                        draggable={!disabled}
                        onDragStart={() => {
                          dragKey.current = item.key;
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDrop(day, item.key)}
                        className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors hover:shadow-sm"
                        style={{ backgroundColor: tint(accent, 7), borderColor: tint(accent, 16) }}
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground" aria-hidden="true" />
                          <span className="truncate">{item.exerciseName}</span>
                          {item.sets || item.repetitions ? (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              ({item.sets ?? '—'}×{item.repetitions ?? '—'})
                            </span>
                          ) : null}
                        </span>
                        {!disabled ? (
                          <button
                            type="button"
                            aria-label={`Remove ${item.exerciseName} from ${DAY_LABELS[day]}`}
                            className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => removeItem(item.key)}
                          >
                            <X className="size-3.5" />
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
