import { ValidationError } from '../../../core/errors/app-error';

import { dayOfRecordedAt, dayToDate } from './member-measurement.util';

/**
 * Pure maths for the member's workout self-tracking (no I/O): day resolution,
 * the per-day state machine, weekly ring / streak / consistency, skip stats,
 * personal bests and the rule-based "what to do for better results" insights.
 * Every figure is derived from real logs - nothing is estimated or invented.
 *
 * All dates are plain `YYYY-MM-DD` calendar days in the member's branch
 * timezone ("today" is supplied by the caller); weeks run Monday to Sunday.
 */

/** How many days back a member may log / correct a workout day. */
export const WORKOUT_LOG_BACKDATE_DAYS = 14;
/** How many weeks of logs feed the weekly stats and the streak. */
export const TRACKING_WEEKS_LOADED = 12;
/** How many weeks the consistency chart shows (current week included). */
export const CONSISTENCY_WEEKS = 8;
/** Look-back for the per-exercise / per-muscle-group skip stats. */
export const SKIP_LOOKBACK_DAYS = 28;
export const MAX_INSIGHTS = 4;

const DAY_MS = 86_400_000;

export const WEEK_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
export type WeekDayName = (typeof WEEK_DAYS)[number];

const WEEKDAY_LABEL: Record<WeekDayName, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};

// ── calendar helpers ───────────────────────────────────────────────────────

export function addDays(day: string, n: number): string {
  return new Date(dayToDate(day).getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((dayToDate(b).getTime() - dayToDate(a).getTime()) / DAY_MS);
}

export function weekdayOf(day: string): WeekDayName {
  const sundayFirst = dayToDate(day).getUTCDay();
  return WEEK_DAYS[(sundayFirst + 6) % 7] as WeekDayName;
}

export function weekdayLabel(weekday: WeekDayName): string {
  return WEEKDAY_LABEL[weekday];
}

/** The Monday of the week containing `day`. */
export function weekStartOf(day: string): string {
  return addDays(day, -((dayToDate(day).getUTCDay() + 6) % 7));
}

/** Strict `YYYY-MM-DD` check (real calendar day). */
export function isCalendarDay(raw: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) && dayOfRecordedAt(raw) === raw;
}

/**
 * Resolves the day for a workout log: defaults to `today` (the member's
 * branch-local date), rejects malformed dates, the future and anything older
 * than {@link WORKOUT_LOG_BACKDATE_DAYS}.
 */
export function resolveWorkoutLogDay(raw: string | undefined, today: string): string {
  const day = raw === undefined ? today : isCalendarDay(raw.trim()) ? raw.trim() : null;
  if (!day) throw new ValidationError('Enter a valid date.');
  if (day > today) throw new ValidationError('You can’t log a workout for a future date.');
  if (daysBetween(day, today) > WORKOUT_LOG_BACKDATE_DAYS) {
    throw new ValidationError(`You can only log or change a workout up to ${WORKOUT_LOG_BACKDATE_DAYS} days back.`);
  }
  return day;
}

// ── inputs ─────────────────────────────────────────────────────────────────

export interface PlanExerciseInfo {
  exerciseId: string;
  name: string;
  muscleGroup: string | null;
  dayOfWeek: WeekDayName;
  sortOrder: number;
  sets: number | null;
  reps: number | null;
  restSeconds: number | null;
  notes: string | null;
}

export type LogStatus = 'COMPLETED' | 'SKIPPED';

export interface WorkoutLogEntry {
  id: string;
  assignmentId: string;
  /** `YYYY-MM-DD` */
  date: string;
  exerciseId: string;
  status: LogStatus;
  setsDone: number | null;
  repsDone: number | null;
  weightKg: number | null;
  durationMin: number | null;
  notes: string | null;
}

export interface WorkoutSessionEntry {
  id: string;
  date: string;
  durationMin: number | null;
  effort: number | null;
  notes: string | null;
}

export interface WeightedLog {
  exerciseId: string;
  exerciseName: string;
  date: string;
  weightKg: number;
  repsDone: number | null;
}

export interface TrackingInput {
  today: string;
  assignment: { id: string; startDate: string; endDate: string | null };
  schedule: PlanExerciseInfo[];
  /** Logs inside the loaded window (any assignment). */
  logs: WorkoutLogEntry[];
  sessions: WorkoutSessionEntry[];
  /** Every COMPLETED log that carries a weight (all time, ascending by date). */
  weighted: WeightedLog[];
  /** True when the member has ever logged anything (not just inside the window). */
  everLogged: boolean;
}

// ── outputs ────────────────────────────────────────────────────────────────

export type DayState = 'REST' | 'OUTSIDE' | 'UPCOMING' | 'TODAY' | 'DONE' | 'PARTIAL' | 'SKIPPED' | 'MISSED';

export interface TrackingExercise {
  exerciseId: string;
  name: string;
  muscleGroup: string | null;
  sets: number | null;
  reps: number | null;
  restSeconds: number | null;
  notes: string | null;
  status: 'PENDING' | LogStatus;
  logId: string | null;
  setsDone: number | null;
  repsDone: number | null;
  weightKg: number | null;
  durationMin: number | null;
  logNotes: string | null;
}

export interface TrackingSession {
  durationMin: number | null;
  effort: number | null;
  notes: string | null;
}

export interface TrackingDay {
  date: string;
  weekday: WeekDayName;
  label: string;
  isToday: boolean;
  isFuture: boolean;
  /** Planned, not in the future and inside the back-date window. */
  canLog: boolean;
  state: DayState;
  focus: string | null;
  plannedCount: number;
  completedCount: number;
  skippedCount: number;
  percent: number;
  exercises: TrackingExercise[];
  session: TrackingSession | null;
}

export interface WeekSummary {
  start: string;
  end: string;
  plannedSessions: number;
  completedSessions: number;
  plannedExercises: number;
  completedExercises: number;
  skippedExercises: number;
  completionPercent: number;
}

export interface NextDay {
  date: string;
  weekday: WeekDayName;
  label: string;
  isToday: boolean;
  focus: string | null;
  plannedCount: number;
}

export interface ConsistencyWeek {
  weekStart: string;
  isCurrent: boolean;
  plannedSessions: number;
  completedSessions: number;
  /** done / planned-so-far, null when nothing was planned yet. */
  percent: number | null;
}

export interface ExerciseStat {
  exerciseId: string;
  name: string;
  muscleGroup: string | null;
  planned: number;
  completed: number;
  skipped: number;
}

export interface MuscleGroupStat {
  name: string;
  planned: number;
  completed: number;
  skipped: number;
}

export interface PersonalBest {
  exerciseId: string;
  name: string;
  weightKg: number;
  repsDone: number | null;
  date: string;
  /** Beat a lower earlier weight within the last 7 days. */
  isNew: boolean;
}

export interface Last30 {
  sessionsDone: number;
  exercisesCompleted: number;
  /** Only when durations were logged. */
  minutes: number | null;
  /** Sum of sets x reps x kg over entries that carry all three. */
  volumeKg: number | null;
  avgEffort: number | null;
}

export type InsightTone = 'good' | 'warn' | 'tip';

export interface Insight {
  tone: InsightTone;
  title: string;
  body: string;
}

export interface WorkoutTracking {
  today: string;
  backdateDays: number;
  /** Earliest day a member may still log. */
  windowStart: string;
  everLogged: boolean;
  days: TrackingDay[];
  week: WeekSummary;
  nextDay: NextDay | null;
  streak: number;
  consistency: ConsistencyWeek[];
  exercises: ExerciseStat[];
  muscleGroups: MuscleGroupStat[];
  mostSkipped: ExerciseStat[];
  last30: Last30;
  personalBests: PersonalBest[];
  insights: Insight[];
}

// ── context ────────────────────────────────────────────────────────────────

interface Ctx {
  input: TrackingInput;
  byWeekday: Map<WeekDayName, PlanExerciseInfo[]>;
  /** `${date}|${exerciseId}` -> log of the current assignment. */
  logIndex: Map<string, WorkoutLogEntry>;
  sessionByDate: Map<string, WorkoutSessionEntry>;
}

function buildCtx(input: TrackingInput): Ctx {
  const byWeekday = new Map<WeekDayName, PlanExerciseInfo[]>();
  const sorted = [...input.schedule].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
  for (const e of sorted) {
    const list = byWeekday.get(e.dayOfWeek) ?? [];
    // The same exercise twice on one weekday collapses to one (the log key is per exercise per day).
    if (!list.some((x) => x.exerciseId === e.exerciseId)) list.push(e);
    byWeekday.set(e.dayOfWeek, list);
  }
  const logIndex = new Map<string, WorkoutLogEntry>();
  for (const l of input.logs) {
    if (l.assignmentId === input.assignment.id) logIndex.set(`${l.date}|${l.exerciseId}`, l);
  }
  const sessionByDate = new Map(input.sessions.map((s) => [s.date, s]));
  return { input, byWeekday, logIndex, sessionByDate };
}

interface DayEval {
  planned: PlanExerciseInfo[];
  completed: number;
  skipped: number;
  state: DayState;
}

function evalDay(ctx: Ctx, date: string): DayEval {
  const { today, assignment } = ctx.input;
  const raw = ctx.byWeekday.get(weekdayOf(date)) ?? [];
  if (raw.length === 0) return { planned: [], completed: 0, skipped: 0, state: 'REST' };
  if (date < assignment.startDate || (assignment.endDate !== null && date > assignment.endDate)) {
    return { planned: [], completed: 0, skipped: 0, state: 'OUTSIDE' };
  }
  let completed = 0;
  let skipped = 0;
  for (const e of raw) {
    const log = ctx.logIndex.get(`${date}|${e.exerciseId}`);
    if (log?.status === 'COMPLETED') completed += 1;
    else if (log?.status === 'SKIPPED') skipped += 1;
  }
  const logged = completed + skipped;
  let state: DayState;
  if (completed >= 1 && logged === raw.length) state = 'DONE';
  else if (completed === 0 && logged === raw.length) state = 'SKIPPED';
  else if (logged > 0) state = 'PARTIAL';
  else if (date > today) state = 'UPCOMING';
  else if (date === today) state = 'TODAY';
  else state = 'MISSED';
  return { planned: raw, completed, skipped, state };
}

/** The muscle group most of the day's exercises train (null when none is set). */
export function focusOf(exercises: Pick<PlanExerciseInfo, 'muscleGroup'>[]): string | null {
  const counts = new Map<string, number>();
  for (const e of exercises) {
    const g = e.muscleGroup?.trim();
    if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [g, n] of counts) {
    if (n > bestN) {
      best = g;
      bestN = n;
    }
  }
  return best;
}

function buildDay(ctx: Ctx, date: string): TrackingDay {
  const { today } = ctx.input;
  const ev = evalDay(ctx, date);
  const weekday = weekdayOf(date);
  const windowStart = addDays(today, -WORKOUT_LOG_BACKDATE_DAYS);
  const session = ctx.sessionByDate.get(date);
  return {
    date,
    weekday,
    label: weekdayLabel(weekday),
    isToday: date === today,
    isFuture: date > today,
    canLog: ev.planned.length > 0 && date <= today && date >= windowStart,
    state: ev.state,
    focus: focusOf(ev.planned),
    plannedCount: ev.planned.length,
    completedCount: ev.completed,
    skippedCount: ev.skipped,
    percent: ev.planned.length ? Math.round((100 * ev.completed) / ev.planned.length) : 0,
    exercises: ev.planned.map((e) => {
      const log = ctx.logIndex.get(`${date}|${e.exerciseId}`);
      return {
        exerciseId: e.exerciseId,
        name: e.name,
        muscleGroup: e.muscleGroup,
        sets: e.sets,
        reps: e.reps,
        restSeconds: e.restSeconds,
        notes: e.notes,
        status: log ? log.status : 'PENDING',
        logId: log?.id ?? null,
        setsDone: log?.setsDone ?? null,
        repsDone: log?.repsDone ?? null,
        weightKg: log?.weightKg ?? null,
        durationMin: log?.durationMin ?? null,
        logNotes: log?.notes ?? null,
      };
    }),
    session: session ? { durationMin: session.durationMin, effort: session.effort, notes: session.notes } : null,
  };
}

// ── aggregates ─────────────────────────────────────────────────────────────

function weekSummary(ctx: Ctx, start: string): WeekSummary {
  let plannedSessions = 0;
  let completedSessions = 0;
  let plannedExercises = 0;
  let completedExercises = 0;
  let skippedExercises = 0;
  for (let i = 0; i < 7; i += 1) {
    const ev = evalDay(ctx, addDays(start, i));
    if (ev.planned.length === 0) continue;
    plannedSessions += 1;
    if (ev.state === 'DONE') completedSessions += 1;
    plannedExercises += ev.planned.length;
    completedExercises += ev.completed;
    skippedExercises += ev.skipped;
  }
  return {
    start,
    end: addDays(start, 6),
    plannedSessions,
    completedSessions,
    plannedExercises,
    completedExercises,
    skippedExercises,
    completionPercent: plannedExercises ? Math.round((100 * completedExercises) / plannedExercises) : 0,
  };
}

/** First planned, unfinished day from today on (today included) within two weeks. */
function findNextDay(ctx: Ctx): NextDay | null {
  const { today } = ctx.input;
  for (let i = 0; i < 14; i += 1) {
    const date = addDays(today, i);
    const ev = evalDay(ctx, date);
    if (ev.planned.length === 0 || ev.state === 'DONE') continue;
    const weekday = weekdayOf(date);
    return {
      date,
      weekday,
      label: weekdayLabel(weekday),
      isToday: i === 0,
      focus: focusOf(ev.planned),
      plannedCount: ev.planned.length,
    };
  }
  return null;
}

/** Consecutive planned days completed, newest first; an unfinished today does not break it. */
function computeStreak(ctx: Ctx): number {
  const { today, assignment } = ctx.input;
  const floor = addDays(today, -7 * TRACKING_WEEKS_LOADED);
  let streak = 0;
  for (let d = today; d >= floor && d >= assignment.startDate; d = addDays(d, -1)) {
    const ev = evalDay(ctx, d);
    if (ev.planned.length === 0) continue;
    if (ev.state === 'DONE') streak += 1;
    else if (d === today && (ev.state === 'TODAY' || ev.state === 'PARTIAL')) continue;
    else break;
  }
  return streak;
}

function computeConsistency(ctx: Ctx): ConsistencyWeek[] {
  const { today } = ctx.input;
  const currentStart = weekStartOf(today);
  const out: ConsistencyWeek[] = [];
  for (let i = CONSISTENCY_WEEKS - 1; i >= 0; i -= 1) {
    const weekStart = addDays(currentStart, -7 * i);
    let planned = 0;
    let elapsed = 0;
    let done = 0;
    for (let k = 0; k < 7; k += 1) {
      const date = addDays(weekStart, k);
      const ev = evalDay(ctx, date);
      if (ev.planned.length === 0) continue;
      planned += 1;
      // Only days that have already fallen due count against the member.
      if (date < today || (date === today && ev.state === 'DONE')) {
        elapsed += 1;
        if (ev.state === 'DONE') done += 1;
      }
    }
    out.push({
      weekStart,
      isCurrent: i === 0,
      plannedSessions: planned,
      completedSessions: done,
      percent: elapsed ? Math.round((100 * done) / elapsed) : null,
    });
  }
  return out;
}

function computeExerciseStats(ctx: Ctx): { exercises: ExerciseStat[]; muscleGroups: MuscleGroupStat[] } {
  const { today, assignment } = ctx.input;
  const from = addDays(today, -(SKIP_LOOKBACK_DAYS - 1));
  const stats = new Map<string, ExerciseStat>();
  // Stable order: the schedule's own order (Monday first).
  for (const weekday of WEEK_DAYS) {
    for (const e of ctx.byWeekday.get(weekday) ?? []) {
      if (!stats.has(e.exerciseId)) {
        stats.set(e.exerciseId, {
          exerciseId: e.exerciseId,
          name: e.name,
          muscleGroup: e.muscleGroup,
          planned: 0,
          completed: 0,
          skipped: 0,
        });
      }
    }
  }
  for (let d = from < assignment.startDate ? assignment.startDate : from; d <= today; d = addDays(d, 1)) {
    const ev = evalDay(ctx, d);
    for (const e of ev.planned) {
      const log = ctx.logIndex.get(`${d}|${e.exerciseId}`);
      // Today's untouched exercises are not "due" yet.
      if (d === today && !log) continue;
      const s = stats.get(e.exerciseId);
      if (!s) continue;
      s.planned += 1;
      if (log?.status === 'COMPLETED') s.completed += 1;
      else if (log?.status === 'SKIPPED') s.skipped += 1;
    }
  }
  const groups = new Map<string, MuscleGroupStat>();
  for (const s of stats.values()) {
    const name = s.muscleGroup?.trim();
    if (!name) continue;
    const g = groups.get(name) ?? { name, planned: 0, completed: 0, skipped: 0 };
    g.planned += s.planned;
    g.completed += s.completed;
    g.skipped += s.skipped;
    groups.set(name, g);
  }
  return { exercises: [...stats.values()], muscleGroups: [...groups.values()] };
}

function computeLast30(ctx: Ctx): Last30 {
  const { today, logs, sessions } = ctx.input;
  const from = addDays(today, -29);
  let sessionsDone = 0;
  for (let d = from; d <= today; d = addDays(d, 1)) {
    if (evalDay(ctx, d).state === 'DONE') sessionsDone += 1;
  }
  const completed = logs.filter((l) => l.status === 'COMPLETED' && l.date >= from && l.date <= today);

  const minutesByDate = new Map<string, number>();
  for (const s of sessions) {
    if (s.date >= from && s.date <= today && s.durationMin !== null) minutesByDate.set(s.date, s.durationMin);
  }
  const entryMinutes = new Map<string, number>();
  for (const l of completed) {
    if (l.durationMin !== null) entryMinutes.set(l.date, (entryMinutes.get(l.date) ?? 0) + l.durationMin);
  }
  for (const [date, mins] of entryMinutes) if (!minutesByDate.has(date)) minutesByDate.set(date, mins);
  const minutes = minutesByDate.size ? [...minutesByDate.values()].reduce((a, b) => a + b, 0) : null;

  let volume = 0;
  let volumeEntries = 0;
  for (const l of completed) {
    if (l.setsDone !== null && l.repsDone !== null && l.weightKg !== null) {
      volume += l.setsDone * l.repsDone * l.weightKg;
      volumeEntries += 1;
    }
  }
  const efforts = sessions.filter((s) => s.effort !== null && s.date >= from && s.date <= today).map((s) => s.effort as number);
  return {
    sessionsDone,
    exercisesCompleted: completed.length,
    minutes,
    volumeKg: volumeEntries ? Math.round(volume * 10) / 10 : null,
    avgEffort: efforts.length ? Math.round((efforts.reduce((a, b) => a + b, 0) / efforts.length) * 10) / 10 : null,
  };
}

function computePersonalBests(input: TrackingInput): PersonalBest[] {
  const byExercise = new Map<string, WeightedLog[]>();
  for (const w of input.weighted) {
    const list = byExercise.get(w.exerciseId) ?? [];
    list.push(w);
    byExercise.set(w.exerciseId, list);
  }
  const recentFrom = addDays(input.today, -6);
  const out: PersonalBest[] = [];
  for (const [exerciseId, list] of byExercise) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    let best = sorted[0] as WeightedLog;
    for (const w of sorted) if (w.weightKg > best.weightKg) best = w; // earliest date achieving the max
    const earlier = sorted.filter((w) => w.date < best.date);
    const priorMax = earlier.length ? Math.max(...earlier.map((w) => w.weightKg)) : null;
    out.push({
      exerciseId,
      name: best.exerciseName,
      weightKg: best.weightKg,
      repsDone: best.repsDone,
      date: best.date,
      isNew: best.date >= recentFrom && priorMax !== null && best.weightKg > priorMax,
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.weightKg - a.weightKg).slice(0, 5);
}

// ── insights ───────────────────────────────────────────────────────────────

function dayPhrase(next: NextDay): string {
  const possessive = next.isToday ? 'Today’s' : `${next.label}’s`;
  return next.focus ? `${possessive} ${next.focus} day` : `${possessive} workout`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

interface RankedInsight extends Insight {
  priority: number;
}

function buildInsights(
  ctx: Ctx,
  agg: {
    week: WeekSummary;
    nextDay: NextDay | null;
    streak: number;
    consistency: ConsistencyWeek[];
    mostSkipped: ExerciseStat[];
    personalBests: PersonalBest[];
  },
): Insight[] {
  const { today, assignment, everLogged, sessions } = ctx.input;
  const out: RankedInsight[] = [];
  const { week, nextDay, streak, consistency, mostSkipped, personalBests } = agg;

  if (assignment.endDate !== null) {
    const left = daysBetween(today, assignment.endDate);
    if (left >= 0 && left <= 7) {
      out.push({
        priority: 8,
        tone: 'tip',
        title: left === 0 ? 'Your plan ends today' : `Your plan ends in ${plural(left, 'day', 'days')}`,
        body: 'Talk to your trainer about what comes next so there is no gap in your routine.',
      });
    }
  }

  if (!everLogged) {
    out.push({
      priority: 0,
      tone: 'tip',
      title: 'Log your first workout',
      body: nextDay
        ? `${dayPhrase(nextDay)} is ${nextDay.isToday ? 'on the schedule' : 'next'} - ${plural(nextDay.plannedCount, 'exercise', 'exercises')}. Tap Done on each one as you finish it and your progress starts building here.`
        : 'When your plan has scheduled days, tap Done on each exercise as you finish it and your progress starts building here.',
    });
    return finish(out);
  }

  // A recent planned day that was not finished (last 3 days, newest first).
  for (let i = 1; i <= 3; i += 1) {
    const date = addDays(today, -i);
    const ev = evalDay(ctx, date);
    if (ev.planned.length === 0 || ev.state === 'DONE') continue;
    const label = weekdayLabel(weekdayOf(date));
    const title =
      ev.state === 'PARTIAL'
        ? `You didn’t finish ${label}’s workout`
        : ev.state === 'SKIPPED'
          ? `You skipped ${label}’s workout`
          : `You missed ${label}’s workout`;
    out.push({
      priority: 1,
      tone: 'warn',
      title,
      body: `That’s okay - tap that day to log what you did${nextDay ? `, or get back on track with ${dayPhrase(nextDay)}` : ''}.`,
    });
    break;
  }

  if (week.plannedSessions > 0) {
    if (week.completedSessions >= week.plannedSessions) {
      out.push({
        priority: 2,
        tone: 'good',
        title: 'Week complete',
        body: `You finished all ${plural(week.plannedSessions, 'planned session', 'planned sessions')} this week. Nice work - keep the rhythm going.`,
      });
    } else {
      out.push({
        priority: 2,
        tone: 'tip',
        title: `${week.completedSessions} of ${week.plannedSessions} planned sessions done this week`,
        body: nextDay
          ? `${dayPhrase(nextDay)} is next - ${plural(nextDay.plannedCount, 'exercise', 'exercises')}.`
          : 'No planned days are left this week - start fresh on Monday.',
      });
    }
  }

  const skippedOften = mostSkipped.find((s) => s.skipped >= 2 && s.planned > 0 && s.skipped / s.planned >= 0.5);
  if (skippedOften) {
    out.push({
      priority: 3,
      tone: 'tip',
      title: `You skip ${skippedOften.name} often`,
      body: `You skipped it ${skippedOften.skipped} of the last ${skippedOften.planned} times. If it feels too hard or you don’t enjoy it, ask your trainer for a swap.`,
    });
  }

  const newPb = personalBests.find((p) => p.isNew);
  if (newPb) {
    out.push({
      priority: 4,
      tone: 'good',
      title: `New personal best: ${newPb.name}`,
      body: `${newPb.weightKg} kg${newPb.repsDone ? ` x ${newPb.repsDone} reps` : ''} on ${weekdayLabel(weekdayOf(newPb.date))}. Great progress.`,
    });
  }

  if (streak >= 3) {
    out.push({
      priority: 5,
      tone: 'good',
      title: `${streak}-session streak`,
      body: `You’ve completed ${streak} planned sessions in a row.${nextDay ? ` Keep it going - ${dayPhrase(nextDay)} is next.` : ''}`,
    });
  }

  // Trend over completed weeks: the 3 most recent full weeks vs the 3 before them.
  const full = consistency.filter((c) => !c.isCurrent);
  const recent = full.slice(-3).filter((c) => c.percent !== null);
  const earlier = full.slice(-6, -3).filter((c) => c.percent !== null);
  if (recent.length >= 2 && earlier.length >= 2) {
    const avg = (list: ConsistencyWeek[]) => list.reduce((a, c) => a + (c.percent as number), 0) / list.length;
    const r = Math.round(avg(recent));
    const e = Math.round(avg(earlier));
    if (r - e >= 15) {
      out.push({
        priority: 6,
        tone: 'good',
        title: 'Your consistency is climbing',
        body: `You completed ${r}% of planned sessions in your last few weeks, up from ${e}% before. Keep building on it.`,
      });
    } else if (e - r >= 15) {
      out.push({
        priority: 6,
        tone: 'warn',
        title: 'Your consistency dipped',
        body: `You completed ${r}% of planned sessions in your last few weeks, down from ${e}%. Try to protect your planned days - even a short session counts.`,
      });
    }
  }

  const recentEfforts = sessions.filter((s) => s.effort !== null && s.date >= addDays(today, -13) && s.date <= today);
  if (recentEfforts.length >= 3) {
    const avg = recentEfforts.reduce((a, s) => a + (s.effort as number), 0) / recentEfforts.length;
    if (avg >= 4.5) {
      out.push({
        priority: 7,
        tone: 'tip',
        title: 'Your sessions feel tough lately',
        body: `You rated your last ${recentEfforts.length} sessions ${avg.toFixed(1)} out of 5 on average. If that’s more than you want, tell your trainer - they can adjust your plan or add a lighter day.`,
      });
    }
  }

  return finish(out);
}

function finish(list: RankedInsight[]): Insight[] {
  return list
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_INSIGHTS)
    .map(({ tone, title, body }) => ({ tone, title, body }));
}

// ── entry point ────────────────────────────────────────────────────────────

/** The full tracking payload for the member's active plan. */
export function buildWorkoutTracking(input: TrackingInput): WorkoutTracking {
  const ctx = buildCtx(input);
  const { today } = input;
  const weekStart = weekStartOf(today);
  const windowStart = addDays(today, -WORKOUT_LOG_BACKDATE_DAYS);
  const daysFrom = weekStartOf(windowStart);
  const weekEnd = addDays(weekStart, 6);

  const days: TrackingDay[] = [];
  for (let d = daysFrom; d <= weekEnd; d = addDays(d, 1)) days.push(buildDay(ctx, d));

  const week = weekSummary(ctx, weekStart);
  const nextDay = findNextDay(ctx);
  const streak = computeStreak(ctx);
  const consistency = computeConsistency(ctx);
  const { exercises, muscleGroups } = computeExerciseStats(ctx);
  const mostSkipped = exercises
    .filter((e) => e.skipped > 0)
    .sort((a, b) => b.skipped - a.skipped || b.skipped / Math.max(b.planned, 1) - a.skipped / Math.max(a.planned, 1))
    .slice(0, 3);
  const personalBests = computePersonalBests(input);
  const last30 = computeLast30(ctx);
  const insights = buildInsights(ctx, { week, nextDay, streak, consistency, mostSkipped, personalBests });

  return {
    today,
    backdateDays: WORKOUT_LOG_BACKDATE_DAYS,
    windowStart,
    everLogged: input.everLogged,
    days,
    week,
    nextDay,
    streak,
    consistency,
    exercises,
    muscleGroups,
    mostSkipped,
    last30,
    personalBests,
    insights,
  };
}

/** Planned (distinct) exercises of a calendar day for an assignment - used by the write paths. */
export function plannedExercisesOn(
  schedule: PlanExerciseInfo[],
  assignment: { startDate: string; endDate: string | null },
  day: string,
): PlanExerciseInfo[] {
  if (day < assignment.startDate || (assignment.endDate !== null && day > assignment.endDate)) return [];
  const weekday = weekdayOf(day);
  const seen = new Set<string>();
  const out: PlanExerciseInfo[] = [];
  for (const e of [...schedule].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))) {
    if (e.dayOfWeek !== weekday || seen.has(e.exerciseId)) continue;
    seen.add(e.exerciseId);
    out.push(e);
  }
  return out;
}
