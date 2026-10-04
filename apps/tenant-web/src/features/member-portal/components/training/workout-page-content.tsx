'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Check, Dumbbell, MessageSquareQuote, SkipForward, Target, Trophy, CalendarRange, Layers } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { useMarkWorkoutProgress, useMemberOverview, useMemberWorkout } from '../../hooks/use-member-portal';
import { formatDate } from '../../lib/format';
import { EmptyBlock, HeroChip, PortalHero, ProgressRing, SectionCard, SkeletonCard, SkeletonHero, StaggerGroup, StatTile, StatusChip, toneColor, toneTint } from '../kit';

const DAYS: string[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
type Ex = { exerciseId: string; name: string; dayOfWeek: string };
const SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const cap = (s: string) => s.toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const dayName = (i: number) => DAYS[i] ?? 'MONDAY';
const todayIdx = () => (new Date().getDay() + 6) % 7;

export function WorkoutPageContent() {
  const { data: workout, isLoading } = useMemberWorkout();
  const { data: overview } = useMemberOverview();
  const markProgress = useMarkWorkoutProgress();
  const m = useMotionSafe();
  const [picked, setPicked] = React.useState<number | null>(null);

  const exercises = workout?.workoutPlan.exercises;
  const byDay = React.useMemo(() => {
    const out: Record<string, Ex[]> = {};
    DAYS.forEach((d) => (out[d] = []));
    (exercises ?? []).forEach((e) => (out[e.dayOfWeek] ??= []).push(e));
    return out;
  }, [exercises]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonHero />
        <SkeletonCard lines={4} />
      </div>
    );
  }
  if (!workout) {
    return (
      <div className="space-y-4">
        <PortalHero eyebrow="Workout" title="No workout plan yet" subtitle="Your trainer will set one up for you" />
        <SectionCard title="Your plan" icon={Dumbbell} tone="primary">
          <EmptyBlock icon={Dumbbell} title="Your trainer hasn't assigned a plan yet" description="Once a plan is assigned, your weekly exercises and progress will appear here." />
        </SectionCard>
      </div>
    );
  }

  const progressBy = new Map(workout.progress.map((p) => [p.exerciseId, p]));
  // Optimistic feel: while the mutation is in flight, show the requested status right away.
  const pendingVars = markProgress.isPending ? markProgress.variables : undefined;
  const statusOf = (exerciseId: string) => (pendingVars && pendingVars.exerciseId === exerciseId ? pendingVars.status : (progressBy.get(exerciseId)?.status ?? 'PENDING'));

  const all = workout.workoutPlan.exercises;
  const done = all.filter((e) => statusOf(e.exerciseId) === 'COMPLETED').length;
  const skipped = all.filter((e) => statusOf(e.exerciseId) === 'SKIPPED').length;
  const pct = all.length ? Math.round((done / all.length) * 100) : 0;
  const today = todayIdx();
  const listOf = (d: string): Ex[] => byDay[d] ?? [];
  const firstWithEx = DAYS.findIndex((d) => listOf(d).length > 0);
  const selected = picked ?? (listOf(dayName(today)).length > 0 ? today : Math.max(0, firstWithEx));
  const dayExercises = listOf(dayName(selected));
  const dayDone = dayExercises.filter((e) => statusOf(e.exerciseId) !== 'PENDING').length;
  const activeDays = DAYS.filter((d) => listOf(d).length > 0).length;
  const week = overview?.workout?.completedThisWeek;

  return (
    <div className="space-y-4">
      <PortalHero
        eyebrow="Workout plan"
        title={workout.workoutPlan.name}
        subtitle={`${cap(workout.workoutPlan.level)} · ${workout.workoutPlan.durationWeeks} weeks · ${activeDays} training day${activeDays === 1 ? '' : 's'}/week`}
        chips={
          <>
            <HeroChip>Started {formatDate(workout.startDate)}</HeroChip>
            {workout.endDate ? <HeroChip>Ends {formatDate(workout.endDate)}</HeroChip> : null}
            <HeroChip>{cap(workout.status)}</HeroChip>
          </>
        }
        aside={
          <ProgressRing value={pct} size={84} thickness={9} onDark>
            <span className="text-lg font-semibold tabular-nums">{pct}%</span>
          </ProgressRing>
        }
        stats={[
          { label: 'Completed', value: done, format: (n) => `${n}/${all.length}` },
          { label: 'This week', value: week ?? 0, hidden: week === undefined },
          { label: 'Skipped', value: skipped },
        ]}
      />

      <StaggerGroup className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Plan progress" value={pct} format={(n) => `${n}%`} icon={Target} tone="success" progress={pct} hint={`${done} of ${all.length} exercises`} />
        <StatTile label="Done this week" value={week ?? done} icon={Trophy} tone="orange" hint={week === undefined ? 'Overall' : 'Exercises completed'} />
        <StatTile label="Exercises" value={all.length} icon={Layers} tone="info" hint={`Across ${activeDays} days`} />
        <StatTile label="Duration" value={workout.workoutPlan.durationWeeks} format={(n) => `${n} wk`} icon={CalendarRange} tone="violet" hint={workout.endDate ? `Ends ${formatDate(workout.endDate)}` : 'Open-ended'} />
      </StaggerGroup>

      {workout.trainerRemarks ? (
        <SectionCard title="Trainer remarks" icon={MessageSquareQuote} tone="warning">
          <p className="whitespace-pre-line text-sm leading-relaxed">{workout.trainerRemarks}</p>
        </SectionCard>
      ) : null}

      <SectionCard title="Weekly schedule" subtitle="Pick a day to see its exercises" icon={Dumbbell} tone="primary">
        <div role="tablist" aria-label="Day of week" className="grid grid-cols-7 gap-1 rounded-2xl bg-muted p-1">
          {DAYS.map((d, i) => {
            const list = listOf(d);
            const dd = list.filter((e) => statusOf(e.exerciseId) !== 'PENDING').length;
            const frac = list.length ? dd / list.length : 0;
            const active = selected === i;
            return (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`${cap(d)}, ${list.length} exercises`}
                onClick={() => setPicked(i)}
                className={cn('relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', active ? 'text-primary-foreground' : 'text-muted-foreground')}
              >
                {active ? <motion.span layoutId="workout-day-pill" className="absolute inset-0 rounded-xl bg-primary shadow-sm" transition={m.reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }} /> : null}
                <span className="relative">{SHORT[i] ?? ''}</span>
                <span className={cn('relative h-1 w-6 overflow-hidden rounded-full', active ? 'bg-white/30' : 'bg-foreground/10')}>
                  <span className="block h-full rounded-full" style={{ width: `${frac * 100}%`, background: active ? 'white' : toneColor('success') }} />
                </span>
                {i === today ? <span className={cn('absolute right-1 top-1 size-1.5 rounded-full', active ? 'bg-white' : 'bg-primary')} aria-label="today" /> : null}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            {cap(dayName(selected))}
            {selected === today ? ' · Today' : ''}
          </p>
          <StatusChip tone={dayExercises.length && dayDone === dayExercises.length ? 'success' : 'muted'}>{dayExercises.length ? `${dayDone}/${dayExercises.length} done` : 'Rest day'}</StatusChip>
        </div>

        <motion.div key={selected} initial={m.reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mt-3 space-y-3">
          {dayExercises.length === 0 ? (
            <EmptyBlock compact icon={Dumbbell} tone="success" title="Rest day" description="Nothing scheduled — recover well." />
          ) : (
            dayExercises.map((ex, index) => {
              const status = statusOf(ex.exerciseId);
              const tone = status === 'COMPLETED' ? 'success' : status === 'SKIPPED' ? 'muted' : 'primary';
              return (
                <div
                  key={`${ex.exerciseId}-${ex.dayOfWeek}-${index}`}
                  className="overflow-hidden rounded-2xl border p-3.5 transition-colors"
                  style={{ background: status === 'PENDING' ? undefined : toneTint(tone, 10), borderColor: status === 'PENDING' ? undefined : toneTint(tone, 40) }}
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl text-sm font-semibold tabular-nums" style={{ background: toneTint(tone, 18), color: toneColor(tone) }}>
                      {status === 'COMPLETED' ? <Check className="size-5" /> : status === 'SKIPPED' ? <SkipForward className="size-5" /> : index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate text-sm font-semibold', status === 'SKIPPED' && 'text-muted-foreground line-through')}>{ex.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {status === 'COMPLETED' ? 'Completed' : status === 'SKIPPED' ? 'Skipped' : 'Pending'}
                        {progressBy.get(ex.exerciseId)?.markedAt && status !== 'PENDING' ? ` · ${formatDate(progressBy.get(ex.exerciseId)!.markedAt)}` : ''}
                      </p>
                    </div>
                  </div>
                  {status === 'PENDING' ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        aria-label={`Mark ${ex.name} completed`}
                        disabled={markProgress.isPending}
                        onClick={() => markProgress.mutate({ assignmentId: workout.id, exerciseId: ex.exerciseId, status: 'COMPLETED' })}
                        className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-success text-sm font-semibold text-white shadow-sm transition active:scale-[0.97] disabled:opacity-60"
                      >
                        <Check className="size-4" /> Complete
                      </button>
                      <button
                        type="button"
                        aria-label={`Mark ${ex.name} skipped`}
                        disabled={markProgress.isPending}
                        onClick={() => markProgress.mutate({ assignmentId: workout.id, exerciseId: ex.exerciseId, status: 'SKIPPED' })}
                        className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border bg-card text-sm font-semibold text-muted-foreground transition active:scale-[0.97] hover:bg-accent disabled:opacity-60"
                      >
                        <SkipForward className="size-4" /> Skip
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </motion.div>
        {/* Dropped: sets/reps/rest per exercise — the member endpoint exposes only name + day, so none are shown. */}
      </SectionCard>
    </div>
  );
}
