'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarCheck, CheckCheck, Dumbbell, Flame, MessageSquareQuote, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { useCompleteWorkoutDay, useDeleteWorkoutLog, useLogWorkout, useMemberWorkout, useResetWorkoutDay } from '../../hooks/use-member-portal';
import { formatDate } from '../../lib/format';
import { describeTarget, shortDay, type TrackingDay, type TrackingExercise, type WorkoutCompleteInput } from '../../lib/workout-tracking';
import { EmptyBlock, HeroAction, HeroChip, PortalHero, ProgressRing, SectionCard, SkeletonCard, SkeletonHero, StatusChip } from '../kit';
import { CompleteSheet } from '../workout/complete-sheet';
import { ExerciseCard } from '../workout/exercise-card';
import { HistorySection } from '../workout/history-section';
import { InsightsCard } from '../workout/insights-card';
import { LogSheet, type LogDetails } from '../workout/log-sheet';
import { ProgressSection } from '../workout/progress-section';
import { WeekStrip, addDays, weekStartOf } from '../workout/week-strip';
import { PressButton } from '../workout/workout-motion';

const cap = (s: string) => s.toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/**
 * Member workout page. Reads `GET /portal/workout` (legacy plan + the additive
 * `tracking` block) and writes through the daily log endpoints
 * (`POST/PATCH/DELETE /portal/workout/log*`), each of which returns the refreshed
 * payload straight into the cache. Day picker -> big exercise cards (Done / Skip /
 * Undo, optional sets/reps/weight sheet), Finish workout (+ duration, effort 1-5),
 * progress visuals, rule-based advice, history. The member id only ever comes from
 * the token; every figure shown is derived from the member's real logs.
 */
export function WorkoutPageContent() {
  const { data: workout, isLoading } = useMemberWorkout();
  const log = useLogWorkout();
  const undo = useDeleteWorkoutLog();
  const complete = useCompleteWorkoutDay();
  const reset = useResetWorkoutDay();
  const m = useMotionSafe();

  const [picked, setPicked] = React.useState<string | null>(null);
  const [viewWeek, setViewWeek] = React.useState<string | null>(null);
  const [detailsFor, setDetailsFor] = React.useState<TrackingExercise | null>(null);
  const [completeOpen, setCompleteOpen] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);

  const tracking = workout?.tracking;
  const today = tracking?.today ?? '';
  const selectedDate = picked && tracking?.days.some((d) => d.date === picked) ? picked : today;
  const day: TrackingDay | undefined = tracking?.days.find((d) => d.date === selectedDate);
  const todayDay = tracking?.days.find((d) => d.date === today);

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
          <EmptyBlock icon={Dumbbell} title="Your trainer hasn't assigned a plan yet" description="Once a plan is assigned, you can log each day's workout and track your progress here." />
        </SectionCard>
      </div>
    );
  }
  if (!tracking || !day || !todayDay) {
    return (
      <div className="space-y-4">
        <PortalHero eyebrow="Workout plan" title={workout.workoutPlan.name} subtitle={`${cap(workout.workoutPlan.level)} · ${workout.workoutPlan.durationWeeks} weeks`} />
        <SectionCard title="Workout tracking" icon={Dumbbell} tone="primary">
          <EmptyBlock icon={Dumbbell} title="Tracking isn't available right now" description="Please refresh in a moment." />
        </SectionCard>
      </div>
    );
  }

  const week = tracking.week;
  const weekStart = viewWeek ?? weekStartOf(selectedDate);
  const currentWeekStart = weekStartOf(today);
  const busy = log.isPending || undo.isPending || complete.isPending || reset.isPending;

  // Optimistic feel: show the requested status straight away while the request is in flight.
  const shownStatus = (ex: TrackingExercise): TrackingExercise['status'] => {
    const v = log.isPending ? log.variables : undefined;
    if (v && v.exerciseId === ex.exerciseId && (v.date ?? today) === day.date) return v.status;
    if (undo.isPending && undo.variables === ex.logId) return 'PENDING';
    return ex.status;
  };

  const remaining = day.exercises.filter((e) => e.status === 'PENDING').length;
  const lockedReason = day.isFuture ? 'You can log this on the day.' : `Logging is open for the last ${tracking.backdateDays} days.`;
  const dayTitle = day.isToday ? `Today · ${day.label}` : `${day.label} · ${shortDay(day.date)}`;
  const planStarts = day.state === 'OUTSIDE' ? workout.startDate : null;

  const mark = (ex: TrackingExercise, status: 'COMPLETED' | 'SKIPPED') =>
    log.mutate({ exerciseId: ex.exerciseId, date: day.date, status }, { onError: (err) => toast.error(err.message || 'Could not save. Please try again.') });

  const heroTitle = todayDay.plannedCount ? (todayDay.focus ? `${todayDay.focus} day` : 'Today’s workout') : 'Rest day';
  const heroSubtitle = !todayDay.plannedCount
    ? tracking.nextDay
      ? `Recover well - next up ${tracking.nextDay.label}${tracking.nextDay.focus ? `: ${tracking.nextDay.focus}` : ''}`
      : 'Nothing scheduled today'
    : todayDay.state === 'DONE'
      ? 'Workout complete - great job today'
      : `${todayDay.completedCount + todayDay.skippedCount} of ${todayDay.plannedCount} exercises logged`;

  return (
    <div className="space-y-4">
      <PortalHero
        eyebrow={workout.workoutPlan.name}
        title={heroTitle}
        subtitle={heroSubtitle}
        chips={
          <>
            <HeroChip>{cap(workout.workoutPlan.level)}</HeroChip>
            <HeroChip>Started {formatDate(workout.startDate)}</HeroChip>
            {workout.endDate ? <HeroChip>Ends {formatDate(workout.endDate)}</HeroChip> : null}
            {tracking.streak > 0 ? (
              <HeroChip>
                <Flame className="size-3.5" aria-hidden /> {tracking.streak} in a row
              </HeroChip>
            ) : null}
          </>
        }
        aside={
          <ProgressRing value={week.completionPercent} size={84} thickness={9} onDark>
            <span className="text-lg font-semibold tabular-nums">{week.completionPercent}%</span>
          </ProgressRing>
        }
        stats={[
          { label: 'Sessions', value: week.completedSessions, format: (n) => `${Math.round(n)}/${week.plannedSessions}`, hidden: week.plannedSessions === 0 },
          { label: 'This week', value: week.completedExercises, format: (n) => `${Math.round(n)}/${week.plannedExercises}`, hidden: week.plannedExercises === 0 },
          { label: 'Streak', value: tracking.streak },
        ]}
        actions={
          todayDay.plannedCount && todayDay.state !== 'DONE' ? (
            <HeroAction
              variant="solid"
              onClick={() => {
                setPicked(today);
                setViewWeek(null);
                setCompleteOpen(true);
              }}
            >
              <CheckCheck className="size-4" /> Finish today&apos;s workout
            </HeroAction>
          ) : null
        }
      />

      {workout.trainerRemarks ? (
        <SectionCard title="Trainer remarks" icon={MessageSquareQuote} tone="warning">
          <p className="whitespace-pre-line text-sm leading-relaxed">{workout.trainerRemarks}</p>
        </SectionCard>
      ) : null}

      <SectionCard title="Your week" subtitle="Pick a day to log it" icon={CalendarCheck} tone="primary">
        <WeekStrip
          days={tracking.days}
          selected={selectedDate}
          onSelect={setPicked}
          weekStart={weekStart}
          onWeekChange={(start) => {
            setViewWeek(start);
            // Keep a day of the viewed week selected.
            const first = tracking.days.find((d) => d.date >= start && d.date <= addDays(start, 6));
            if (first) setPicked(first.date <= today && start === currentWeekStart ? today : first.date);
          }}
          currentWeekStart={currentWeekStart}
        />

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{dayTitle}</p>
            <p className="text-xs text-muted-foreground">{day.plannedCount ? `${day.focus ? `${day.focus} · ` : ''}${day.plannedCount} ${day.plannedCount === 1 ? 'exercise' : 'exercises'}` : 'Rest day'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {day.session?.durationMin ? <StatusChip tone="info">{day.session.durationMin} min</StatusChip> : null}
            {day.session?.effort ? <StatusChip tone="violet">Effort {day.session.effort}/5</StatusChip> : null}
            <StatusChip tone={day.state === 'DONE' ? 'success' : day.state === 'MISSED' ? 'danger' : day.state === 'PARTIAL' ? 'warning' : 'muted'}>
              {day.plannedCount === 0 ? 'Rest' : day.state === 'DONE' ? 'Done' : day.state === 'MISSED' ? 'Missed' : `${day.completedCount + day.skippedCount}/${day.plannedCount} logged`}
            </StatusChip>
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={day.date} initial={m.reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={m.reduce ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="mt-3 space-y-3">
            {planStarts ? (
              <EmptyBlock compact icon={CalendarCheck} title="Your plan hasn't started" description={`It starts on ${formatDate(planStarts)}.`} />
            ) : day.plannedCount === 0 ? (
              <EmptyBlock compact icon={Dumbbell} tone="success" title="Rest day" description="Nothing scheduled - recover well." />
            ) : (
              <>
                {day.exercises.map((ex, i) => (
                  <ExerciseCard
                    key={ex.exerciseId}
                    exercise={ex}
                    index={i}
                    shown={shownStatus(ex)}
                    canLog={day.canLog}
                    lockedReason={lockedReason}
                    busy={busy}
                    onDone={() => mark(ex, 'COMPLETED')}
                    onSkip={() => mark(ex, 'SKIPPED')}
                    onUndo={() => ex.logId && undo.mutate(ex.logId, { onError: (err) => toast.error(err.message || 'Could not undo. Please try again.') })}
                    onDetails={() => setDetailsFor(ex)}
                  />
                ))}
                {day.canLog ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {day.state !== 'DONE' ? (
                      <PressButton
                        disabled={busy}
                        onClick={() => setCompleteOpen(true)}
                        className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-primary-foreground shadow-md"
                        style={{ background: 'linear-gradient(135deg, var(--primary), color-mix(in oklab, var(--primary) 55%, var(--chart-7)))' }}
                      >
                        <CheckCheck className="size-4" /> Finish workout
                      </PressButton>
                    ) : (
                      <PressButton disabled={busy} onClick={() => setCompleteOpen(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border bg-card px-4 text-sm font-semibold hover:bg-accent">
                        <CheckCheck className="size-4" /> Edit duration &amp; effort
                      </PressButton>
                    )}
                    {day.completedCount + day.skippedCount > 0 || day.session ? (
                      <PressButton disabled={busy} onClick={() => setResetOpen(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-muted-foreground hover:bg-accent">
                        <RotateCcw className="size-4" /> Reset day
                      </PressButton>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </SectionCard>

      <ProgressSection tracking={tracking} />
      <InsightsCard insights={tracking.insights} />
      <HistorySection />

      <LogSheet
        open={!!detailsFor}
        onOpenChange={(o) => !o && setDetailsFor(null)}
        title={detailsFor?.name ?? 'Exercise details'}
        description={detailsFor ? `${dayTitle} - saving marks it done.` : undefined}
        initial={
          detailsFor
            ? detailsFor.status === 'COMPLETED'
              ? { setsDone: detailsFor.setsDone, repsDone: detailsFor.repsDone, weightKg: detailsFor.weightKg, durationMin: detailsFor.durationMin, notes: detailsFor.logNotes }
              : { setsDone: detailsFor.sets, repsDone: detailsFor.reps }
            : null
        }
        hint={detailsFor && describeTarget(detailsFor) ? `Plan: ${describeTarget(detailsFor)}` : null}
        submitLabel={detailsFor?.status === 'COMPLETED' ? 'Save changes' : 'Save as done'}
        onSave={async (d: LogDetails) => {
          if (!detailsFor) return;
          await log.mutateAsync({ exerciseId: detailsFor.exerciseId, date: day.date, status: 'COMPLETED', ...d });
          toast.success('Saved - nice work!');
        }}
      />

      <CompleteSheet
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        dayLabel={day.isToday ? 'today' : day.label}
        remaining={remaining}
        onComplete={async (input: Pick<WorkoutCompleteInput, 'durationMin' | 'effort' | 'notes'>) => {
          const r = await complete.mutateAsync({ date: day.date, ...input });
          toast.success(r.completedNow > 0 ? `Workout complete - ${r.completedNow} ${r.completedNow === 1 ? 'exercise' : 'exercises'} marked done` : 'Workout saved');
        }}
      />

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset this day?"
        description={`Everything you logged for ${day.isToday ? 'today' : day.label} (exercises, duration and effort) will be cleared.`}
        confirmLabel="Reset day"
        destructive
        loading={reset.isPending}
        onConfirm={() =>
          reset.mutate(day.date, {
            onSuccess: () => {
              toast.success('Day cleared');
              setResetOpen(false);
            },
            onError: (err) => toast.error(err.message || 'Could not reset the day.'),
          })
        }
      />
    </div>
  );
}

