import type { MealType } from '../types';

/**
 * Smart Diet Plan engine — pure, rule-based (no AI, no network). Mifflin-St Jeor BMR x activity (from gym visits)
 * x goal adjustment gives calories; protein/fat/carb split by fixed rules; foods are picked by role per meal and the
 * quantities nudged until calories and protein land within tolerance. Same input + same `seed` = same plan.
 */

export type DietType = 'VEGAN' | 'VEGETARIAN' | 'EGGETARIAN' | 'NON_VEGETARIAN';
export type FoodRole = 'PROTEIN' | 'CARB' | 'FAT' | 'VEGETABLE' | 'FRUIT' | 'DAIRY' | 'SNACK' | 'SUPPLEMENT';
export type Allergen = 'gluten' | 'lactose' | 'nuts' | 'egg' | 'soy' | 'fish' | 'shellfish';
export type Sex = 'M' | 'F' | 'O';
export type GoalKey = 'WEIGHT_LOSS' | 'MUSCLE_BUILDING' | 'WEIGHT_GAIN' | 'GENERAL_FITNESS' | 'ENDURANCE' | 'REHABILITATION' | 'OTHER';

export interface PlannerFood {
  id: string;
  name: string;
  serving: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  sugar: number;
  sodium: number;
  diet: DietType;
  role: FoodRole;
  meals: MealType[];
  allergens: Allergen[];
}

export interface PlannerMember {
  sex: Sex | null;
  dob: string | null;
  heightCm: number | null;
  weightKg: number | null;
  goal: GoalKey | null;
  pref: DietType | null;
  allergies: string;
  medical: string;
  diabetesOrBp: boolean;
  heart: boolean;
  visits28: number;
}

export type MissingField = 'sex' | 'dob' | 'height' | 'weight' | 'goal' | 'pref';
export const MISSING_LABEL: Record<MissingField, string> = {
  sex: 'Gender',
  dob: 'Date of birth',
  height: 'Height',
  weight: 'Weight',
  goal: 'Fitness goal',
  pref: 'Food preference',
};

export const SLOT_LABEL: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  MORNING_SNACK: 'Morning snack',
  LUNCH: 'Lunch',
  EVENING_SNACK: 'Evening snack',
  DINNER: 'Dinner',
  PRE_WORKOUT: 'Pre workout',
  POST_WORKOUT: 'Post workout',
};

const LAYOUTS: Record<'5' | '5w', Array<[MealType, number]>> = {
  '5': [['BREAKFAST', 0.25], ['MORNING_SNACK', 0.1], ['LUNCH', 0.3], ['EVENING_SNACK', 0.1], ['DINNER', 0.25]],
  '5w': [['BREAKFAST', 0.22], ['PRE_WORKOUT', 0.1], ['LUNCH', 0.28], ['POST_WORKOUT', 0.12], ['DINNER', 0.28]],
};

interface Component {
  label: string;
  roles: FoodRole[];
  share: number;
}
const TEMPLATE: Record<MealType, Component[]> = {
  BREAKFAST: [{ label: 'Protein', roles: ['PROTEIN', 'DAIRY'], share: 0.35 }, { label: 'Carb', roles: ['CARB'], share: 0.45 }, { label: 'Fruit', roles: ['FRUIT'], share: 0.2 }],
  MORNING_SNACK: [{ label: 'Fruit', roles: ['FRUIT'], share: 0.45 }, { label: 'Snack', roles: ['DAIRY', 'SNACK', 'FAT'], share: 0.55 }],
  LUNCH: [{ label: 'Protein', roles: ['PROTEIN'], share: 0.34 }, { label: 'Carb', roles: ['CARB'], share: 0.4 }, { label: 'Vegetable', roles: ['VEGETABLE'], share: 0.16 }, { label: 'Fat', roles: ['FAT'], share: 0.1 }],
  EVENING_SNACK: [{ label: 'Snack', roles: ['SNACK', 'DAIRY'], share: 0.55 }, { label: 'Fruit or fat', roles: ['FRUIT', 'FAT'], share: 0.45 }],
  DINNER: [{ label: 'Protein', roles: ['PROTEIN'], share: 0.38 }, { label: 'Carb', roles: ['CARB'], share: 0.32 }, { label: 'Vegetable', roles: ['VEGETABLE'], share: 0.2 }, { label: 'Fat', roles: ['FAT'], share: 0.1 }],
  PRE_WORKOUT: [{ label: 'Carb', roles: ['CARB'], share: 0.55 }, { label: 'Fruit', roles: ['FRUIT'], share: 0.45 }],
  POST_WORKOUT: [{ label: 'Protein', roles: ['SUPPLEMENT', 'PROTEIN', 'DAIRY'], share: 0.55 }, { label: 'Carb', roles: ['CARB', 'FRUIT'], share: 0.45 }],
};

interface GoalRule {
  label: string;
  adj: number;
  p: number;
  fat: number;
  review?: boolean;
}
export const GOALS: Record<GoalKey, GoalRule> = {
  WEIGHT_LOSS: { label: 'Weight loss', adj: -0.2, p: 2.0, fat: 0.25 },
  MUSCLE_BUILDING: { label: 'Muscle building', adj: 0.1, p: 2.0, fat: 0.25 },
  WEIGHT_GAIN: { label: 'Weight gain', adj: 0.15, p: 1.6, fat: 0.25 },
  GENERAL_FITNESS: { label: 'General fitness', adj: 0, p: 1.4, fat: 0.25 },
  ENDURANCE: { label: 'Endurance', adj: 0.05, p: 1.4, fat: 0.2 },
  REHABILITATION: { label: 'Rehabilitation', adj: 0, p: 1.6, fat: 0.25, review: true },
  OTHER: { label: 'Other', adj: 0, p: 1.4, fat: 0.25 },
};

const ACTIVITY = [
  { m: 1.2, label: 'Sedentary' },
  { m: 1.375, label: 'Lightly active' },
  { m: 1.55, label: 'Moderately active' },
  { m: 1.725, label: 'Very active' },
  { m: 1.9, label: 'Extra active' },
];

export const DIET_LABEL: Record<DietType, string> = { VEGAN: 'Vegan', VEGETARIAN: 'Vegetarian', EGGETARIAN: 'Eggetarian', NON_VEGETARIAN: 'Non-veg' };

const ALLERGY_RX: Record<Allergen, RegExp> = {
  lactose: /lactose|dairy|milk/i,
  egg: /\begg/i,
  nuts: /\b(nuts?|peanuts?|almonds?|cashews?|walnuts?)\b/i,
  gluten: /gluten|celiac|coeliac|wheat/i,
  soy: /\bsoy/i,
  fish: /\bfish\b/i,
  shellfish: /shellfish|prawn|shrimp|crab/i,
};
const MED_RX = {
  diabetes: /diabet|blood sugar/i,
  bp: /blood pressure|hypertens|\bbp\b/i,
  heart: /heart|cardiac/i,
  kidney: /kidney|renal/i,
  pregnancy: /pregnan|lactating|breastfeed/i,
};

const ALLOWED_DIETS: Record<DietType, DietType[]> = {
  VEGAN: ['VEGAN'],
  VEGETARIAN: ['VEGAN', 'VEGETARIAN'],
  EGGETARIAN: ['VEGAN', 'VEGETARIAN', 'EGGETARIAN'],
  NON_VEGETARIAN: ['VEGAN', 'VEGETARIAN', 'EGGETARIAN', 'NON_VEGETARIAN'],
};

const step = (n: number, s: number) => Math.round(n / s) * s;
const r025 = (q: number) => Math.round(q * 4) / 4;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

export function ageOf(dob: string | null, now = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
}

function activityFor(visitsPerWeek: number) {
  if (visitsPerWeek <= 1) return ACTIVITY[0]!;
  if (visitsPerWeek === 2) return ACTIVITY[1]!;
  if (visitsPerWeek <= 4) return ACTIVITY[2]!;
  if (visitsPerWeek <= 6) return ACTIVITY[3]!;
  return ACTIVITY[4]!;
}

export function missingFields(m: PlannerMember): MissingField[] {
  const out: MissingField[] = [];
  if (!m.sex) out.push('sex');
  if (!m.dob || ageOf(m.dob) === null) out.push('dob');
  if (!m.heightCm) out.push('height');
  if (!m.weightKg) out.push('weight');
  if (!m.goal) out.push('goal');
  if (!m.pref) out.push('pref');
  return out;
}

export interface Targets {
  age: number;
  bmr: number;
  vpw: number;
  actLabel: string;
  actMult: number;
  tdee: number;
  raw: number;
  kcal: number;
  p: number;
  c: number;
  f: number;
  floor: number;
  floored: boolean;
  pCapped: boolean;
  goal: GoalRule;
  bmi: number;
}

interface ValidMember extends PlannerMember {
  sex: Sex;
  heightCm: number;
  weightKg: number;
  goal: GoalKey;
  pref: DietType;
  dob: string;
}

function targets(m: ValidMember): Targets {
  const g = GOALS[m.goal];
  const age = ageOf(m.dob) ?? 30;
  const sc = m.sex === 'M' ? 5 : m.sex === 'F' ? -161 : -78;
  const bmr = 10 * m.weightKg + 6.25 * m.heightCm - 5 * age + sc;
  const vpw = Math.round(m.visits28 / 4);
  const act = activityFor(vpw);
  const tdee = bmr * act.m;
  const raw = tdee * (1 + g.adj);
  const floor = m.sex === 'M' ? 1500 : 1200;
  const floored = raw < floor;
  const kcal = step(Math.max(raw, floor), 10);
  const pRaw = Math.min(g.p, 2.5) * m.weightKg;
  const pCap = (0.3 * kcal) / 4;
  const p = step(Math.min(pRaw, pCap), 5);
  const f = step(Math.max((g.fat * kcal) / 9, 0.6 * m.weightKg), 5);
  const c = Math.max(0, step((kcal - p * 4 - f * 9) / 4, 5));
  return { age, bmr, vpw, actLabel: act.label, actMult: act.m, tdee, raw, kcal, p, c, f, floor, floored, pCapped: pRaw > pCap, goal: g, bmi: m.weightKg / Math.pow(m.heightCm / 100, 2) };
}

interface Safety {
  blocks: string[];
  review: string[];
  allergens: Partial<Record<Allergen, boolean>>;
  diabetes: boolean;
  sodium: boolean;
}

function safety(m: ValidMember, t: Targets): Safety {
  const blocks: string[] = [];
  const review: string[] = [];
  const allergens: Partial<Record<Allergen, boolean>> = {};
  let diabetes = false;
  let sodium = false;
  if (t.age < 18) blocks.push('Under 18. Automatic plans are not offered for minors, so a trainer should build this plan by hand.');
  if (t.bmi < 18.5 && m.goal === 'WEIGHT_LOSS') blocks.push(`BMI is ${t.bmi.toFixed(1)}, under 18.5, so a calorie deficit is not offered.`);
  const text = m.medical;
  if (MED_RX.diabetes.test(text) || m.diabetesOrBp) {
    diabetes = true;
    review.push('Diabetes noted. Sugary foods are down-weighted and daily sugar is checked against 10% of calories.');
  }
  if (MED_RX.bp.test(text) || MED_RX.heart.test(text) || m.heart || m.diabetesOrBp) {
    sodium = true;
    review.push('Blood pressure or heart condition noted. High-sodium foods are down-weighted and daily sodium is checked against 2,000 mg.');
  }
  if (MED_RX.kidney.test(text)) review.push('Kidney condition noted. A trainer or doctor must review protein before this plan is used.');
  if (MED_RX.pregnancy.test(text)) review.push('Pregnancy or breastfeeding noted. A doctor or dietitian must review this draft before use.');
  if (t.age >= 65) review.push('Age 65 or older. A trainer must review this draft.');
  if (t.goal.review) review.push('Rehabilitation goals are always held for trainer review.');
  (Object.keys(ALLERGY_RX) as Allergen[]).forEach((k) => {
    if (ALLERGY_RX[k].test(m.allergies)) allergens[k] = true;
  });
  return { blocks, review, allergens, diabetes, sodium };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function pickRank(seed: number, key: string, n: number): number {
  if (!seed || n < 2) return 0;
  const r = (hash(`${seed}|${key}`) % 1000) / 1000;
  const w = [0.5, 0.3, 0.2].slice(0, n);
  const tot = w.reduce((a, x) => a + x, 0);
  let acc = 0;
  for (let i = 0; i < w.length; i++) {
    acc += w[i]! / tot;
    if (r < acc) return i;
  }
  return n - 1;
}

interface Ctx {
  diets: DietType[];
  allergens: Partial<Record<Allergen, boolean>>;
  used: Record<string, number>;
  diabetes: boolean;
  sodium: boolean;
  seed: number;
}

const allowedFood = (f: PlannerFood, ctx: Ctx) => ctx.diets.includes(f.diet) && !f.allergens.some((a) => ctx.allergens[a]);
const slotCandidates = (catalog: PlannerFood[], slot: MealType, roles: FoodRole[], ctx: Ctx) =>
  catalog.filter((f) => allowedFood(f, ctx) && roles.includes(f.role) && f.meals.includes(slot));

function roleCoverage(catalog: PlannerFood[], ctx: Ctx): FoodRole[] {
  const have = new Set<FoodRole>();
  catalog.forEach((f) => {
    if (allowedFood(f, ctx)) have.add(f.role);
  });
  return (['PROTEIN', 'CARB', 'VEGETABLE', 'FRUIT', 'FAT'] as FoodRole[]).filter((r) => !have.has(r));
}

function scoreFood(f: PlannerFood, ctx: Ctx): number {
  const kc = f.kcal || 1;
  const pd = (f.p * 4) / kc;
  const cd = (f.c * 4) / kc;
  const fd = (f.f * 9) / kc;
  let fit: number;
  if (f.role === 'PROTEIN' || f.role === 'SUPPLEMENT' || f.role === 'DAIRY' || f.role === 'SNACK') fit = Math.min(1, pd / 0.8);
  else if (f.role === 'CARB') fit = Math.min(1, cd / 0.9);
  else if (f.role === 'FAT') fit = Math.min(1, fd / 0.9);
  else if (f.role === 'VEGETABLE') fit = Math.max(0, 1 - kc / 200);
  else fit = 0.6;
  const variety = 1 / (1 + 1.5 * (ctx.used[f.id] ?? 0));
  let pen = 0;
  if (ctx.diabetes) pen += Math.min(0.5, f.sugar / 40);
  if (ctx.sodium) pen += Math.min(0.5, f.sodium / 1200);
  return 0.5 * fit + 0.3 * variety - pen;
}
const byScore = (ctx: Ctx) => (a: PlannerFood, b: PlannerFood) => scoreFood(b, ctx) - scoreFood(a, ctx) || (a.id < b.id ? -1 : 1);

export interface PlanItem {
  foodId: string;
  name: string;
  serving: string;
  role: FoodRole;
  compLabel: string;
  roles: FoodRole[];
  k: number;
  p: number;
  c: number;
  f: number;
  sugar: number;
  sodium: number;
  qty: number;
  edited: boolean;
}
export interface PlanSlot {
  type: MealType;
  label: string;
  items: PlanItem[];
}
export interface Plan {
  t: Targets;
  review: string[];
  slots: PlanSlot[];
  notes: string[];
  explain: string[];
  ctx: Ctx;
  mix: number;
}

const qtyBounds = (it: PlanItem): [number, number] => (it.role === 'SUPPLEMENT' ? [0.5, 2] : [0.5, 4]);
export const qtyRange = qtyBounds;

function makeItem(f: PlannerFood, comp: { label: string; roles: FoodRole[] }, qty: number, edited: boolean): PlanItem {
  return { foodId: f.id, name: f.name, serving: f.serving, role: f.role, compLabel: comp.label, roles: comp.roles, k: f.kcal, p: f.p, c: f.c, f: f.f, sugar: f.sugar, sodium: f.sodium, qty, edited };
}

export interface Totals {
  kcal: number;
  p: number;
  c: number;
  f: number;
  sugar: number;
  sodium: number;
}
const allItems = (plan: Plan) => plan.slots.flatMap((s) => s.items);
export function totals(plan: Plan): Totals {
  const t: Totals = { kcal: 0, p: 0, c: 0, f: 0, sugar: 0, sodium: 0 };
  allItems(plan).forEach((it) => {
    t.kcal += it.k * it.qty;
    t.p += it.p * it.qty;
    t.c += it.c * it.qty;
    t.f += it.f * it.qty;
    t.sugar += it.sugar * it.qty;
    t.sodium += it.sodium * it.qty;
  });
  return t;
}

const proteinish = (it: PlanItem) => it.role === 'PROTEIN' || it.role === 'SUPPLEMENT' || it.role === 'DAIRY';
const pdens = (it: PlanItem) => (it.p * 4) / it.k;
function best(items: PlanItem[], pred: (it: PlanItem) => boolean, score: (it: PlanItem) => number): PlanItem | null {
  let b: PlanItem | null = null;
  let bs = -Infinity;
  items.forEach((it) => {
    if (!pred(it)) return;
    const s = score(it);
    if (s > bs) {
      bs = s;
      b = it;
    }
  });
  return b;
}

function rebalance(plan: Plan): void {
  const t = plan.t;
  const grow = (it: PlanItem) => !it.edited && it.role !== 'SUPPLEMENT' && it.qty + 0.25 <= qtyBounds(it)[1];
  const lean = (it: PlanItem) => it.role === 'CARB' || it.role === 'FAT' || it.role === 'FRUIT' || it.role === 'VEGETABLE';
  const canCut = (it: PlanItem) => !it.edited && it.qty - 0.25 >= qtyBounds(it)[0];
  for (let n = 0; n < 140; n++) {
    const tot = totals(plan);
    const items = allItems(plan);
    const kOK = Math.abs(tot.kcal - t.kcal) <= 0.05 * t.kcal;
    const pOK = tot.p >= 0.95 * t.p;
    const pHigh = tot.p > 1.15 * t.p;
    const fOK = tot.f >= 0.8 * t.f;
    if (kOK && pOK && !pHigh && fOK) return;
    let acted = false;
    if (!pOK) {
      const up = best(items, (it) => !it.edited && proteinish(it) && it.qty + 0.25 <= qtyBounds(it)[1], pdens);
      if (up) {
        up.qty += 0.25;
        acted = true;
        if (totals(plan).kcal > t.kcal * 1.03) {
          const dn = best(allItems(plan), (it) => canCut(it) && (it.role === 'CARB' || it.role === 'FAT' || it.role === 'FRUIT'), (it) => -pdens(it) * 1000 + (it.k * it.qty) / 1000);
          if (dn) dn.qty -= 0.25;
        }
      }
    }
    if (!acted && tot.kcal > t.kcal * 1.05) {
      const d = best(items, (it) => canCut(it) && (it.role === 'CARB' || it.role === 'FAT' || it.role === 'FRUIT' || it.role === 'SNACK'), (it) => it.k * it.qty);
      if (d) {
        d.qty -= 0.25;
        acted = true;
      }
    }
    if (!acted && tot.kcal < t.kcal * 0.95) {
      let u = best(items, (it) => grow(it) && lean(it), (it) => -it.k * it.qty);
      if (!u && !pHigh) u = best(items, grow, (it) => -it.k * it.qty);
      if (u) {
        u.qty += 0.25;
        acted = true;
      }
    }
    if (!acted && pHigh) {
      let d = best(items, (it) => canCut(it) && proteinish(it), (it) => it.p * it.qty);
      if (!d) d = best(items, (it) => canCut(it) && it.p > 0, (it) => it.p * it.qty);
      if (d) {
        d.qty -= 0.25;
        acted = true;
        if (totals(plan).kcal < t.kcal * 0.98) {
          const g = best(allItems(plan), (it) => grow(it) && lean(it), (it) => -it.k * it.qty);
          if (g) g.qty += 0.25;
        }
      }
    }
    if (!acted && !fOK) {
      const g = best(items, (it) => grow(it) && it.role === 'FAT', (it) => (it.f * 9) / it.k);
      if (g) {
        g.qty += 0.25;
        acted = true;
        if (totals(plan).kcal > t.kcal * 1.02) {
          const d = best(allItems(plan), (it) => canCut(it) && it.role === 'CARB', (it) => it.k * it.qty);
          if (d) d.qty -= 0.25;
        }
      }
    }
    if (!acted) return;
  }
}

function topUp(plan: Plan, catalog: PlannerFood[]): void {
  if (totals(plan).p >= 0.95 * plan.t.p) return;
  const inPlan = new Set(allItems(plan).map((it) => it.foodId));
  const order: MealType[] = ['POST_WORKOUT', 'EVENING_SNACK', 'MORNING_SNACK'];
  for (const type of order) {
    const slot = plan.slots.find((s) => s.type === type);
    if (!slot) continue;
    const c = slotCandidates(catalog, type, ['SUPPLEMENT'], plan.ctx)
      .filter((f) => !inPlan.has(f.id))
      .sort((a, b) => b.p / b.kcal - a.p / a.kcal);
    const pick = c[0];
    if (!pick) continue;
    slot.items.push(makeItem(pick, { label: 'Protein top-up', roles: ['SUPPLEMENT'] }, 1, false));
    plan.notes.push(`Added ${pick.name} to ${slot.label} to reach the protein target.`);
    rebalance(plan);
    return;
  }
}

export type GenerateResult =
  | { status: 'missing'; missing: MissingField[] }
  | { status: 'blocked'; blocks: string[] }
  | { status: 'catalog'; gaps: FoodRole[] }
  | { status: 'ok'; plan: Plan };

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

function explainLines(plan: Plan, m: ValidMember): string[] {
  const t = plan.t;
  const g = t.goal;
  const sc = m.sex === 'M' ? 5 : m.sex === 'F' ? -161 : -78;
  const al = Object.keys(plan.ctx.allergens);
  return [
    `BMR = 10 x ${m.weightKg} + 6.25 x ${m.heightCm} - 5 x ${t.age} ${sc >= 0 ? '+' : '-'} ${Math.abs(sc)} = ${fmt(t.bmr)} kcal`,
    `Activity x${t.actMult} (${t.actLabel}, ${t.vpw} visits a week) gives ${fmt(t.tdee)} kcal`,
    `Goal ${g.label.toLowerCase()} ${g.adj >= 0 ? '+' : '-'}${Math.round(Math.abs(g.adj) * 100)}% gives ${fmt(t.raw)} kcal${t.floored ? `, raised to the ${fmt(t.floor)} kcal floor` : ''}, rounded to ${fmt(t.kcal)}`,
    `Protein ${t.p} g${t.pCapped ? ' (capped at 30% of calories)' : ` (${g.p.toFixed(1)} g per kg)`}, fat ${t.f} g, carbohydrate ${t.c} g from the remaining calories`,
    `Foods allowed: ${ALLOWED_DIETS[m.pref].map((d) => DIET_LABEL[d].toLowerCase()).join(', ')}. Excluded for allergens: ${al.length ? al.join(', ') : 'none'}`,
    ...plan.notes,
  ];
}

function isValid(m: PlannerMember): m is ValidMember {
  return missingFields(m).length === 0;
}

export function generate(m: PlannerMember, catalog: PlannerFood[], mix = 0): GenerateResult {
  const miss = missingFields(m);
  if (miss.length || !isValid(m)) return { status: 'missing', missing: miss };
  const t = targets(m);
  const s = safety(m, t);
  if (s.blocks.length) return { status: 'blocked', blocks: s.blocks };
  const ctx: Ctx = { diets: ALLOWED_DIETS[m.pref], allergens: s.allergens, used: {}, diabetes: s.diabetes, sodium: s.sodium, seed: mix };
  const gaps = roleCoverage(catalog, ctx);
  if (gaps.length) return { status: 'catalog', gaps };
  const layout = LAYOUTS[t.vpw >= 3 ? '5w' : '5'];
  const slots: PlanSlot[] = layout.map(([type]) => ({ type, label: SLOT_LABEL[type], items: [] }));
  const kcalOf: number[] = [];
  let used = 0;
  layout.forEach(([, share], i) => {
    const kc = i < layout.length - 1 ? step(t.kcal * share, 5) : t.kcal - used;
    used += kc;
    kcalOf.push(kc);
  });
  slots.forEach((slot, si) => {
    TEMPLATE[slot.type].forEach((comp) => {
      const cands = slotCandidates(catalog, slot.type, comp.roles, ctx).filter((f) => !slot.items.some((it) => it.foodId === f.id));
      if (!cands.length) return;
      const top = cands.sort(byScore(ctx)).slice(0, 3);
      const f = top[pickRank(ctx.seed, `${slot.type}|${comp.label}`, top.length)]!;
      const b: [number, number] = f.role === 'SUPPLEMENT' ? [0.5, 2] : [0.5, 4];
      const qty = clamp(r025((comp.share * kcalOf[si]!) / f.kcal), b[0], b[1]);
      ctx.used[f.id] = (ctx.used[f.id] ?? 0) + 1;
      slot.items.push(makeItem(f, comp, qty, false));
    });
  });
  const plan: Plan = { t, review: s.review, slots, notes: [], explain: [], ctx, mix };
  rebalance(plan);
  topUp(plan, catalog);
  plan.explain = explainLines(plan, m);
  return { status: 'ok', plan };
}

export function warnings(plan: Plan): string[] {
  const tot = totals(plan);
  const t = plan.t;
  const w: string[] = [];
  const pPct = tot.p / t.p;
  const kPct = tot.kcal / t.kcal;
  if (pPct < 0.95) w.push(`Protein is ${Math.round(pPct * 100)}% of target with the foods allowed for this member. Add more protein foods to the food library.`);
  if (pPct > 1.2) w.push(`Protein is ${Math.round(pPct * 100)}% of target. The foods allowed for this member are protein-dense, so this is as low as the planner can go.`);
  if (Math.abs(kPct - 1) > 0.05) w.push(`Calories are ${Math.round(kPct * 100)}% of target, outside the 5% tolerance.`);
  if (plan.ctx.diabetes && tot.sugar > (0.1 * tot.kcal) / 4) w.push(`Sugar from these foods is ${Math.round(tot.sugar)} g, above the guide of ${Math.round((0.1 * tot.kcal) / 4)} g (10% of calories).`);
  if (plan.ctx.sodium && tot.sodium > 2000) w.push(`Sodium from these foods is ${fmt(tot.sodium)} mg, above 2,000 mg.`);
  return w;
}

export interface SwapOption {
  food: PlannerFood;
  qty: number;
  kcal: number;
}
export function swapOptions(plan: Plan, si: number, ii: number, catalog: PlannerFood[]): SwapOption[] {
  const slot = plan.slots[si]!;
  const it = slot.items[ii]!;
  const inSlot = new Set(slot.items.map((x) => x.foodId));
  const used: Record<string, number> = {};
  allItems(plan).forEach((x) => {
    used[x.foodId] = (used[x.foodId] ?? 0) + 1;
  });
  const ctx: Ctx = { ...plan.ctx, used, seed: 0 };
  return slotCandidates(catalog, slot.type, it.roles, ctx)
    .filter((f) => !inSlot.has(f.id))
    .sort(byScore(ctx))
    .slice(0, 6)
    .map((food) => {
      const b: [number, number] = food.role === 'SUPPLEMENT' ? [0.5, 2] : [0.5, 4];
      const qty = clamp(r025((it.k * it.qty) / food.kcal), b[0], b[1]);
      return { food, qty, kcal: food.kcal * qty };
    });
}

/** Mutates the plan: puts the chosen food in place and re-balances the foods the trainer has not touched. */
export function applySwap(plan: Plan, si: number, ii: number, opt: SwapOption): void {
  const old = plan.slots[si]!.items[ii]!;
  plan.slots[si]!.items[ii] = makeItem(opt.food, { label: old.compLabel, roles: old.roles }, opt.qty, true);
  rebalance(plan);
}

/** Mutates the plan: sets a quantity by hand and re-balances the foods the trainer has not touched. */
export function setQty(plan: Plan, si: number, ii: number, qty: number): void {
  const it = plan.slots[si]!.items[ii]!;
  const b = qtyBounds(it);
  it.qty = clamp(qty, b[0], b[1]);
  it.edited = true;
}
