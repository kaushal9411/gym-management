import { z } from 'zod';

/** Bounds mirror the CHECK constraints on `member_workout_daily_logs` / `member_workout_session_logs`. */
const setsDone = z.number().int().min(1).max(100);
const repsDone = z.number().int().min(1).max(1000);
const weightKg = z.number().positive().max(1000);
const durationMin = z.number().int().min(1).max(600);
const effort = z.number().int().min(1).max(5);
const notes = z.string().trim().max(500);
const day = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date.');

/** Optional (omit = keep), nullable (null = clear) numeric fields. */
const perfFields = {
  setsDone: setsDone.nullable().optional(),
  repsDone: repsDone.nullable().optional(),
  weightKg: weightKg.nullable().optional(),
  durationMin: durationMin.nullable().optional(),
};

const PERF_KEYS = ['setsDone', 'repsDone', 'weightKg', 'durationMin'] as const;

export const hasPerformanceValue = (v: Partial<Record<(typeof PERF_KEYS)[number], unknown>>): boolean =>
  PERF_KEYS.some((k) => v[k] !== undefined && v[k] !== null);

/** `POST /portal/workout/log` - upsert one exercise for one day (default: today). */
export const memberWorkoutLogSchema = z
  .object({
    exerciseId: z.string().uuid('Invalid exercise id'),
    date: day.optional(),
    status: z.enum(['COMPLETED', 'SKIPPED']),
    ...perfFields,
    notes: notes.nullable().optional(),
  })
  .strict()
  .refine((v) => v.status === 'COMPLETED' || !hasPerformanceValue(v), {
    message: 'Sets, reps, weight and duration can only be added to a completed exercise.',
    path: ['status'],
  });

/** `PATCH /portal/workout/log/:id` - any non-empty subset; the date and exercise never change. */
export const memberWorkoutLogUpdateSchema = z
  .object({
    status: z.enum(['COMPLETED', 'SKIPPED']).optional(),
    ...perfFields,
    notes: notes.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to update.' })
  .refine((v) => v.status !== 'SKIPPED' || !hasPerformanceValue(v), {
    message: 'Sets, reps, weight and duration can only be added to a completed exercise.',
    path: ['status'],
  });

/** `POST /portal/workout/log/complete` - finish the day's workout (+ optional duration / effort). */
export const memberWorkoutCompleteSchema = z
  .object({
    date: day.optional(),
    durationMin: durationMin.nullable().optional(),
    effort: effort.nullable().optional(),
    notes: notes.nullable().optional(),
  })
  .strict();

export const memberWorkoutHistoryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(120).default(60),
});

export const memberWorkoutDayParamSchema = z.object({
  date: day,
});
