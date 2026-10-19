import { describe, expect, it } from 'vitest';

import {
  addDays,
  buildNutritionBase,
  dietLogDay,
  itemNutrients,
  resolveDietLogDay,
  type DietLogInput,
  type PlanItemInput,
} from './member-nutrition.util';

const food = (over: Partial<PlanItemInput['food']> = {}): PlanItemInput['food'] => ({
  name: 'Food',
  servingSize: '1 serving',
  calories: 100,
  protein: 10,
  carbohydrates: 20,
  fat: 5,
  fiber: 2,
  sugar: 3,
  sodium: 50,
  ...over,
});

const item = (mealType: string, quantity: number, f: Partial<PlanItemInput['food']> = {}, sortOrder = 0): PlanItemInput => ({
  mealType,
  sortOrder,
  quantity,
  food: food(f),
});

const TODAY = '2026-10-19';

// BREAKFAST: oats x1.5 (+ a food with no data), LUNCH: rice x2, DINNER: dal x1
const PLAN: PlanItemInput[] = [
  item('LUNCH', 2, { name: 'Rice', calories: 200, protein: 4, carbohydrates: 44, fat: 0.5, fiber: 1, sugar: 0, sodium: 10 }),
  item('BREAKFAST', 1.5, { name: 'Oats', calories: 150, protein: 5, carbohydrates: 27, fat: 3, fiber: 4, sugar: 1, sodium: 2 }, 0),
  item('BREAKFAST', 1, { name: 'Mystery', calories: null, protein: null, carbohydrates: null, fat: null, fiber: null, sugar: null, sodium: null }, 1),
  item('DINNER', 1, { name: 'Dal', calories: 180, protein: 12, carbohydrates: 30, fat: 2, fiber: 8, sugar: 2, sodium: 300 }),
];

const log = (date: string, mealsStatus: Record<string, string> | null, extra: Partial<DietLogInput> = {}): DietLogInput => ({
  date,
  waterIntakeMl: null,
  weightKg: null,
  mealsStatus,
  ...extra,
});

const build = (logs: DietLogInput[], over: { startDate?: string; today?: string } = {}) =>
  buildNutritionBase({ items: PLAN, logs, startDate: over.startDate ?? '2026-10-01', today: over.today ?? TODAY, dailyCalories: 1800 });

describe('itemNutrients', () => {
  it('multiplies each nutrient by the serving multiplier', () => {
    expect(itemNutrients(item('LUNCH', 1.5, { calories: 200, protein: 10 }))).toMatchObject({ calories: 300, protein: 15, carbs: 30, fat: 7.5, sodium: 75 });
  });
  it('treats null nutrients as zero', () => {
    expect(itemNutrients(item('LUNCH', 3, { calories: null, protein: null, carbohydrates: null, fat: null, fiber: null, sugar: null, sodium: null }))).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
    });
  });
});

describe('buildNutritionBase - plan', () => {
  const n = build([]);
  it('orders meals chronologically and sums per meal', () => {
    expect(n.meals.map((m) => m.mealType)).toEqual(['BREAKFAST', 'LUNCH', 'DINNER']);
    // Oats 1.5 x (150 kcal, 5 p, 27 c, 3 f, 4 fiber, 1 sugar, 2 na); Mystery contributes nothing.
    expect(n.meals[0]!.nutrients).toEqual({ calories: 225, protein: 7.5, carbs: 40.5, fat: 4.5, fiber: 6, sugar: 1.5, sodium: 3 });
    // Rice x2
    expect(n.meals[1]!.nutrients).toEqual({ calories: 400, protein: 8, carbs: 88, fat: 1, fiber: 2, sugar: 0, sodium: 20 });
  });
  it('plan total is the sum of all meals', () => {
    expect(n.planned).toEqual({ calories: 805, protein: 27.5, carbs: 158.5, fat: 7.5, fiber: 16, sugar: 3.5, sodium: 323 });
    expect(n.calorieTarget).toBe(1800);
  });
  it('counts foods with no data, honestly', () => {
    expect(n.itemsTotal).toBe(4);
    expect(n.itemsWithoutData).toBe(1);
    expect(n.meals[0]!.items.map((i) => i.hasData)).toEqual([true, false]);
  });
  it('states the water target is a default', () => {
    expect(n.waterTargetMl).toBe(2000);
    expect(n.waterTargetIsDefault).toBe(true);
  });
});

describe('buildNutritionBase - eaten', () => {
  it('only COMPLETED meals add to eaten; SKIPPED/PENDING add nothing', () => {
    const n = build([log(TODAY, { BREAKFAST: 'COMPLETED', LUNCH: 'SKIPPED' })]);
    const today = n.days[n.days.length - 1]!;
    expect(today.date).toBe(TODAY);
    expect(today.eaten.calories).toBe(225);
    expect(today.eaten.protein).toBe(7.5);
    expect(today.mealsCompleted).toBe(1);
    expect(today.mealsSkipped).toBe(1);
    expect(today.mealsPending).toBe(1);
    expect(today.allDone).toBe(false);
    expect(today.meals).toEqual([
      { mealType: 'BREAKFAST', status: 'COMPLETED' },
      { mealType: 'LUNCH', status: 'SKIPPED' },
      { mealType: 'DINNER', status: 'PENDING' },
    ]);
  });
  it('all meals completed equals the planned day total', () => {
    const n = build([log(TODAY, { BREAKFAST: 'COMPLETED', LUNCH: 'COMPLETED', DINNER: 'COMPLETED' })]);
    const today = n.days[n.days.length - 1]!;
    expect(today.eaten).toEqual(n.planned);
    expect(today.allDone).toBe(true);
  });
  it('ignores meal types that are not in the plan and junk statuses', () => {
    const n = build([log(TODAY, { SNACK_X: 'COMPLETED', LUNCH: 'weird' })]);
    const today = n.days[n.days.length - 1]!;
    expect(today.mealsCompleted).toBe(0);
    expect(today.logged).toBe(false);
  });
  it('a water-only or weight-only day is logged but eats nothing', () => {
    const n = build([log(TODAY, null, { waterIntakeMl: 500 })]);
    const today = n.days[n.days.length - 1]!;
    expect(today.logged).toBe(true);
    expect(today.eaten.calories).toBe(0);
    expect(today.waterMl).toBe(500);
  });
});

describe('buildNutritionBase - history and week', () => {
  it('returns up to 14 days ending today, oldest first, never before the plan start', () => {
    expect(build([]).days).toHaveLength(14);
    const short = build([], { startDate: '2026-10-16' });
    expect(short.days.map((d) => d.date)).toEqual(['2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19']);
  });
  it('has no history when the plan has not started', () => {
    const n = build([], { startDate: '2026-10-25' });
    expect(n.planStarted).toBe(false);
    expect(n.days).toEqual([]);
    expect(n.streakDays).toBe(0);
  });
  it('adherence = completed / planned over counted days (past days + today once logged)', () => {
    // 3 past days: 3, 2 and 0 meals completed of 3.
    const n = build(
      [
        log(addDays(TODAY, -1), { BREAKFAST: 'COMPLETED', LUNCH: 'COMPLETED', DINNER: 'COMPLETED' }),
        log(addDays(TODAY, -2), { BREAKFAST: 'COMPLETED', LUNCH: 'COMPLETED', DINNER: 'SKIPPED' }),
      ],
      { startDate: addDays(TODAY, -3) },
    );
    // counted: -3, -2, -1 (today unlogged is excluded)
    expect(n.week.countedDays).toBe(3);
    expect(n.week.mealsPlanned).toBe(9);
    expect(n.week.mealsCompleted).toBe(5);
    expect(n.week.mealsSkipped).toBe(1);
    expect(n.week.adherencePct).toBe(56);
    expect(n.week.loggedDays).toBe(2);
  });
  it('averages eaten over settled logged days only (an open today is left out)', () => {
    const n = build([log(addDays(TODAY, -1), { BREAKFAST: 'COMPLETED', LUNCH: 'COMPLETED', DINNER: 'COMPLETED' }), log(TODAY, { BREAKFAST: 'COMPLETED' })], { startDate: addDays(TODAY, -5) });
    expect(n.week.avgEaten!.calories).toBe(805);
    expect(n.week.avgDays).toBe(1);
    expect(n.week.loggedDays).toBe(2);
  });
  it('averages eaten over LOGGED days only', () => {
    const n = build(
      [
        log(addDays(TODAY, -1), { BREAKFAST: 'COMPLETED', LUNCH: 'COMPLETED', DINNER: 'COMPLETED' }),
        log(addDays(TODAY, -2), { BREAKFAST: 'COMPLETED' }),
      ],
      { startDate: addDays(TODAY, -5) },
    );
    // (805 + 225) / 2 = 515
    expect(n.week.avgEaten!.calories).toBe(515);
    expect(n.week.loggedDays).toBe(2);
  });
  it('avgEaten is null and adherence null when nothing counted', () => {
    const n = build([], { startDate: TODAY });
    expect(n.week.avgEaten).toBeNull();
    expect(n.week.adherencePct).toBeNull();
    expect(n.week.avgWaterMl).toBeNull();
  });
  it('averages water over days water was saved', () => {
    const n = build([
      log(addDays(TODAY, -1), null, { waterIntakeMl: 2000 }),
      log(addDays(TODAY, -2), null, { waterIntakeMl: 1000 }),
      log(addDays(TODAY, -3), null, { waterIntakeMl: 0 }),
    ]);
    expect(n.week.avgWaterMl).toBe(1500);
    expect(n.week.waterDays).toBe(2);
  });
  it('week window excludes days older than 7 days', () => {
    const n = build([log(addDays(TODAY, -8), { BREAKFAST: 'COMPLETED' })]);
    expect(n.week.loggedDays).toBe(0);
    expect(n.days.some((d) => d.date === addDays(TODAY, -8) && d.mealsCompleted === 1)).toBe(true);
  });
});

describe('buildNutritionBase - streak and weight', () => {
  const full = { BREAKFAST: 'COMPLETED', LUNCH: 'COMPLETED', DINNER: 'COMPLETED' };
  it('counts consecutive all-done days; an open today does not break it', () => {
    const n = build([log(addDays(TODAY, -1), full), log(addDays(TODAY, -2), full), log(addDays(TODAY, -3), { BREAKFAST: 'COMPLETED' })]);
    expect(n.streakDays).toBe(2);
  });
  it('includes today when it is all done', () => {
    expect(build([log(TODAY, full), log(addDays(TODAY, -1), full)]).streakDays).toBe(2);
  });
  it('a gap resets it', () => {
    expect(build([log(addDays(TODAY, -1), full), log(addDays(TODAY, -3), full)]).streakDays).toBe(1);
  });
  it('streak is not capped by the 14-day history window and stops at plan start', () => {
    const logs = Array.from({ length: 20 }, (_, i) => log(addDays(TODAY, -(i + 1)), full));
    expect(build(logs, { startDate: addDays(TODAY, -30) }).streakDays).toBe(20);
    expect(build(logs, { startDate: addDays(TODAY, -5) }).streakDays).toBe(5);
  });
  it('weight needs 2+ weigh-ins and reports the first->last delta', () => {
    expect(build([log(TODAY, null, { weightKg: 70 })]).weight).toBeNull();
    const n = build([log(addDays(TODAY, -6), null, { weightKg: 71.2 }), log(addDays(TODAY, -3), null, { weightKg: 70.9 }), log(TODAY, null, { weightKg: 70.4 })]);
    expect(n.weight).toEqual({ first: { date: addDays(TODAY, -6), kg: 71.2 }, last: { date: TODAY, kg: 70.4 }, deltaKg: -0.8, entries: 3 });
  });
});

describe('dietLogDay / resolveDietLogDay', () => {
  it('reads the leading date and rejects junk or impossible dates', () => {
    expect(dietLogDay('2026-10-19')).toBe('2026-10-19');
    expect(dietLogDay('2026-10-19T00:00:00.000Z')).toBe('2026-10-19');
    expect(dietLogDay('2026-02-31')).toBeNull();
    expect(dietLogDay('yesterday')).toBeNull();
  });
  it('allows today, the last 7 days and one day of clock tolerance', () => {
    expect(resolveDietLogDay('2026-10-19', TODAY).day).toBe('2026-10-19');
    expect(resolveDietLogDay('2026-10-12', TODAY).day).toBe('2026-10-12');
    expect(resolveDietLogDay('2026-10-20', TODAY).day).toBe('2026-10-20');
    expect(resolveDietLogDay('2026-10-19', TODAY).date.toISOString()).toBe('2026-10-19T00:00:00.000Z');
  });
  it('rejects the further future, older than 7 days and unparseable input', () => {
    expect(() => resolveDietLogDay('2026-10-21', TODAY)).toThrow(/future/);
    expect(() => resolveDietLogDay('2026-10-11', TODAY)).toThrow(/last 7 days/);
    expect(() => resolveDietLogDay('nope', TODAY)).toThrow(/Invalid date/);
  });
});
