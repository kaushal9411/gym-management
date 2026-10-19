'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, SkipForward, Undo2, Utensils } from 'lucide-react';

import { cn } from '@/lib/utils';
import { fmtNum, mealLabel, mealStyle, r0, r1, type MealStatus, type NutritionDay, type NutritionPlanMeal } from '../../lib/diet-nutrition';
import { EmptyBlock, SectionCard, StatusChip, toneColor, toneTint } from '../kit';
import { Pop, PressButton, useBounce } from './motion-bits';

/** Big tappable meal cards for the selected day: foods + kcal/protein, Done / Skip / Undo. */
export function MealCards({
  meals,
  day,
  pendingMeal,
  disabled,
  onSet,
  subtitle,
}: {
  meals: NutritionPlanMeal[];
  day: NutritionDay;
  /** Meal currently being saved (its buttons are disabled). */
  pendingMeal: string | null;
  disabled: boolean;
  onSet: (mealType: string, status: MealStatus) => void;
  subtitle: string;
}) {
  const [open, setOpen] = React.useState<string | null>(null);
  const b = useBounce();
  const statusOf = (t: string): MealStatus => day.meals.find((m) => m.mealType === t)?.status ?? 'PENDING';

  return (
    <SectionCard title="Meals" subtitle={subtitle} icon={Utensils} tone="success">
      {meals.length === 0 ? (
        <EmptyBlock compact icon={Utensils} tone="success" title="No meals in your plan yet" />
      ) : (
        <div className="space-y-3">
          {meals.map((meal, i) => {
            const status = statusOf(meal.mealType);
            const style = mealStyle(meal.mealType);
            const tone = status === 'COMPLETED' ? 'success' : status === 'SKIPPED' ? 'muted' : style.tone;
            const Icon = style.icon;
            const isOpen = open === meal.mealType;
            const busy = pendingMeal === meal.mealType;
            const hasMacros = meal.nutrients.calories > 0 || meal.nutrients.protein > 0;
            return (
              <Pop key={meal.mealType} delay={0.06 * i}>
                <div
                  className="overflow-hidden rounded-2xl border"
                  style={{ background: `linear-gradient(135deg, ${toneTint(tone, status === 'PENDING' ? 9 : 16)}, transparent 75%)`, borderColor: toneTint(tone, status === 'PENDING' ? 28 : 45) }}
                >
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : meal.mealType)}
                    aria-expanded={isOpen}
                    className="flex min-h-16 w-full items-center gap-3 p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <motion.span
                      key={status}
                      initial={b.reduce ? false : { scale: 0.4, rotate: -25, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      transition={b.spring}
                      className="grid size-11 shrink-0 place-items-center rounded-2xl text-white shadow-sm"
                      style={{ background: status === 'PENDING' ? `linear-gradient(135deg, ${toneColor(tone)}, color-mix(in oklab, ${toneColor(tone)} 60%, white))` : toneColor(tone) }}
                    >
                      {status === 'COMPLETED' ? <Check className="size-5" aria-hidden /> : status === 'SKIPPED' ? <SkipForward className="size-5" aria-hidden /> : <Icon className="size-5" aria-hidden />}
                    </motion.span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{mealLabel(meal.mealType)}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {hasMacros ? `${fmtNum(r0(meal.nutrients.calories))} kcal · ${fmtNum(r1(meal.nutrients.protein))} g protein` : `${meal.items.length} item${meal.items.length === 1 ? '' : 's'}`}
                      </span>
                    </span>
                    {status !== 'PENDING' ? <StatusChip tone={status === 'COMPLETED' ? 'success' : 'muted'}>{status === 'COMPLETED' ? 'Done' : 'Skipped'}</StatusChip> : null}
                    <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} aria-hidden />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.ul
                        initial={b.reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={b.soft}
                        className="overflow-hidden px-3.5"
                      >
                        {meal.items.map((it, idx) => (
                          <li key={`${it.name}-${idx}`} className="flex items-baseline justify-between gap-3 border-t py-2 text-xs first:border-t-0">
                            <span className="min-w-0 flex-1 truncate font-medium">
                              {it.name}
                              <span className="font-normal text-muted-foreground">
                                {' '}
                                · {it.quantity !== 1 ? `${it.quantity} × ` : ''}
                                {it.servingSize ?? 'serving'}
                              </span>
                            </span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">{it.hasData ? `${fmtNum(r0(it.nutrients.calories))} kcal` : 'no data'}</span>
                          </li>
                        ))}
                      </motion.ul>
                    ) : null}
                  </AnimatePresence>

                  <div className="p-3.5 pt-2">
                    {status === 'PENDING' ? (
                      <div className="grid grid-cols-2 gap-2">
                        <PressButton
                          aria-label={`Mark ${mealLabel(meal.mealType)} done`}
                          disabled={disabled || busy}
                          onClick={() => onSet(meal.mealType, 'COMPLETED')}
                          className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-success text-sm font-semibold text-white shadow-sm"
                        >
                          <Check className="size-4" aria-hidden /> Done
                        </PressButton>
                        <PressButton
                          aria-label={`Skip ${mealLabel(meal.mealType)}`}
                          disabled={disabled || busy}
                          onClick={() => onSet(meal.mealType, 'SKIPPED')}
                          className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border bg-card text-sm font-semibold text-muted-foreground hover:bg-accent"
                        >
                          <SkipForward className="size-4" aria-hidden /> Skip
                        </PressButton>
                      </div>
                    ) : (
                      <PressButton
                        aria-label={`Undo ${mealLabel(meal.mealType)}`}
                        disabled={disabled || busy}
                        onClick={() => onSet(meal.mealType, 'PENDING')}
                        className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border bg-card text-sm font-medium text-muted-foreground hover:bg-accent"
                      >
                        <Undo2 className="size-4" aria-hidden /> Undo
                      </PressButton>
                    )}
                  </div>
                </div>
              </Pop>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
