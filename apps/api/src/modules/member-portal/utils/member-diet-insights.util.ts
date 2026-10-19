import { diffDays, NUTRITION_WEEK_DAYS, type DietInsight, type DietNutritionBase } from './member-nutrition.util';

/**
 * Rule-based "what to do for better results" advice, computed from the
 * member's REAL logged data so web and mobile show identical text. No
 * medical claims, no invented numbers: every figure in a message comes from
 * the payload. Priority order (lower = shown first), at most
 * {@link MAX_INSIGHTS}.
 */
export const MAX_INSIGHTS = 4;

/** A day's protein counts as "under" when below this share of the planned protein. */
const PROTEIN_OK_RATIO = 0.9;
/** A meal type is flagged when completed on fewer than this share of counted days (needs MIN_MEAL_DAYS). */
const MEAL_LOW_RATIO = 0.6;
const MIN_MEAL_DAYS = 3;
const CALORIE_LOW_RATIO = 0.8;
const WATER_LOW_RATIO = 0.75;

interface Candidate extends DietInsight {
  priority: number;
}

const label = (mealType: string): string =>
  mealType
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
const fmt = (n: number): string => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(n);

const shortDate = (day: string): string => {
  const d = new Date(`${day}T00:00:00.000Z`);
  return `${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`;
};

function pushDataGap(out: Candidate[], n: DietNutritionBase): void {
  if (n.itemsWithoutData === 0) return;
  out.push({
    id: 'data-gap',
    tone: 'tip',
    priority: 80,
    title: 'Some foods have no nutrition data',
    body: `${plural(n.itemsWithoutData, 'food')} in your plan (of ${n.itemsTotal}) ${n.itemsWithoutData === 1 ? 'has' : 'have'} no calorie or macro values, so your totals may be lower than what you really ate. Your trainer can fill these in.`,
  });
}

export function buildDietInsights(n: DietNutritionBase): DietInsight[] {
  const out: Candidate[] = [];
  const { week, planned } = n;
  const weekDays = n.days.filter((d) => diffDays(n.today, d.date) < NUTRITION_WEEK_DAYS);
  // Days that are settled enough to judge: past days, or today once something is marked.
  const counted = weekDays.filter((d) => d.date < n.today || d.logged);
  const loggedMealDays = weekDays.filter((d) => d.mealsCompleted + d.mealsSkipped > 0);
  const anyLogEver = n.days.some((d) => d.logged);

  if (!n.planStarted || n.meals.length === 0) {
    return [];
  }

  // 0. Nothing logged yet -> one gentle nudge (+ the data-gap note below), no judgements about days with no data.
  if (!anyLogEver) {
    out.push({
      id: 'first-log',
      tone: 'tip',
      priority: 1,
      title: 'Log your first meal',
      body: 'Tap Done on a meal once you have eaten it. Your calories, protein and other nutrients fill in from your plan, and tailored tips appear here after a few days.',
    });
    pushDataGap(out, n);
    return finish(out);
  }

  // 0b. Logged before, but nothing marked in the last 7 days -> restart nudge instead of per-meal judgements.
  if (loggedMealDays.length === 0) {
    out.push({
      id: 'restart',
      tone: 'tip',
      priority: 1,
      title: 'Pick up where you left off',
      body: `You have not marked a meal in the last ${plural(weekDays.length, 'day')}. Open today's meals and tap Done or Skip as you go - even a quick log keeps your numbers honest and brings your tips back.`,
    });
    pushDataGap(out, n);
    return finish(out);
  }

  // 1. Protein under plan on N logged days -> point at the meal where the most protein went missing.
  if (planned.protein > 0 && loggedMealDays.length > 0) {
    const settled = loggedMealDays.filter((d) => d.date < n.today || d.mealsPending === 0);
    const under = settled.filter((d) => d.eaten.protein < planned.protein * PROTEIN_OK_RATIO);
    if (under.length > 0) {
      const missed = new Map<string, number>();
      for (const d of under) {
        for (const m of d.meals) {
          if (m.status === 'COMPLETED') continue;
          const meal = n.meals.find((x) => x.mealType === m.mealType);
          if (meal) missed.set(m.mealType, (missed.get(m.mealType) ?? 0) + meal.nutrients.protein);
        }
      }
      const top = [...missed.entries()].filter(([, g]) => g > 0).sort((a, b) => b[1] - a[1])[0];
      const where = top
        ? `The meal where most protein went missing is ${label(top[0])} (${fmt(n.meals.find((m) => m.mealType === top[0])!.nutrients.protein)} g planned). Finish it, or ask your trainer for a protein-rich swap you will actually eat.`
        : 'Complete every planned meal, or ask your trainer for a protein-rich swap you will actually eat.';
      out.push({
        id: 'protein-low',
        tone: 'warn',
        priority: 10,
        title: `Protein was below plan on ${under.length} of ${plural(settled.length, 'logged day')}`,
        body: `Your plan gives about ${fmt(planned.protein)} g protein a day. ${where}`,
      });
    }
  }

  // 2. A meal type that is regularly missed.
  if (counted.length >= MIN_MEAL_DAYS) {
    const rates = n.meals.map((m) => {
      const done = counted.filter((d) => d.meals.find((x) => x.mealType === m.mealType)?.status === 'COMPLETED').length;
      const skipped = counted.filter((d) => d.meals.find((x) => x.mealType === m.mealType)?.status === 'SKIPPED').length;
      return { mealType: m.mealType, done, skipped, rate: done / counted.length };
    });
    const worst = rates.sort((a, b) => a.rate - b.rate)[0];
    if (worst && worst.rate < MEAL_LOW_RATIO) {
      out.push({
        id: 'meal-missed',
        tone: 'warn',
        priority: 20,
        title: `${label(worst.mealType)} is the meal you miss most`,
        body: `You completed it on ${worst.done} of the last ${plural(counted.length, 'day')}${worst.skipped > 0 ? ` and skipped it on ${worst.skipped}` : ''}. Try preparing it ahead, or tell your trainer if it does not suit your routine so they can adjust the plan.`,
      });
    }
  }

  // 3. Calories well under the plan on the days meals were logged.
  if (planned.calories > 0 && week.avgEaten && week.avgDays >= 2) {
    const ratio = week.avgEaten.calories / planned.calories;
    if (ratio < CALORIE_LOW_RATIO) {
      out.push({
        id: 'calories-low',
        tone: 'warn',
        priority: 30,
        title: `You are eating about ${Math.round(ratio * 100)}% of your planned calories`,
        body: `On the days you logged meals you averaged ${fmt(week.avgEaten.calories)} kcal against ${fmt(planned.calories)} kcal in your plan. Completing the planned meals keeps your nutrition on track.`,
      });
    }
  }

  // 4. Water against a general default (the plan has no water target).
  const target = n.waterTargetMl;
  if (week.avgWaterMl !== null && week.waterDays >= 2) {
    const ratio = week.avgWaterMl / target;
    if (ratio < WATER_LOW_RATIO) {
      out.push({
        id: 'water-low',
        tone: 'warn',
        priority: 40,
        title: `Water is averaging ${fmt(week.avgWaterMl)} ml a day`,
        body: `That is on the days you saved water. Your plan has no water target, so the app uses a general ${fmt(target)} ml a day. Keep a bottle nearby and use the +250 / +500 ml buttons as you drink.`,
      });
    } else if (week.avgWaterMl >= target) {
      out.push({
        id: 'water-good',
        tone: 'good',
        priority: 60,
        title: 'Your water intake is on target',
        body: `You averaged ${fmt(week.avgWaterMl)} ml on days you saved water, against a general ${fmt(target)} ml a day (your plan has no water target).`,
      });
    }
  } else if (counted.length >= 3 && week.waterDays === 0) {
    out.push({
      id: 'water-unlogged',
      tone: 'tip',
      priority: 45,
      title: 'Track your water too',
      body: `No water was saved in the last ${plural(counted.length, 'day')}. Use the +250 / +500 ml buttons so you can see how close you get to a general ${fmt(target)} ml a day.`,
    });
  }

  // 5. Streak / adherence encouragement.
  if (n.streakDays >= 2) {
    out.push({
      id: 'streak',
      tone: 'good',
      priority: 50,
      title: `${n.streakDays}-day streak - every meal completed`,
      body: 'Keep it going. Finishing all your planned meals is the single biggest thing you control.',
    });
  }
  if (week.adherencePct !== null && week.countedDays >= 3 && week.adherencePct >= 85) {
    out.push({
      id: 'adherence-good',
      tone: 'good',
      priority: 55,
      title: `${week.adherencePct}% of planned meals completed this week`,
      body: `You completed ${week.mealsCompleted} of ${week.mealsPlanned} planned meals over the last ${plural(week.countedDays, 'day')}.`,
    });
  }

  // 6. Weight direction (neutral - the plan's goal is not judged here).
  if (n.weight) {
    const w = n.weight;
    const span = diffDays(w.last.date, w.first.date);
    const when = `between ${shortDate(w.first.date)} and ${shortDate(w.last.date)}`;
    const steady = Math.abs(w.deltaKg) < 0.2;
    out.push({
      id: 'weight-trend',
      tone: 'tip',
      priority: 70,
      title: steady
        ? 'Your weight is holding steady'
        : `Your weight is ${w.deltaKg < 0 ? 'down' : 'up'} ${fmt(Math.abs(w.deltaKg))} kg over ${plural(span, 'day')}`,
      body: `From ${plural(w.entries, 'weigh-in')} ${when}. Check it against your goal, and share the trend with your trainer if it is not heading where you want.`,
    });
  }

  // 7. Nutrition data gaps in the plan itself.
  pushDataGap(out, n);

  // 8. Fallback when there is data but nothing stands out yet.
  if (out.length === 0 && anyLogEver) {
    out.push({
      id: 'keep-logging',
      tone: 'tip',
      priority: 90,
      title: 'Keep logging to unlock tips',
      body: 'After a few days of meals and water, this card points out where you can improve.',
    });
  }

  return finish(out);
}

function finish(out: Candidate[]): DietInsight[] {
  return out
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_INSIGHTS)
    .map(({ id, tone, title, body }) => ({ id, tone, title, body }));
}
