'use client';

import * as React from 'react';
import { Check, ChevronDown, History, PencilLine, SkipForward, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { SectionCard, StatusChip, toneChipStyle } from '../kit';
import { useDeleteWorkoutLog, useMemberWorkoutHistory, useUpdateWorkoutLog } from '../../hooks/use-member-portal';
import { EFFORT_LABELS, describeLogged, shortDay, weekdayShort, type WorkoutLogEntry } from '../../lib/workout-tracking';
import { LogSheet } from './log-sheet';
import { PressButton } from './workout-motion';

/** Last 60 days of the member's own entries, grouped by day, with edit (details) and delete. Collapsed until opened. */
export function HistorySection() {
  const [open, setOpen] = React.useState(false);
  const { data, isLoading, isError } = useMemberWorkoutHistory(60, open);
  const update = useUpdateWorkoutLog();
  const remove = useDeleteWorkoutLog();
  const [editing, setEditing] = React.useState<WorkoutLogEntry | null>(null);
  const [deleting, setDeleting] = React.useState<WorkoutLogEntry | null>(null);

  const groups = React.useMemo(() => {
    const byDate = new Map<string, WorkoutLogEntry[]>();
    for (const e of data?.entries ?? []) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
    const sessions = new Map((data?.sessions ?? []).map((s) => [s.date, s]));
    return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, entries]) => ({ date, entries, session: sessions.get(date) ?? null }));
  }, [data]);

  return (
    <SectionCard title="Workout history" subtitle="Everything you've logged, last 60 days" icon={History} tone="muted">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex min-h-11 w-full items-center justify-between rounded-xl border bg-card px-3.5 text-sm font-semibold transition active:scale-[0.99] hover:bg-accent">
        {open ? 'Hide history' : 'Show history'}
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div className="mt-3 space-y-4">
          {isLoading ? <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p> : null}
          {isError ? <p className="py-6 text-center text-sm text-destructive">Couldn&apos;t load your history. Try again later.</p> : null}
          {!isLoading && !isError && groups.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nothing logged yet - your workouts will show up here.</p> : null}
          {groups.map((g) => (
            <div key={g.date}>
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">
                  {weekdayShort(g.date)}, {shortDay(g.date)}
                </p>
                {g.session?.durationMin ? <StatusChip tone="info">{g.session.durationMin} min</StatusChip> : null}
                {g.session?.effort ? <StatusChip tone="muted">Effort {g.session.effort}/5 · {EFFORT_LABELS[g.session.effort]}</StatusChip> : null}
              </div>
              <ul className="space-y-1.5">
                {g.entries.map((e) => {
                  const done = e.status === 'COMPLETED';
                  const details = describeLogged(e);
                  return (
                    <li key={e.id} className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={toneChipStyle(done ? 'success' : 'muted')}>
                        {done ? <Check className="size-4" strokeWidth={3} aria-label="done" /> : <SkipForward className="size-4" aria-label="skipped" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={cn('truncate text-sm font-medium', !done && 'text-muted-foreground line-through')}>{e.exerciseName}</p>
                        <p className="truncate text-xs text-muted-foreground">{done ? details ?? 'Done' : 'Skipped'}</p>
                      </div>
                      {done ? (
                        <PressButton aria-label={`Edit ${e.exerciseName} on ${shortDay(e.date)}`} onClick={() => setEditing(e)} className="grid size-11 place-items-center rounded-xl text-muted-foreground hover:bg-accent">
                          <PencilLine className="size-4" />
                        </PressButton>
                      ) : null}
                      <PressButton aria-label={`Delete ${e.exerciseName} on ${shortDay(e.date)}`} onClick={() => setDeleting(e)} className="grid size-11 place-items-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="size-4" />
                      </PressButton>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      <LogSheet
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing ? `Edit ${editing.exerciseName}` : 'Edit entry'}
        description={editing ? `${weekdayShort(editing.date)}, ${shortDay(editing.date)}` : undefined}
        initial={editing}
        submitLabel="Save changes"
        onSave={async (d) => {
          if (!editing) return;
          await update.mutateAsync({ id: editing.id, patch: d });
          toast.success('Entry updated');
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this entry?"
        description={deleting ? `${deleting.exerciseName} on ${shortDay(deleting.date)} will be removed from your history and progress.` : undefined}
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Entry deleted');
              setDeleting(null);
            },
            onError: (err) => toast.error(err.message || 'Could not delete the entry'),
          });
        }}
      />
    </SectionCard>
  );
}
