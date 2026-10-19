/**
 * Types + small helpers for the member's workout self-tracking. The shapes
 * mirror the API's `tracking` block on `GET /portal/workout` and the
 * `/portal/workout/log*` endpoints (apps/api `member-workout-tracking.util.ts`).
 * Every number here is derived server-side from real logs - the UI never
 * invents figures.
 */

export type LogStatus = 'COMPLETED' | 'SKIPPED';
export type DayState = 'REST' | 'OUTSIDE' | 'UPCOMING' | 'TODAY' | 'DONE' | 'PARTIAL' | 'SKIPPED' | 'MISSED';
export type InsightTone = 'good' | 'warn' | 'tip';

export interface TrackingExercise {
  exerciseId: string;
  name: string;
  muscleGroup: string | null;
  /** Plan targets (null when the plan sets none). */
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

export interface TrackingDay {
  /** YYYY-MM-DD in the member's branch timezone. */
  date: string;
  weekday: string;
  label: string;
  isToday: boolean;
  isFuture: boolean;
  /** Planned, not in the future, inside the back-date window. */
  canLog: boolean;
  state: DayState;
  focus: string | null;
  plannedCount: number;
  completedCount: number;
  skippedCount: number;
  percent: number;
  exercises: TrackingExercise[];
  session: { durationMin: number | null; effort: number | null; notes: string | null } | null;
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
  weekday: string;
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
  isNew: boolean;
}

export interface WorkoutInsight {
  tone: InsightTone;
  title: string;
  body: string;
}

export interface WorkoutTracking {
  today: string;
  backdateDays: number;
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
  last30: { sessionsDone: number; exercisesCompleted: number; minutes: number | null; volumeKg: number | null; avgEffort: number | null };
  personalBests: PersonalBest[];
  insights: WorkoutInsight[];
}

export interface WorkoutLogEntry {
  id: string;
  date: string;
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string | null;
  status: LogStatus;
  setsDone: number | null;
  repsDone: number | null;
  weightKg: number | null;
  durationMin: number | null;
  notes: string | null;
  updatedAt: string;
}

export interface WorkoutHistory {
  today: string;
  from: string;
  entries: WorkoutLogEntry[];
  sessions: { date: string; durationMin: number | null; effort: number | null; notes: string | null }[];
}

/** Body of POST /portal/workout/log (omit a field = keep, null = clear). */
export interface WorkoutLogInput {
  exerciseId: string;
  date?: string;
  status: LogStatus;
  setsDone?: number | null;
  repsDone?: number | null;
  weightKg?: number | null;
  durationMin?: number | null;
  notes?: string | null;
}

export type WorkoutLogPatch = Partial<Omit<WorkoutLogInput, 'exerciseId' | 'date'>>;

export interface WorkoutCompleteInput {
  date?: string;
  durationMin?: number | null;
  effort?: number | null;
  notes?: string | null;
}

/** Bounds mirror the API validators / DB CHECK constraints. */
export const WORKOUT_LIMITS = {
  setsDone: { min: 1, max: 100 },
  repsDone: { min: 1, max: 1000 },
  weightKg: { min: 0.01, max: 1000 },
  durationMin: { min: 1, max: 600 },
  notes: 500,
} as const;

export const EFFORT_LABELS: Record<number, string> = { 1: 'Easy', 2: 'Light', 3: 'Moderate', 4: 'Hard', 5: 'Max effort' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** `2026-10-19` -> `19 Oct` (calendar day, no timezone shift). */
export function shortDay(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? ''}`;
}

/** `2026-10-19` -> `Mon`. */
export function weekdayShort(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()] ?? '';
}

/** `4 x 8 @ 60 kg` / `4 sets` / `12 min` from whatever was logged; null when nothing was. */
export function describeLogged(e: Pick<TrackingExercise, 'setsDone' | 'repsDone' | 'weightKg' | 'durationMin'>): string | null {
  const parts: string[] = [];
  if (e.setsDone && e.repsDone) parts.push(`${e.setsDone} x ${e.repsDone}`);
  else if (e.setsDone) parts.push(`${e.setsDone} ${e.setsDone === 1 ? 'set' : 'sets'}`);
  else if (e.repsDone) parts.push(`${e.repsDone} reps`);
  if (e.weightKg) parts.push(`@ ${e.weightKg} kg`);
  if (e.durationMin) parts.push(`${e.durationMin} min`);
  return parts.length ? parts.join(' ') : null;
}

/** `4 x 8 · rest 90s` from the plan targets; null when the plan sets none. */
export function describeTarget(e: Pick<TrackingExercise, 'sets' | 'reps' | 'restSeconds'>): string | null {
  const parts: string[] = [];
  if (e.sets && e.reps) parts.push(`${e.sets} x ${e.reps}`);
  else if (e.sets) parts.push(`${e.sets} sets`);
  else if (e.reps) parts.push(`${e.reps} reps`);
  if (e.restSeconds) parts.push(`rest ${e.restSeconds}s`);
  return parts.length ? parts.join(' · ') : null;
}
