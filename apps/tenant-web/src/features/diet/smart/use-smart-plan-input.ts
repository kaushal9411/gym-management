'use client';

import * as React from 'react';

import { useMemberAttendance } from '@/features/attendance/hooks/use-attendance';
import { useMemberDetail } from '@/features/members/hooks/use-members';
import type { FitnessGoal, FoodPreference, Gender } from '@/features/members/types';
import { useMemberMeasurements } from '@/features/measurements/hooks/use-measurements';
import { useActiveFoods } from '../hooks/use-diet';
import type { Food } from '../types';
import type { DietType, GoalKey, PlannerFood, PlannerMember, Sex } from './engine';
import { STARTER_FOODS } from './starter-foods';

const SEX: Partial<Record<Gender, Sex>> = { MALE: 'M', FEMALE: 'F', OTHER: 'O', PREFER_NOT_TO_SAY: 'O' };
const PREF: Partial<Record<FoodPreference, DietType>> = { VEGAN: 'VEGAN', VEGETARIAN: 'VEGETARIAN', EGGETARIAN: 'EGGETARIAN', NON_VEGETARIAN: 'NON_VEGETARIAN' };
const DAY_MS = 86_400_000;

const num = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export interface SmartMemberInput {
  member: PlannerMember;
  name: string;
  memberCode: string;
  weightSource: string;
}

/** Collects what the planner needs from existing endpoints: profile, latest body measurement, and the last 28 days of attendance. */
export function useSmartMemberInput(memberId: string | null) {
  const detail = useMemberDetail(memberId);
  const measurements = useMemberMeasurements(memberId);
  const attendance = useMemberAttendance(memberId, 1, 100);

  const loading = memberId !== null && (detail.isLoading || measurements.isLoading || attendance.isLoading);

  const input = React.useMemo<SmartMemberInput | null>(() => {
    const d = detail.data;
    if (!d || !measurements.data || !attendance.data) return null;
    const sorted = [...measurements.data].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
    const withWeight = sorted.find((x) => num(x.weightKg) !== null);
    const withHeight = sorted.find((x) => num(x.heightCm) !== null);
    const cutoff = Date.now() - 28 * DAY_MS;
    const visits28 = attendance.data.items.filter((r) => new Date(r.attendanceDate).getTime() >= cutoff).length;
    const weightKg = num(withWeight?.weightKg) ?? num(d.weight);
    return {
      name: d.name,
      memberCode: d.memberId,
      weightSource: withWeight ? `Latest measurement, ${new Date(withWeight.recordedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : weightKg ? 'Member profile' : '',
      member: {
        sex: d.gender ? (SEX[d.gender] ?? null) : null,
        dob: d.dateOfBirth,
        heightCm: num(withHeight?.heightCm) ?? num(d.height),
        weightKg,
        goal: (d.goal as FitnessGoal | null) as GoalKey | null,
        pref: d.foodPreference ? (PREF[d.foodPreference] ?? null) : null,
        allergies: d.allergies ?? '',
        medical: [d.medicalConditions, d.healthScreeningOtherDetails].filter(Boolean).join('. '),
        diabetesOrBp: d.healthDiabetesOrBp === true,
        heart: d.healthHeartCondition === true,
        visits28,
      },
    };
  }, [detail.data, measurements.data, attendance.data]);

  return { input, loading, error: detail.isError || measurements.isError || attendance.isError };
}

const STARTER_BY_NAME = new Map(STARTER_FOODS.map((s) => [s.name.toLowerCase(), s]));

/** Foods in the tenant's library that the planner knows how to use (matched by name against the starter tags). */
export function toPlannerFoods(foods: Food[]): PlannerFood[] {
  const out: PlannerFood[] = [];
  foods.forEach((f) => {
    const tag = STARTER_BY_NAME.get(f.name.trim().toLowerCase());
    if (!tag) return;
    out.push({
      id: f.id,
      name: f.name,
      serving: f.servingSize ?? tag.serving,
      kcal: f.calories ?? tag.kcal,
      p: num(f.protein) ?? tag.p,
      c: num(f.carbohydrates) ?? tag.c,
      f: num(f.fat) ?? tag.f,
      sugar: num(f.sugar) ?? tag.sugar,
      sodium: num(f.sodium) ?? tag.sodium,
      diet: tag.diet,
      role: tag.role,
      meals: tag.meals,
      allergens: tag.allergens,
    });
  });
  return out;
}

export function useSmartCatalog() {
  const foods = useActiveFoods();
  const catalog = React.useMemo(() => toPlannerFoods(foods.data ?? []), [foods.data]);
  return { catalog, loading: foods.isLoading, error: foods.isError };
}
