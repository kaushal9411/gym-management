import { ValidationError } from '../../../core/errors/app-error';

/**
 * Pure nutrition maths for the member diet screens (no I/O - unit tested).
 *
 * What a member "ate" is DERIVED, never entered: a meal marked COMPLETED
 * contributes the sum of its plan items (food nutrient x serving multiplier);
 * SKIPPED / PENDING contribute nothing. Foods with a null nutrient add
 * nothing for that nutrient (never guessed) and are counted in
 * `itemsWithoutData` so the UI can say so honestly. History is computed
 * against the member's CURRENT plan (plan edits are not versioned).
 */

export type MealStatus = 'PENDING' | 'COMPLETED' | 'SKIPPED';

export const MEAL_ORDER = [
  'BREAKFAST',
  'MORNING_SNACK',
  'LUNCH',
  'EVENING_SNACK',
  'DINNER',
  'PRE_WORKOUT',
  'POST_WORKOUT',
] as const;

/** The plan has no water target, so every client uses this general default (stated as a default in the payload). */
export const DEFAULT_WATER_TARGET_ML = 2000;
/** Days of history returned (capped by the plan start date). */
export const NUTRITION_HISTORY_DAYS = 14;
/** Days a member may back-date a diet log. */
export const DIET_LOG_BACKDATE_DAYS = 7;
/** "Last week" window used for averages, adherence and insights. */
export const NUTRITION_WEEK_DAYS = 7;

export interface Nutrients {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  /** milligrams */
  sodium: number;
}

export const NUTRIENT_KEYS = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

export interface PlanItemInput {
  mealType: string;
  sortOrder: number;
  quantity: number;
  food: {
    name: string;
    servingSize: string | null;
    calories: number | null;
    protein: number | null;
    carbohydrates: number | null;
    fat: number | null;
    fiber: number | null;
    sugar: number | null;
    sodium: number | null;
  };
}

export interface DietLogInput {
  date: string;
  waterIntakeMl: number | null;
  weightKg: number | null;
  mealsStatus: Record<string, string> | null;
}

export interface NutritionItemDto {
  name: string;
  servingSize: string | null;
  quantity: number;
  /** Already multiplied by `quantity`; a null food nutrient counts as 0. */
  nutrients: Nutrients;
  /** False when calories/protein/carbs/fat are ALL missing on the food. */
  hasData: boolean;
}

export interface NutritionPlanMealDto {
  mealType: string;
  nutrients: Nutrients;
  items: NutritionItemDto[];
}

export interface NutritionMealStatusDto {
  mealType: string;
  status: MealStatus;
}

export interface NutritionDayDto {
  date: string;
  /** True when the member marked any meal done/skipped or saved water/weight that day. */
  logged: boolean;
  mealsPlanned: number;
  mealsCompleted: number;
  mealsSkipped: number;
  mealsPending: number;
  allDone: boolean;
  meals: NutritionMealStatusDto[];
  eaten: Nutrients;
  waterMl: number | null;
  weightKg: number | null;
}

export interface NutritionWeekDto {
  /** The 7-day window ending today, clamped to the plan start. */
  windowDays: number;
  /** Days that count for adherence: past days, plus today once something is logged. */
  countedDays: number;
  /** Days (in the window) on which a meal was marked done or skipped. */
  loggedDays: number;
  mealsPlanned: number;
  mealsCompleted: number;
  mealsSkipped: number;
  /** completed / planned over `countedDays`, null with no counted days. */
  adherencePct: number | null;
  /** Average eaten per SETTLED logged day: a past day, or today once every meal is marked (an open day is still in progress; unlogged days are unknown, never averaged as zero). */
  avgEaten: Nutrients | null;
  /** How many days `avgEaten` averages. */
  avgDays: number;
  /** Average water over days with water saved; null if none. */
  avgWaterMl: number | null;
  waterDays: number;
}

export interface DietNutritionBase {
  /** Member's branch-local calendar date - clients log against this, not the device clock. */
  today: string;
  /** False when the plan starts in the future. */
  planStarted: boolean;
  /** Per-day plan total (sum of every plan meal). */
  planned: Nutrients;
  /** The plan's own `dailyCalories` figure (may differ from the food sum). */
  calorieTarget: number | null;
  waterTargetMl: number;
  waterTargetIsDefault: boolean;
  /** Plan items in total, and how many foods have no calories/protein/carbs/fat at all. */
  itemsTotal: number;
  itemsWithoutData: number;
  meals: NutritionPlanMealDto[];
  /** Oldest first; the last entry is `today` (when the plan has started). */
  days: NutritionDayDto[];
  week: NutritionWeekDto;
  /** Consecutive days with every planned meal completed (today may still be open). */
  streakDays: number;
  /** First and last logged weight in the history window, when 2+ weigh-ins exist. */
  weight: { first: { date: string; kg: number }; last: { date: string; kg: number }; deltaKg: number; entries: number } | null;
}

export interface DietInsight {
  id: string;
  tone: 'good' | 'warn' | 'tip';
  title: string;
  body: string;
}

export type DietNutritionDto = DietNutritionBase & { insights: DietInsight[] };

const round1 = (n: number): number => Math.round(n * 10) / 10;

export const emptyNutrients = (): Nutrients => ({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 });

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
    sugar: a.sugar + b.sugar,
    sodium: a.sodium + b.sodium,
  };
}

export function scaleNutrients(a: Nutrients, by: number): Nutrients {
  return {
    calories: a.calories * by,
    protein: a.protein * by,
    carbs: a.carbs * by,
    fat: a.fat * by,
    fiber: a.fiber * by,
    sugar: a.sugar * by,
    sodium: a.sodium * by,
  };
}

export function roundNutrients(a: Nutrients): Nutrients {
  return {
    calories: round1(a.calories),
    protein: round1(a.protein),
    carbs: round1(a.carbs),
    fat: round1(a.fat),
    fiber: round1(a.fiber),
    sugar: round1(a.sugar),
    sodium: round1(a.sodium),
  };
}

/** Nutrients of one plan item: the food's per-serving values x the plan's serving multiplier (nulls = 0). */
export function itemNutrients(item: PlanItemInput): Nutrients {
  const f = item.food;
  return scaleNutrients(
    {
      calories: f.calories ?? 0,
      protein: f.protein ?? 0,
      carbs: f.carbohydrates ?? 0,
      fat: f.fat ?? 0,
      fiber: f.fiber ?? 0,
      sugar: f.sugar ?? 0,
      sodium: f.sodium ?? 0,
    },
    item.quantity,
  );
}

const hasCoreData = (item: PlanItemInput): boolean => {
  const f = item.food;
  return f.calories !== null || f.protein !== null || f.carbohydrates !== null || f.fat !== null;
};

const DAY_MS = 86_400_000;
const dayMs = (day: string): number => new Date(`${day}T00:00:00.000Z`).getTime();

export function addDays(day: string, n: number): string {
  return new Date(dayMs(day) + n * DAY_MS).toISOString().slice(0, 10);
}

export function diffDays(later: string, earlier: string): number {
  return Math.round((dayMs(later) - dayMs(earlier)) / DAY_MS);
}

/** Group plan items per meal type in a stable, chronological order with unrounded nutrient sums. */
function groupMeals(items: PlanItemInput[]): Array<{ mealType: string; items: PlanItemInput[]; nutrients: Nutrients }> {
  const byType = new Map<string, PlanItemInput[]>();
  for (const item of items) {
    const list = byType.get(item.mealType) ?? [];
    list.push(item);
    byType.set(item.mealType, list);
  }
  const rank = (t: string): number => {
    const i = (MEAL_ORDER as readonly string[]).indexOf(t);
    return i === -1 ? MEAL_ORDER.length : i;
  };
  return [...byType.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]))
    .map(([mealType, list]) => {
      const sorted = [...list].sort((a, b) => a.sortOrder - b.sortOrder);
      return { mealType, items: sorted, nutrients: sorted.reduce((s, it) => addNutrients(s, itemNutrients(it)), emptyNutrients()) };
    });
}

const normaliseStatus = (raw: unknown): MealStatus => (raw === 'COMPLETED' || raw === 'SKIPPED' ? raw : 'PENDING');

export interface BuildNutritionInput {
  items: PlanItemInput[];
  logs: DietLogInput[];
  /** Assignment start date, YYYY-MM-DD. */
  startDate: string;
  /** Member's branch-local date, YYYY-MM-DD. */
  today: string;
  dailyCalories: number | null;
  historyDays?: number;
}

/** Builds everything except the insights (see member-diet-insights.util.ts). */
export function buildNutritionBase(input: BuildNutritionInput): DietNutritionBase {
  const { items, logs, startDate, today } = input;
  const historyDays = input.historyDays ?? NUTRITION_HISTORY_DAYS;
  const meals = groupMeals(items);
  const mealTypes = meals.map((m) => m.mealType);
  const mealNutrients = new Map(meals.map((m) => [m.mealType, m.nutrients]));
  const planned = meals.reduce((s, m) => addNutrients(s, m.nutrients), emptyNutrients());
  const logByDate = new Map(logs.map((l) => [l.date, l]));
  const planStarted = today >= startDate;

  const dayFor = (date: string): NutritionDayDto => {
    const log = logByDate.get(date);
    const statuses = meals.map((m) => ({ mealType: m.mealType, status: normaliseStatus(log?.mealsStatus?.[m.mealType]) }));
    const completed = statuses.filter((s) => s.status === 'COMPLETED');
    const skipped = statuses.filter((s) => s.status === 'SKIPPED').length;
    const eaten = completed.reduce((s, m) => addNutrients(s, mealNutrients.get(m.mealType) ?? emptyNutrients()), emptyNutrients());
    const waterMl = log?.waterIntakeMl ?? null;
    const weightKg = log?.weightKg ?? null;
    return {
      date,
      logged: completed.length + skipped > 0 || (waterMl !== null && waterMl > 0) || weightKg !== null,
      mealsPlanned: mealTypes.length,
      mealsCompleted: completed.length,
      mealsSkipped: skipped,
      mealsPending: mealTypes.length - completed.length - skipped,
      allDone: mealTypes.length > 0 && completed.length === mealTypes.length,
      meals: statuses,
      eaten: roundNutrients(eaten),
      waterMl,
      weightKg,
    };
  };

  // History window (oldest first), never before the plan start.
  const days: NutritionDayDto[] = [];
  if (planStarted) {
    for (let i = historyDays - 1; i >= 0; i -= 1) {
      const date = addDays(today, -i);
      if (date >= startDate) days.push(dayFor(date));
    }
  }

  // Streak: consecutive all-done days; an open "today" does not break it.
  const isAllDone = (date: string): boolean => date >= startDate && dayFor(date).allDone;
  let streakDays = 0;
  if (planStarted && mealTypes.length > 0) {
    let cursor = isAllDone(today) ? today : addDays(today, -1);
    while (streakDays < 3650 && isAllDone(cursor)) {
      streakDays += 1;
      cursor = addDays(cursor, -1);
    }
  }

  // Week window: last 7 days incl. today (within the plan).
  const weekDays = days.filter((d) => diffDays(today, d.date) < NUTRITION_WEEK_DAYS);
  const counted = weekDays.filter((d) => d.date < today || d.logged);
  const logged = weekDays.filter((d) => d.mealsCompleted + d.mealsSkipped > 0);
  const settled = logged.filter((d) => d.date < today || d.mealsPending === 0);
  const mealsPlanned = counted.reduce((s, d) => s + d.mealsPlanned, 0);
  const mealsCompleted = counted.reduce((s, d) => s + d.mealsCompleted, 0);
  const waterDays = weekDays.filter((d) => (d.waterMl ?? 0) > 0);
  const week: NutritionWeekDto = {
    windowDays: weekDays.length,
    countedDays: counted.length,
    loggedDays: logged.length,
    mealsPlanned,
    mealsCompleted,
    mealsSkipped: counted.reduce((s, d) => s + d.mealsSkipped, 0),
    adherencePct: mealsPlanned > 0 ? Math.round((mealsCompleted / mealsPlanned) * 100) : null,
    avgEaten:
      settled.length > 0
        ? roundNutrients(scaleNutrients(settled.reduce((s, d) => addNutrients(s, d.eaten), emptyNutrients()), 1 / settled.length))
        : null,
    avgDays: settled.length,
    avgWaterMl: waterDays.length > 0 ? Math.round(waterDays.reduce((s, d) => s + (d.waterMl ?? 0), 0) / waterDays.length) : null,
    waterDays: waterDays.length,
  };

  const weighed = days.filter((d) => d.weightKg !== null);
  const weight =
    weighed.length >= 2
      ? (() => {
          const first = weighed[0]!;
          const last = weighed[weighed.length - 1]!;
          return {
            first: { date: first.date, kg: first.weightKg! },
            last: { date: last.date, kg: last.weightKg! },
            deltaKg: round1(last.weightKg! - first.weightKg!),
            entries: weighed.length,
          };
        })()
      : null;

  return {
    today,
    planStarted,
    planned: roundNutrients(planned),
    calorieTarget: input.dailyCalories,
    waterTargetMl: DEFAULT_WATER_TARGET_ML,
    waterTargetIsDefault: true,
    itemsTotal: items.length,
    itemsWithoutData: items.filter((it) => !hasCoreData(it)).length,
    meals: meals.map((m) => ({
      mealType: m.mealType,
      nutrients: roundNutrients(m.nutrients),
      items: m.items.map((it) => ({
        name: it.food.name,
        servingSize: it.food.servingSize,
        quantity: it.quantity,
        nutrients: roundNutrients(itemNutrients(it)),
        hasData: hasCoreData(it),
      })),
    })),
    days,
    week,
    streakDays,
    weight,
  };
}

/** `YYYY-MM-DD` an incoming diet-log date refers to (leading date part wins, so `...T00:00:00.000Z` keeps its day). */
export function dietLogDay(raw: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

/**
 * Validates the day of a member diet log against the member's branch-local
 * `today`: no more than {@link DIET_LOG_BACKDATE_DAYS} days back. One day of
 * future tolerance covers a device clock that is ahead of the branch's
 * timezone (older app builds send the device date).
 */
export function resolveDietLogDay(raw: string, today: string): { day: string; date: Date } {
  const day = dietLogDay(raw);
  if (!day) throw new ValidationError('Invalid date.');
  if (day > addDays(today, 1)) throw new ValidationError('You can’t log a future day.');
  if (diffDays(today, day) > DIET_LOG_BACKDATE_DAYS) {
    throw new ValidationError(`You can only log meals for the last ${DIET_LOG_BACKDATE_DAYS} days.`);
  }
  return { day, date: new Date(`${day}T00:00:00.000Z`) };
}
