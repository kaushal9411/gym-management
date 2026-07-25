import { z } from 'zod';

const difficultyLevelSchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);
const workoutLevelSchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);
const weekDaySchema = z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']);
const progressStatusSchema = z.enum(['PENDING', 'COMPLETED', 'SKIPPED']);

export const idParamSchema = z.object({ id: z.string().uuid() });
export const memberIdParamSchema = z.object({ memberId: z.string().uuid() });
export const assignmentIdParamSchema = z.object({ assignmentId: z.string().uuid() });

// ── Exercises ────────────────────────────────────────────────────────────

export const createExerciseSchema = z.object({
  name: z.string().trim().min(1).max(150),
  category: z.string().trim().max(100).optional(),
  muscleGroup: z.string().trim().max(100).optional(),
  equipment: z.string().trim().max(150).optional(),
  difficultyLevel: difficultyLevelSchema.optional(),
  instructions: z.string().trim().max(4000).optional(),
  // Same "data-URL, ~300KB raw" convention as `settings.validators.ts#uploadImageSchema` — no object storage exists.
  imageUrl: z
    .string()
    .trim()
    .max(400_000)
    .regex(/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/, 'Must be a base64 image data URL')
    .optional(),
  videoUrl: z.string().trim().url().max(2000).optional(),
  durationSeconds: z.coerce.number().int().positive().optional(),
  defaultSets: z.coerce.number().int().positive().optional(),
  defaultReps: z.coerce.number().int().positive().optional(),
  restSeconds: z.coerce.number().int().min(0).optional(),
  caloriesBurnEstimate: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const updateExerciseSchema = createExerciseSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'Provide at least one field to update.',
});

export const listExercisesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(100).optional(),
  muscleGroup: z.string().trim().max(100).optional(),
  difficultyLevel: difficultyLevelSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  includeDeleted: z.coerce.boolean().default(false),
  sortBy: z.enum(['name', 'category', 'createdAt']).default('name'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

// ── Workout plans ────────────────────────────────────────────────────────

export const createWorkoutPlanSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(4000).optional(),
  goal: z.string().trim().max(150).optional(),
  level: workoutLevelSchema.optional(),
  durationWeeks: z.coerce.number().int().positive().max(104),
  trainerId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const updateWorkoutPlanSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    description: z.string().trim().max(4000).optional(),
    goal: z.string().trim().max(150).optional(),
    level: workoutLevelSchema.optional(),
    durationWeeks: z.coerce.number().int().positive().max(104).optional(),
    trainerId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update.' });

export const listWorkoutPlansQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(120).optional(),
  level: workoutLevelSchema.optional(),
  trainerId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
  includeDeleted: z.coerce.boolean().default(false),
  sortBy: z.enum(['name', 'durationWeeks', 'createdAt']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

const planExerciseItemSchema = z.object({
  exerciseId: z.string().uuid(),
  dayOfWeek: weekDaySchema,
  sets: z.coerce.number().int().positive().optional(),
  repetitions: z.coerce.number().int().positive().optional(),
  restSeconds: z.coerce.number().int().min(0).optional(),
  notes: z.string().trim().max(1000).optional(),
});

/** The whole weekly schedule is replaced in one call — order in the array IS the drag-and-drop sort order within each day. */
export const setPlanExercisesSchema = z.object({
  exercises: z.array(planExerciseItemSchema).max(200),
});

// ── Member assignment ───────────────────────────────────────────────────

export const assignWorkoutPlanSchema = z.object({
  memberId: z.string().uuid(),
  startDate: z.string().trim().min(1),
  endDate: z.string().trim().optional(),
  trainerRemarks: z.string().trim().max(2000).optional(),
  memberNotes: z.string().trim().max(2000).optional(),
});

export const updateMemberWorkoutPlanSchema = z
  .object({
    startDate: z.string().trim().min(1).optional(),
    endDate: z.string().trim().nullable().optional(),
    trainerRemarks: z.string().trim().max(2000).optional(),
    memberNotes: z.string().trim().max(2000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update.' });

export const markProgressSchema = z.object({
  exerciseId: z.string().uuid(),
  status: progressStatusSchema,
  notes: z.string().trim().max(1000).optional(),
});
