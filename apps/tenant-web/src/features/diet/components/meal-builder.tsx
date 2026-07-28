'use client';

import * as React from 'react';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Food, MealType, PlanMeal, PlanMealInput } from '../types';
import { MEAL_TYPES } from '../types';

const selectClassName = cn(
  'h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm shadow-xs transition-all duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50',
);

const MEAL_LABELS: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  MORNING_SNACK: 'Morning Snack',
  LUNCH: 'Lunch',
  EVENING_SNACK: 'Evening Snack',
  DINNER: 'Dinner',
  PRE_WORKOUT: 'Pre Workout',
  POST_WORKOUT: 'Post Workout',
};

interface BuilderItem extends PlanMealInput {
  key: string;
  foodName: string;
}

function toBuilderItems(meals: PlanMeal[]): BuilderItem[] {
  return meals.map((m) => ({
    key: m.id,
    foodId: m.food.id,
    foodName: m.food.name,
    mealType: m.mealType,
    quantity: Number(m.quantity),
    notes: m.notes ?? undefined,
  }));
}

interface MealBuilderProps {
  initialMeals: PlanMeal[];
  foodOptions: Food[];
  disabled?: boolean;
  onChange: (meals: PlanMealInput[], isDirty: boolean) => void;
}

/** Grouped by meal type (Breakfast/Lunch/etc.) — NOT tied to a day of the week, since a diet plan's meals repeat every day of the plan. */
export function MealBuilder({ initialMeals, foodOptions, disabled, onChange }: MealBuilderProps) {
  const [items, setItems] = React.useState<BuilderItem[]>(() => toBuilderItems(initialMeals));
  const baseline = React.useMemo(() => toBuilderItems(initialMeals), [initialMeals]);
  const [addMealType, setAddMealType] = React.useState<MealType>('BREAKFAST');
  const [addFoodId, setAddFoodId] = React.useState('');
  const [addQuantity, setAddQuantity] = React.useState('1');

  const emit = (next: BuilderItem[]) => {
    setItems(next);
    const dirty =
      JSON.stringify(next.map((i) => ({ f: i.foodId, m: i.mealType, q: i.quantity }))) !==
      JSON.stringify(baseline.map((i) => ({ f: i.foodId, m: i.mealType, q: i.quantity })));
    onChange(
      next.map(({ foodId, mealType, quantity, notes }) => ({ foodId, mealType, quantity, notes })),
      dirty,
    );
  };

  const addFood = () => {
    if (!addFoodId) return;
    const food = foodOptions.find((f) => f.id === addFoodId);
    if (!food) return;
    emit([
      ...items,
      {
        key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        foodId: food.id,
        foodName: food.name,
        mealType: addMealType,
        quantity: Number(addQuantity) || 1,
      },
    ]);
    setAddFoodId('');
    setAddQuantity('1');
  };

  const removeItem = (key: string) => emit(items.filter((i) => i.key !== key));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-40 space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="mealType">
            Meal
          </label>
          <select id="mealType" className={selectClassName} value={addMealType} disabled={disabled} onChange={(e) => setAddMealType(e.target.value as MealType)}>
            {MEAL_TYPES.map((mt) => (
              <option key={mt} value={mt}>
                {MEAL_LABELS[mt]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-56 flex-1 space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="mealFood">
            Food
          </label>
          <select id="mealFood" className={selectClassName} value={addFoodId} disabled={disabled} onChange={(e) => setAddFoodId(e.target.value)}>
            <option value="">Select a food…</option>
            {foodOptions.map((food) => (
              <option key={food.id} value={food.id}>
                {food.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-24 space-y-1">
          <label className="text-xs text-muted-foreground" htmlFor="mealQuantity">
            Qty
          </label>
          <input
            id="mealQuantity"
            type="number"
            min={0.1}
            step="0.1"
            className={selectClassName}
            value={addQuantity}
            disabled={disabled}
            onChange={(e) => setAddQuantity(e.target.value)}
          />
        </div>
        <Button type="button" size="sm" disabled={disabled || !addFoodId} onClick={addFood}>
          Add to meal
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {MEAL_TYPES.map((mealType) => {
          const mealItems = items.filter((i) => i.mealType === mealType);
          return (
            <div key={mealType} className="rounded-xl border bg-card p-3.5 shadow-xs">
              <h4 className="mb-2.5 text-sm font-semibold text-foreground/90">{MEAL_LABELS[mealType]}</h4>
              {mealItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">No foods added.</p>
              ) : (
                <ul className="space-y-1.5">
                  {mealItems.map((item) => (
                    <li key={item.key} className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-2.5 py-2 text-sm transition-colors hover:bg-muted/60">
                      <span>
                        {item.foodName} <span className="text-xs text-muted-foreground">×{item.quantity}</span>
                      </span>
                      {!disabled ? (
                        <button
                          type="button"
                          aria-label={`Remove ${item.foodName} from ${MEAL_LABELS[mealType]}`}
                          className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => removeItem(item.key)}
                        >
                          <X className="size-3.5" />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
