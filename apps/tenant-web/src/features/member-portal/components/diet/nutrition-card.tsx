'use client';

import * as React from 'react';
import { Flame, Info } from 'lucide-react';

import { EXTRA_NUTRIENTS, MACROS, fmtNum, pct, planHas, r0, r1, type DietNutrition, type NutritionDay } from '../../lib/diet-nutrition';
import { EmptyBlock, SectionCard, toneColor, toneTint } from '../kit';
import { CalorieRing } from './calorie-ring';
import { GrowBar, Pop } from './motion-bits';

/** Calorie ring + macro bars + secondary nutrient chips for ONE day: what the member ate (completed meals) vs the plan. */
export function NutritionCard({ nutrition, day, isToday }: { nutrition: DietNutrition; day: NutritionDay; isToday: boolean }) {
  const { planned } = nutrition;
  const denom = planned.calories > 0 ? planned.calories : (nutrition.calorieTarget ?? 0);
  const hasAnyPlanData = planned.calories > 0 || planned.protein > 0 || planned.carbs > 0 || planned.fat > 0;
  const left = Math.max(0, denom - day.eaten.calories);
  const extras = EXTRA_NUTRIENTS.filter((e) => planHas(planned, e.key));

  return (
    <SectionCard title={isToday ? "Today's nutrition" : 'Nutrition that day'} subtitle="Counted from the meals you marked done" icon={Flame} tone="orange">
      {!hasAnyPlanData ? (
        <EmptyBlock compact icon={Info} title="No nutrition values yet" description="The foods in your plan don't have calories or macros filled in, so intake can't be calculated. Your trainer can add them." />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8">
            <Pop>
              <CalorieRing eaten={day.eaten.calories} planned={denom} />
            </Pop>
            <div className="w-full min-w-0 flex-1 space-y-3.5">
              {denom > 0 ? (
                <p className="text-center text-sm sm:text-left">
                  <span className="font-semibold tabular-nums">{fmtNum(r0(left))} kcal</span> <span className="text-muted-foreground">{isToday ? 'still to eat today' : 'not eaten that day'}</span>
                </p>
              ) : null}
              {MACROS.map((m, i) => {
                const planBase = planned[m.key];
                if (planBase <= 0) return null;
                const eaten = day.eaten[m.key];
                return (
                  <div key={m.key}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-semibold" style={{ color: toneColor(m.tone) }}>
                        {m.label}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        <span className="font-semibold text-foreground">{fmtNum(r1(eaten))}</span> / {fmtNum(r1(planBase))} g
                      </span>
                    </div>
                    <GrowBar value={pct(eaten, planBase)} tone={m.tone} delay={0.08 * i} label={`${m.label} eaten`} />
                  </div>
                );
              })}
            </div>
          </div>

          {extras.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {extras.map((e, i) => (
                <Pop key={e.key} delay={0.05 * i}>
                  <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium tabular-nums" style={{ background: toneTint(e.tone, 14), color: toneColor(e.tone) }}>
                    {e.label}
                    <span className="font-semibold text-foreground">
                      {fmtNum(r1(day.eaten[e.key]))} / {fmtNum(r1(planned[e.key]))} {e.unit}
                    </span>
                  </span>
                </Pop>
              ))}
            </div>
          ) : null}

          {nutrition.itemsWithoutData > 0 ? (
            <p className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Some foods have no nutrition data ({nutrition.itemsWithoutData} of {nutrition.itemsTotal} in your plan), so totals can read lower than what you really ate.
              </span>
            </p>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}
