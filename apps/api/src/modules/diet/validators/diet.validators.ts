import { z } from 'zod';

const mealTypeSchema = z.enum(['BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'EVENING_SNACK', 'DINNER', 'PRE_WORKOUT', 'POST_WORKOUT']);
const progressStatusSchema = z.enum(['PENDING', 'COMPLETED', 'SKIPPED']);

export const idParamSchema = z.object({ id: z.string().uuid() });
export const memberIdParamSchema = z.object({ memberId: z.string().uuid() });
export const assignmentIdParamSchema = z.object({ assignmentId: z.string().uuid() });

// ── Foods ────────────────────────────────────────────────────────────────

export const createFoodSchema = z.object({
  name: z.string().trim().min(1).max(150),
  category: z.string().trim().max(100).optional(),
  servingSize: z.string().trim().max(100).optional(),
  calories: z.coerce.number().int().min(0).optional(),
  protein: z.coerce.number().min(0).optional(),
  carbohydrates: z.coerce.number().min(0).optional(),
  fat: z.coerce.number().min(0).optional(),
  fiber: z.coerce.number().min(0).optional(),
  sugar: z.coerce.number().min(0).optional(),
  sodium: z.coerce.number().min(0).optional(),
  notes: z.string().trim().max(2000).optional(),
  isActive: z.boolean().optional(),
});

export const updateFoodSchema = createFoodSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'Provide at least one field to update.',
});

export const listFoodsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(100).optional(),
  isActive: z.coerce.boolean().optional(),
  includeDeleted: z.coerce.boolean().default(false),
  sortBy: z.enum(['name', 'category', 'createdAt']).default('name'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

// ── Diet plans ───────────────────────────────────────────────────────────

export const createDietPlanSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(4000).optional(),
  goal: z.string().trim().max(150).optional(),
  dailyCalories: z.coerce.number().int().positive().optional(),
  durationDays: z.coerce.number().int().positive().max(730),
  trainerId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const updateDietPlanSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    description: z.string().trim().max(4000).optional(),
    goal: z.string().trim().max(150).optional(),
    dailyCalories: z.coerce.number().int().positive().optional(),
    durationDays: z.coerce.number().int().positive().max(730).optional(),
    trainerId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update.' });

export const listDietPlansQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(120).optional(),
  trainerId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
  includeDeleted: z.coerce.boolean().default(false),
  sortBy: z.enum(['name', 'durationDays', 'createdAt']).default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

const planMealItemSchema = z.object({
  foodId: z.string().uuid(),
  mealType: mealTypeSchema,
  quantity: z.coerce.number().positive().optional(),
  notes: z.string().trim().max(1000).optional(),
});

/** The whole meal builder is replaced in one call — order in the array IS the sort order within each meal type. */
export const setPlanMealsSchema = z.object({
  meals: z.array(planMealItemSchema).max(200),
});

// ── Member assignment ───────────────────────────────────────────────────

export const assignDietPlanSchema = z.object({
  memberId: z.string().uuid(),
  startDate: z.string().trim().min(1),
  endDate: z.string().trim().optional(),
  trainerRemarks: z.string().trim().max(2000).optional(),
  memberNotes: z.string().trim().max(2000).optional(),
});

export const updateMemberDietPlanSchema = z
  .object({
    startDate: z.string().trim().min(1).optional(),
    endDate: z.string().trim().nullable().optional(),
    trainerRemarks: z.string().trim().max(2000).optional(),
    memberNotes: z.string().trim().max(2000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update.' });

export const updateDietProgressSchema = z.object({
  date: z.string().trim().min(1),
  waterIntakeMl: z.coerce.number().int().min(0).optional(),
  weightKg: z.coerce.number().positive().optional(),
  mealsStatus: z.record(mealTypeSchema, progressStatusSchema).optional(),
  notes: z.string().trim().max(1000).optional(),
});
