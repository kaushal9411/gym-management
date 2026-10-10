'use client';

import * as React from 'react';
import { Apple, Minus, Plus, Shuffle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PanelCard } from '@/features/members/components/detail/detail-ui';
import type { MealType } from '../types';
import { qtyRange, swapOptions, type Plan, type PlannerFood, type SwapOption } from './engine';

const MEAL_ACCENT: Record<MealType, string> = {
  BREAKFAST: 'var(--chart-4)',
  MORNING_SNACK: 'var(--chart-6)',
  LUNCH: 'var(--chart-2)',
  EVENING_SNACK: 'var(--chart-5)',
  DINNER: 'var(--chart-7)',
  PRE_WORKOUT: 'var(--chart-3)',
  POST_WORKOUT: 'var(--primary)',
};

const n0 = (n: number) => Math.round(n).toLocaleString('en-US');
const q2 = (n: number) => String(+n.toFixed(2));

interface SmartPlanMealsProps {
  plan: Plan;
  catalog: PlannerFood[];
  disabled: boolean;
  onQty: (si: number, ii: number, qty: number) => void;
  onSwap: (si: number, ii: number, option: SwapOption) => void;
  onShuffle: () => void;
}

/** Meals grouped by meal type (the plan repeats every day), each food with a quantity stepper and a swap list. */
export function SmartPlanMeals({ plan, catalog, disabled, onQty, onSwap, onShuffle }: SmartPlanMealsProps) {
  const [open, setOpen] = React.useState<string | null>(null);

  return (
    <PanelCard
      icon={Apple}
      accent="warning"
      title="Daily meals"
      delay={0.05}
      right={
        <Button type="button" variant="outline" size="sm" onClick={onShuffle} disabled={disabled}>
          <Shuffle className="size-3.5" /> Try another mix
        </Button>
      }
    >
      <div className="-mx-5 -mb-5 divide-y">
        {plan.slots.map((slot, si) => {
          const slotKcal = slot.items.reduce((a, it) => a + it.k * it.qty, 0);
          return (
            <div key={slot.type}>
              <div className="flex items-center gap-2.5 px-5 py-3" style={{ backgroundColor: `color-mix(in oklch, ${MEAL_ACCENT[slot.type]} 8%, transparent)` }}>
                <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: MEAL_ACCENT[slot.type] }} />
                <b className="font-bold">{slot.label}</b>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">{n0(slotKcal)} kcal</span>
              </div>
              {slot.items.map((it, ii) => {
                const key = `${si}-${ii}`;
                const [lo, hi] = qtyRange(it);
                const isOpen = open === key;
                const options = isOpen ? swapOptions(plan, si, ii, catalog) : [];
                return (
                  <div key={`${it.foodId}-${ii}`} className="grid gap-x-4 gap-y-1.5 border-t border-dashed px-5 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="break-words font-semibold">{it.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {it.serving} per portion, {it.compLabel.toLowerCase()}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-1.5 tabular-nums">
                      <Button type="button" variant="outline" size="icon" className="size-7 rounded-lg" aria-label={`Less ${it.name}`} disabled={disabled || it.qty <= lo} onClick={() => onQty(si, ii, it.qty - 0.25)}>
                        <Minus className="size-3.5" />
                      </Button>
                      <output className="min-w-10 text-center text-sm font-semibold">{q2(it.qty)} x</output>
                      <Button type="button" variant="outline" size="icon" className="size-7 rounded-lg" aria-label={`More ${it.name}`} disabled={disabled || it.qty >= hi} onClick={() => onQty(si, ii, it.qty + 0.25)}>
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                    <p className="whitespace-nowrap text-xs tabular-nums text-muted-foreground sm:text-right">
                      <strong className="font-semibold text-foreground">{n0(it.k * it.qty)} kcal</strong>
                      <br />P {n0(it.p * it.qty)} C {n0(it.c * it.qty)} F {n0(it.f * it.qty)}
                    </p>
                    <div className="flex items-center gap-2 sm:col-span-3">
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={disabled} onClick={() => setOpen(isOpen ? null : key)}>
                        {isOpen ? 'Close' : 'Swap food'}
                      </Button>
                      {it.edited ? <Badge variant="secondary">Edited</Badge> : null}
                    </div>
                    {isOpen ? (
                      <div className="flex flex-wrap gap-1.5 sm:col-span-3">
                        {options.length === 0 ? <span className="text-xs text-muted-foreground">No other foods fit this slot.</span> : null}
                        {options.map((o) => (
                          <button
                            key={o.food.id}
                            type="button"
                            disabled={disabled}
                            className="rounded-full border border-input bg-card px-2.5 py-1 text-xs hover:bg-accent"
                            onClick={() => {
                              onSwap(si, ii, o);
                              setOpen(null);
                            }}
                          >
                            {o.food.name} <em className="not-italic text-muted-foreground">{q2(o.qty)} x, {n0(o.kcal)} kcal</em>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </PanelCard>
  );
}
