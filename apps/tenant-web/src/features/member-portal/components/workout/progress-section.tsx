'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Activity, Clock, Dumbbell, Flame, Medal, Trophy, Weight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { AnimatedNumber, ProgressRing, SectionCard, StaggerGroup, StatTile, toneColor, toneTint, type PortalTone } from '../kit';
import { shortDay, weekdayShort, type ConsistencyWeek, type DayState, type ExerciseStat, type TrackingDay, type WorkoutTracking } from '../../lib/workout-tracking';
import { Pop, useBounce } from './workout-motion';

const DOT_TONE: Partial<Record<DayState, PortalTone>> = { DONE: 'success', PARTIAL: 'warning', MISSED: 'danger', SKIPPED: 'muted', TODAY: 'primary' };

/** Last 7 days up to today: filled = completed session, half = unfinished, red ring = missed, grey = rest. */
export function StreakDots({ days, today }: { days: TrackingDay[]; today: string }) {
  const last7 = days.filter((d) => d.date <= today).slice(-7);
  return (
    <div className="flex items-end justify-between gap-1" role="list" aria-label="Last 7 days">
      {last7.map((d, i) => {
        const tone = DOT_TONE[d.state];
        const rest = d.state === 'REST' || d.state === 'OUTSIDE';
        return (
          <Pop key={d.date} delay={i * 0.05} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span
              role="listitem"
              aria-label={`${d.label}: ${rest ? 'rest day' : d.state.toLowerCase()}`}
              className={cn('grid size-8 place-items-center rounded-full border-2 text-[10px] font-bold text-white', rest && 'border-dashed')}
              style={{
                borderColor: tone ? toneColor(tone) : 'color-mix(in oklab, var(--muted-foreground) 35%, transparent)',
                background: d.state === 'DONE' ? `linear-gradient(135deg, ${toneColor('success')}, color-mix(in oklab, ${toneColor('success')} 60%, white))` : d.state === 'PARTIAL' ? `linear-gradient(90deg, ${toneColor('warning')} 50%, transparent 50%)` : 'transparent',
              }}
            >
              {d.state === 'DONE' ? '✓' : ''}
            </span>
            <span className={cn('text-[10px] font-medium uppercase', d.isToday ? 'text-primary' : 'text-muted-foreground')}>{weekdayShort(d.date).slice(0, 3)}</span>
          </Pop>
        );
      })}
    </div>
  );
}

/** Eight weeks of "sessions completed of those due". The current week is marked "so far". */
export function ConsistencyBars({ weeks }: { weeks: ConsistencyWeek[] }) {
  const b = useBounce();
  return (
    <div>
      <div className="flex h-32 items-end gap-1.5" role="img" aria-label={`Consistency over the last ${weeks.length} weeks`}>
        {weeks.map((w, i) => {
          const pct = w.percent;
          const tone: PortalTone = pct === null ? 'muted' : pct >= 75 ? 'success' : pct >= 40 ? 'warning' : 'danger';
          return (
            <div key={w.weekStart} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{pct === null ? '' : `${pct}%`}</span>
              {pct === null ? (
                <span className="h-1 w-full rounded-full border-t-2 border-dashed border-muted-foreground/30" aria-label="no sessions planned" />
              ) : (
                <motion.div
                  className="w-full rounded-t-lg"
                  style={{ transformOrigin: 'bottom', height: `${Math.max(pct, 6)}%`, background: `linear-gradient(180deg, color-mix(in oklab, ${toneColor(tone)} 70%, white), ${toneColor(tone)})`, opacity: w.isCurrent ? 1 : 0.85 }}
                  initial={{ scaleY: b.reduce ? 1 : 0 }}
                  animate={{ scaleY: 1 }}
                  transition={b.reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 12, delay: i * 0.06 }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {weeks.map((w) => (
          <span key={w.weekStart} className={cn('min-w-0 flex-1 truncate text-center text-[10px]', w.isCurrent ? 'font-semibold text-primary' : 'text-muted-foreground')}>
            {w.isCurrent ? 'Now' : shortDay(w.weekStart).replace(/ \w+$/, '')}
          </span>
        ))}
      </div>
    </div>
  );
}

function chipTone(s: ExerciseStat): PortalTone {
  if (s.planned === 0) return 'muted';
  const rate = s.completed / s.planned;
  return rate >= 0.75 ? 'success' : rate >= 0.4 ? 'warning' : 'danger';
}

/** One chip per exercise of the plan: completed / due over the last 4 weeks, with skips called out. */
export function ExerciseChips({ stats }: { stats: ExerciseStat[] }) {
  if (!stats.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {stats.map((s, i) => {
        const tone = chipTone(s);
        return (
          <Pop key={s.exerciseId} delay={Math.min(i, 10) * 0.04}>
            <span
              className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-full border px-3 text-xs font-medium"
              style={{ background: toneTint(tone, 12), borderColor: toneTint(tone, 40) }}
              title={s.planned ? `${s.completed} of ${s.planned} done${s.skipped ? `, ${s.skipped} skipped` : ''}` : 'Not due yet'}
            >
              <span className="truncate">{s.name}</span>
              <span className="shrink-0 font-semibold tabular-nums" style={{ color: toneColor(tone) }}>
                {s.planned ? `${s.completed}/${s.planned}` : '-'}
              </span>
              {s.skipped > 0 ? <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">{s.skipped} skipped</span> : null}
            </span>
          </Pop>
        );
      })}
    </div>
  );
}

function MuscleBars({ groups }: { groups: WorkoutTracking['muscleGroups'] }) {
  const b = useBounce();
  const shown = groups.filter((g) => g.planned > 0);
  if (!shown.length) return null;
  return (
    <ul className="space-y-2.5">
      {shown.map((g, i) => {
        const pct = Math.round((100 * g.completed) / g.planned);
        const tone: PortalTone = pct >= 75 ? 'success' : pct >= 40 ? 'warning' : 'danger';
        return (
          <li key={g.name}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium">{g.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {g.completed}/{g.planned} · {pct}%
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${g.name} completion`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <motion.div
                className="h-full w-full rounded-full"
                style={{ transformOrigin: 'left', background: `linear-gradient(90deg, ${toneColor(tone)}, color-mix(in oklab, ${toneColor(tone)} 55%, white))` }}
                initial={{ scaleX: b.reduce ? pct / 100 : 0 }}
                animate={{ scaleX: pct / 100 }}
                transition={b.reduce ? { duration: 0 } : { type: 'spring', stiffness: 90, damping: 14, delay: i * 0.07 }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Weekly ring + count-up tiles + streak dots + consistency bars + per-exercise chips (all from real logs). */
export function ProgressSection({ tracking }: { tracking: WorkoutTracking }) {
  const { week, last30 } = tracking;
  const hasPlan = week.plannedSessions > 0;
  return (
    <div className="space-y-4">
      <SectionCard title="This week" subtitle={`${shortDay(week.start)} - ${shortDay(week.end)}`} icon={Activity} tone="success">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <ProgressRing value={week.completionPercent} size={132} thickness={13} tone="success">
            <div>
              <p className="text-3xl font-semibold tabular-nums leading-none">
                <AnimatedNumber value={week.completionPercent} format={(n) => `${Math.round(n)}%`} />
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {week.completedExercises}/{week.plannedExercises} exercises
              </p>
            </div>
          </ProgressRing>
          <div className="w-full min-w-0 flex-1">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Last 7 days</p>
            <StreakDots days={tracking.days} today={tracking.today} />
          </div>
        </div>
      </SectionCard>

      <StaggerGroup className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Sessions this week" value={week.completedSessions} format={(n) => `${Math.round(n)}/${week.plannedSessions}`} icon={Trophy} tone="success" progress={hasPlan ? (100 * week.completedSessions) / week.plannedSessions : null} hint={hasPlan ? 'Planned days finished' : 'No training days'} />
        <StatTile label="Streak" value={tracking.streak} format={(n) => `${Math.round(n)}`} icon={Flame} tone="orange" hint={tracking.streak === 1 ? 'planned session in a row' : 'planned sessions in a row'} />
        <StatTile label="Done · 30 days" value={last30.exercisesCompleted} icon={Dumbbell} tone="info" hint={`${last30.sessionsDone} full ${last30.sessionsDone === 1 ? 'session' : 'sessions'}`} />
        {last30.minutes !== null ? <StatTile label="Minutes · 30 days" value={last30.minutes} icon={Clock} tone="violet" hint="From durations you logged" /> : last30.avgEffort !== null ? <StatTile label="Avg effort" value={last30.avgEffort} format={(n) => `${n.toFixed(1)}/5`} icon={Activity} tone="violet" hint="From your session ratings" /> : <StatTile label="Skipped · this week" value={week.skippedExercises} icon={Activity} tone="violet" hint="Exercises skipped" />}
        {last30.volumeKg !== null ? <StatTile label="Volume · 30 days" value={last30.volumeKg} format={(n) => `${Math.round(n).toLocaleString()} kg`} icon={Weight} tone="primary" hint="Sets x reps x kg you logged" /> : null}
      </StaggerGroup>

      <SectionCard title="Consistency" subtitle="Planned sessions you completed, last 8 weeks" icon={Medal} tone="primary">
        <ConsistencyBars weeks={tracking.consistency} />
      </SectionCard>

      <SectionCard title="Your exercises" subtitle="Done / due over the last 4 weeks" icon={Dumbbell} tone="info">
        <div className="space-y-5">
          <ExerciseChips stats={tracking.exercises} />
          <MuscleBars groups={tracking.muscleGroups} />
          {tracking.personalBests.length ? (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Personal bests (heaviest weight you logged)</p>
              <ul className="space-y-1.5">
                {tracking.personalBests.map((p) => (
                  <li key={p.exerciseId} className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <Trophy className="size-4 shrink-0" style={{ color: toneColor('warning') }} aria-hidden />
                      <span className="truncate font-medium">{p.name}</span>
                      {p.isNew ? <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase text-white" style={{ background: toneColor('success') }}>New</span> : null}
                    </span>
                    <span className="shrink-0 tabular-nums font-semibold">
                      {p.weightKg} kg{p.repsDone ? ` x ${p.repsDone}` : ''} <span className="text-xs font-normal text-muted-foreground">· {shortDay(p.date)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
