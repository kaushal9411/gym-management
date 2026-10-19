import { Apple, Coffee, Cookie, Dumbbell, Moon, Salad, UtensilsCrossed, Zap, type LucideIcon } from 'lucide-react';

import type { PortalTone } from '../components/kit/tones';

/** Mirrors the additive `nutrition` block of `GET /portal/diet` (see BACKEND-GUIDE "Member diet nutrition"). All figures are derived from the member's real logs + plan foods. */
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
export type MealStatus = 'PENDING' | 'COMPLETED' | 'SKIPPED';

export interface NutritionItem {
  name: string;
  servingSize: string | null;
  quantity: number;
  nutrients: Nutrients;
  hasData: boolean;
}
export interface NutritionPlanMeal {
  mealType: string;
  nutrients: Nutrients;
  items: NutritionItem[];
}
export interface NutritionDay {
  date: string;
  logged: boolean;
  mealsPlanned: number;
  mealsCompleted: number;
  mealsSkipped: number;
  mealsPending: number;
  allDone: boolean;
  meals: { mealType: string; status: MealStatus }[];
  eaten: Nutrients;
  waterMl: number | null;
  weightKg: number | null;
}
export interface DietInsight {
  id: string;
  tone: 'good' | 'warn' | 'tip';
  title: string;
  body: string;
}
export interface DietNutrition {
  /** Member's branch-local date - log against this, not the device clock. */
  today: string;
  planStarted: boolean;
  planned: Nutrients;
  calorieTarget: number | null;
  waterTargetMl: number;
  waterTargetIsDefault: boolean;
  itemsTotal: number;
  itemsWithoutData: number;
  meals: NutritionPlanMeal[];
  days: NutritionDay[];
  week: {
    windowDays: number;
    countedDays: number;
    loggedDays: number;
    mealsPlanned: number;
    mealsCompleted: number;
    mealsSkipped: number;
    adherencePct: number | null;
    avgEaten: Nutrients | null;
    avgDays: number;
    avgWaterMl: number | null;
    waterDays: number;
  };
  streakDays: number;
  weight: { first: { date: string; kg: number }; last: { date: string; kg: number }; deltaKg: number; entries: number } | null;
  insights: DietInsight[];
}

export const mealLabel = (s: string): string => s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const MEAL_STYLE: Record<string, { icon: LucideIcon; tone: PortalTone }> = {
  BREAKFAST: { icon: Coffee, tone: 'warning' },
  MORNING_SNACK: { icon: Apple, tone: 'success' },
  LUNCH: { icon: UtensilsCrossed, tone: 'orange' },
  EVENING_SNACK: { icon: Cookie, tone: 'violet' },
  DINNER: { icon: Moon, tone: 'info' },
  PRE_WORKOUT: { icon: Zap, tone: 'primary' },
  POST_WORKOUT: { icon: Dumbbell, tone: 'danger' },
};
export const mealStyle = (mealType: string): { icon: LucideIcon; tone: PortalTone } => MEAL_STYLE[mealType] ?? { icon: Salad, tone: 'primary' };

/** Macro rows shown as animated bars (tone per nutrient is fixed so colours mean the same everywhere). */
export const MACROS: { key: 'protein' | 'carbs' | 'fat'; label: string; tone: PortalTone }[] = [
  { key: 'protein', label: 'Protein', tone: 'success' },
  { key: 'carbs', label: 'Carbs', tone: 'warning' },
  { key: 'fat', label: 'Fat', tone: 'violet' },
];

/** Secondary nutrients: a chip only appears when the plan has real values for it (never "0" for missing data). */
export const EXTRA_NUTRIENTS: { key: 'fiber' | 'sugar' | 'sodium'; label: string; unit: string; tone: PortalTone }[] = [
  { key: 'fiber', label: 'Fibre', unit: 'g', tone: 'success' },
  { key: 'sugar', label: 'Sugar', unit: 'g', tone: 'danger' },
  { key: 'sodium', label: 'Sodium', unit: 'mg', tone: 'info' },
];

export const r0 = (n: number): number => Math.round(n);
export const r1 = (n: number): number => Math.round(n * 10) / 10;
export const pct = (value: number, of: number): number => (of > 0 ? Math.max(0, Math.min(100, (value / of) * 100)) : 0);
export const fmtNum = (n: number): string => n.toLocaleString('en-IN', { maximumFractionDigits: 1 });
export const shortDate = (d: string): string => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
export const weekdayShort = (d: string): string => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });

/** Nutrients the day's plan can't back with data (all foods null) -> hide, don't show 0. */
export const planHas = (planned: Nutrients, key: keyof Nutrients): boolean => planned[key] > 0;

export const INSIGHT_TONE: Record<DietInsight['tone'], PortalTone> = { good: 'success', warn: 'warning', tip: 'info' };
