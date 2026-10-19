import { describe, expect, it } from 'vitest';

import { buildDietInsights, MAX_INSIGHTS } from './member-diet-insights.util';
import { addDays, buildNutritionBase, type DietLogInput, type PlanItemInput } from './member-nutrition.util';

const TODAY = '2026-10-19';

const mk = (mealType: string, protein: number | null, calories: number | null = 300): PlanItemInput => ({
  mealType,
  sortOrder: 0,
  quantity: 1,
  food: { name: mealType, servingSize: null, calories, protein, carbohydrates: 10, fat: 5, fiber: 1, sugar: 1, sodium: 10 },
});

const PLAN: PlanItemInput[] = [mk('BREAKFAST', 20), mk('LUNCH', 30), mk('DINNER', 40)];
const FULL = { BREAKFAST: 'COMPLETED', LUNCH: 'COMPLETED', DINNER: 'COMPLETED' };

const log = (offset: number, mealsStatus: Record<string, string> | null, extra: Partial<DietLogInput> = {}): DietLogInput => ({
  date: addDays(TODAY, offset),
  waterIntakeMl: null,
  weightKg: null,
  mealsStatus,
  ...extra,
});

const insights = (logs: DietLogInput[], items = PLAN, startOffset = -10) =>
  buildDietInsights(buildNutritionBase({ items, logs, startDate: addDays(TODAY, startOffset), today: TODAY, dailyCalories: null }));

describe('buildDietInsights', () => {
  it('asks for the first log when nothing is logged', () => {
    const out = insights([]);
    expect(out.map((i) => i.id)).toEqual(['first-log']);
    expect(out[0]).toMatchObject({ tone: 'tip', title: 'Log your first meal' });
  });

  it('returns nothing before the plan starts or for a plan with no meals', () => {
    expect(insights([], PLAN, 5)).toEqual([]);
    expect(insights([log(-1, FULL)], [])).toEqual([]);
  });

  it('flags protein below plan and names the meal where most protein went missing', () => {
    // Dinner (40 g) skipped on 3 days, others complete.
    const out = insights([log(-1, { ...FULL, DINNER: 'SKIPPED' }), log(-2, { ...FULL, DINNER: 'SKIPPED' }), log(-3, { ...FULL, DINNER: 'SKIPPED' }), log(-4, FULL)]);
    const protein = out.find((i) => i.id === 'protein-low')!;
    expect(protein.tone).toBe('warn');
    expect(protein.title).toBe('Protein was below plan on 3 of 4 logged days');
    expect(protein.body).toContain('about 90 g protein');
    expect(protein.body).toContain('Dinner (40 g planned)');
  });

  it('does not flag protein when meals are completed', () => {
    expect(insights([log(-1, FULL), log(-2, FULL), log(-3, FULL)]).some((i) => i.id === 'protein-low')).toBe(false);
  });

  it('skips the protein rule when no plan food has protein data', () => {
    const noProtein = [mk('BREAKFAST', null), mk('LUNCH', null), mk('DINNER', null)];
    const out = insights([log(-1, { BREAKFAST: 'SKIPPED' }), log(-2, { BREAKFAST: 'SKIPPED' })], noProtein);
    expect(out.some((i) => i.id === 'protein-low')).toBe(false);
  });

  it('is honest about foods with no nutrition data at all', () => {
    const blank: PlanItemInput = { mealType: 'BREAKFAST', sortOrder: 1, quantity: 1, food: { name: 'X', servingSize: null, calories: null, protein: null, carbohydrates: null, fat: null, fiber: null, sugar: null, sodium: null } };
    const gap = insights([log(-1, FULL)], [...PLAN, blank]).find((i) => i.id === 'data-gap')!;
    expect(gap.body).toContain('1 food in your plan (of 4) has no calorie or macro values');
    expect(insights([], [...PLAN, blank]).map((i) => i.id)).toEqual(['first-log', 'data-gap']);
  });

  it('flags the meal that is regularly missed (needs 3+ counted days)', () => {
    const logs = [-1, -2, -3, -4].map((o) => log(o, { BREAKFAST: 'COMPLETED', LUNCH: 'COMPLETED', DINNER: o === -1 ? 'COMPLETED' : 'SKIPPED' }));
    const meal = insights(logs, PLAN, -4).find((i) => i.id === 'meal-missed')!;
    expect(meal.title).toBe('Dinner is the meal you miss most');
    expect(meal.body).toContain('completed it on 1 of the last 4 days');
    expect(meal.body).toContain('skipped it on 3');
    // With only 2 counted days the rule stays quiet.
    expect(insights([log(-1, { DINNER: 'SKIPPED' }), log(-2, { DINNER: 'SKIPPED' })], PLAN, -2).some((i) => i.id === 'meal-missed')).toBe(false);
  });

  it('flags calories well under plan using real averages', () => {
    const logs = [log(-1, { BREAKFAST: 'COMPLETED' }), log(-2, { BREAKFAST: 'COMPLETED' }), log(-3, { BREAKFAST: 'COMPLETED' })];
    const kcal = insights(logs).find((i) => i.id === 'calories-low')!;
    expect(kcal.title).toBe('You are eating about 33% of your planned calories');
    expect(kcal.body).toContain('300 kcal against 900 kcal');
  });

  it('water: warns under 75% of the stated default, praises on target, nudges when never saved', () => {
    const low = insights([log(-1, FULL, { waterIntakeMl: 1000 }), log(-2, FULL, { waterIntakeMl: 1200 })]);
    const w = low.find((i) => i.id === 'water-low')!;
    expect(w.title).toBe('Water is averaging 1,100 ml a day');
    expect(w.body).toContain('no water target');
    expect(w.body).toContain('2,000 ml');

    const ok = insights([log(-1, FULL, { waterIntakeMl: 2500 }), log(-2, FULL, { waterIntakeMl: 2000 })]);
    expect(ok.some((i) => i.id === 'water-good')).toBe(true);

    const none = insights([log(-1, FULL), log(-2, FULL), log(-3, FULL)]);
    expect(none.some((i) => i.id === 'water-unlogged')).toBe(true);
  });

  it('weight trend is neutral and factual', () => {
    const out = insights([log(-6, FULL, { weightKg: 72 }), log(-1, FULL, { weightKg: 71.1 })]);
    const w = out.find((i) => i.id === 'weight-trend')!;
    expect(w.tone).toBe('tip');
    expect(w.title).toBe('Your weight is down 0.9 kg over 5 days');
    const steady = insights([log(-6, FULL, { weightKg: 72 }), log(-1, FULL, { weightKg: 72.1 })]).find((i) => i.id === 'weight-trend')!;
    expect(steady.title).toBe('Your weight is holding steady');
  });

  it('celebrates a streak and good adherence', () => {
    const out = insights([log(-1, FULL), log(-2, FULL), log(-3, FULL)], PLAN, -3);
    expect(out.find((i) => i.id === 'streak')).toMatchObject({ tone: 'good', title: '3-day streak - every meal completed' });
    expect(out.find((i) => i.id === 'adherence-good')!.title).toContain('100%');
  });

  it('orders warnings first and caps at four', () => {
    const logs = [-1, -2, -3, -4, -5].map((o) =>
      log(o, { BREAKFAST: 'COMPLETED', LUNCH: 'SKIPPED', DINNER: 'SKIPPED' }, { waterIntakeMl: 500, weightKg: 70 + (o === -5 ? 1 : 0) }),
    );
    const out = insights(logs);
    expect(out.length).toBeLessThanOrEqual(MAX_INSIGHTS);
    expect(out).toHaveLength(MAX_INSIGHTS);
    const tones = out.map((i) => i.tone);
    expect(tones.slice(0, 3)).toEqual(['warn', 'warn', 'warn']);
  });

  it('never leaks undefined/NaN into the text', () => {
    const out = insights([log(-1, { BREAKFAST: 'COMPLETED' }), log(-2, null, { waterIntakeMl: 800 })]);
    for (const i of out) expect(`${i.title} ${i.body}`).not.toMatch(/undefined|NaN|null/);
  });
});

describe('buildDietInsights - lapsed logging', () => {
  it('nudges to restart when the only logs are older than the 7-day window', () => {
    const out = insights([log(-9, FULL)]);
    expect(out.map((i) => i.id)).toEqual(['restart']);
    expect(out[0]!.body).toContain('last 7 days');
  });
});
