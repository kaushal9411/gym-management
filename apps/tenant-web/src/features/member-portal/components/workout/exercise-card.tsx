'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, PencilLine, SkipForward, Undo2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { toneColor, toneTint } from '../kit';
import { describeLogged, describeTarget, type TrackingExercise } from '../../lib/workout-tracking';
import { Pop, PressButton, useBounce } from './workout-motion';

type Shown = TrackingExercise['status'];

/**
 * One exercise of the selected day as a big tappable card: Done / Skip while
 * pending; once logged it shows what was logged with Edit details / Undo.
 * `shown` is the optimistic status (while a request is in flight).
 */
export function ExerciseCard({
  exercise,
  index,
  shown,
  canLog,
  lockedReason,
  busy,
  onDone,
  onSkip,
  onUndo,
  onDetails,
}: {
  exercise: TrackingExercise;
  index: number;
  shown: Shown;
  canLog: boolean;
  lockedReason: string;
  busy: boolean;
  onDone: () => void;
  onSkip: () => void;
  onUndo: () => void;
  onDetails: () => void;
}) {
  const b = useBounce();
  const tone = shown === 'COMPLETED' ? 'success' : shown === 'SKIPPED' ? 'muted' : 'primary';
  const target = describeTarget(exercise);
  const logged = shown === 'COMPLETED' ? describeLogged(exercise) : null;
  return (
    <Pop delay={Math.min(index, 8) * 0.06}>
      <motion.article
        layout={!b.reduce}
        className="relative overflow-hidden rounded-2xl border p-3.5 shadow-xs transition-colors"
        style={{ background: shown === 'PENDING' ? 'var(--card)' : toneTint(tone, 9), borderColor: shown === 'PENDING' ? undefined : toneTint(tone, 40) }}
      >
        {shown === 'COMPLETED' ? <span aria-hidden className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full opacity-25 blur-xl" style={{ background: toneColor('success') }} /> : null}
        <div className="relative flex items-start gap-3">
          <motion.span
            key={shown}
            initial={b.reduce ? false : { scale: 0.5, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={b.spring}
            className="grid size-11 shrink-0 place-items-center rounded-2xl text-sm font-semibold tabular-nums text-white shadow-sm"
            style={{ background: shown === 'COMPLETED' ? `linear-gradient(135deg, ${toneColor('success')}, color-mix(in oklab, ${toneColor('success')} 60%, white))` : shown === 'SKIPPED' ? 'var(--muted-foreground)' : `linear-gradient(135deg, ${toneColor('primary')}, color-mix(in oklab, ${toneColor('primary')} 60%, ${toneColor('violet')}))` }}
          >
            {shown === 'COMPLETED' ? <Check className="size-5" strokeWidth={3} /> : shown === 'SKIPPED' ? <SkipForward className="size-5" /> : index + 1}
          </motion.span>
          <div className="min-w-0 flex-1">
            <p className={cn('break-words text-[15px] font-semibold leading-snug', shown === 'SKIPPED' && 'text-muted-foreground line-through')}>{exercise.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {exercise.muscleGroup ? <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{exercise.muscleGroup}</span> : null}
              {target ? <span className="font-medium tabular-nums">{target}</span> : null}
            </div>
            {exercise.notes ? <p className="mt-1.5 text-xs text-muted-foreground">{exercise.notes}</p> : null}
            {logged ? <p className="mt-1.5 text-xs font-semibold tabular-nums" style={{ color: toneColor('success') }}>Logged: {logged}</p> : null}
            {shown === 'COMPLETED' && exercise.logNotes ? <p className="mt-1 text-xs italic text-muted-foreground">“{exercise.logNotes}”</p> : null}
          </div>
        </div>

        <div className="relative mt-3">
          <AnimatePresence mode="wait" initial={false}>
            {shown === 'PENDING' ? (
              canLog ? (
                <motion.div key="pending" exit={b.reduce ? undefined : { opacity: 0, scale: 0.95 }} className="grid grid-cols-[1fr_auto] gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <PressButton
                      aria-label={`Mark ${exercise.name} done`}
                      disabled={busy}
                      onClick={onDone}
                      className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-white shadow-md"
                      style={{ background: `linear-gradient(135deg, ${toneColor('success')}, color-mix(in oklab, ${toneColor('success')} 70%, ${toneColor('info')}))` }}
                    >
                      <Check className="size-4" strokeWidth={3} /> Done
                    </PressButton>
                    <PressButton aria-label={`Skip ${exercise.name}`} disabled={busy} onClick={onSkip} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border bg-card text-sm font-semibold text-muted-foreground hover:bg-accent">
                      <SkipForward className="size-4" /> Skip
                    </PressButton>
                  </div>
                  <PressButton aria-label={`Add sets, reps or weight for ${exercise.name}`} disabled={busy} onClick={onDetails} className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border bg-card text-muted-foreground hover:bg-accent">
                    <PencilLine className="size-4" />
                  </PressButton>
                </motion.div>
              ) : (
                <p key="locked" className="rounded-xl bg-muted px-3 py-2.5 text-center text-xs font-medium text-muted-foreground">
                  {lockedReason}
                </p>
              )
            ) : (
              <motion.div key="logged" initial={b.reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-2">
                {shown === 'COMPLETED' ? (
                  <PressButton aria-label={`Add or edit details for ${exercise.name}`} disabled={busy || !canLog} onClick={onDetails} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border bg-card px-3.5 text-xs font-semibold hover:bg-accent">
                    <PencilLine className="size-3.5" /> {logged ? 'Edit details' : 'Add sets, reps, weight'}
                  </PressButton>
                ) : null}
                <PressButton aria-label={`Undo ${exercise.name}`} disabled={busy || !canLog} onClick={onUndo} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold text-muted-foreground hover:bg-accent">
                  <Undo2 className="size-3.5" /> Undo
                </PressButton>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.article>
    </Pop>
  );
}
