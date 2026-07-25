'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface FoodFormState {
  name: string;
  category: string;
  servingSize: string;
  calories: string;
  protein: string;
  carbohydrates: string;
  fat: string;
  fiber: string;
  sugar: string;
  sodium: string;
  notes: string;
  isActive: boolean;
}

export const DEFAULT_FOOD_FORM_STATE: FoodFormState = {
  name: '',
  category: '',
  servingSize: '',
  calories: '',
  protein: '',
  carbohydrates: '',
  fat: '',
  fiber: '',
  sugar: '',
  sodium: '',
  notes: '',
  isActive: true,
};

interface FoodFormFieldsProps {
  value: FoodFormState;
  onChange: (value: FoodFormState) => void;
  disabled?: boolean;
}

export function FoodFormFields({ value, onChange, disabled }: FoodFormFieldsProps) {
  const set = <K extends keyof FoodFormState>(key: K, next: FoodFormState[K]) => onChange({ ...value, [key]: next });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="foodName">Food name</Label>
          <Input id="foodName" value={value.name} disabled={disabled} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="foodCategory">Category</Label>
          <Input id="foodCategory" value={value.category} disabled={disabled} onChange={(e) => set('category', e.target.value)} placeholder="e.g. Grains" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="foodServingSize">Serving size</Label>
          <Input
            id="foodServingSize"
            value={value.servingSize}
            disabled={disabled}
            onChange={(e) => set('servingSize', e.target.value)}
            placeholder="e.g. 100g, 1 cup"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="foodCalories">Calories</Label>
          <Input id="foodCalories" type="number" min={0} value={value.calories} disabled={disabled} onChange={(e) => set('calories', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="foodProtein">Protein (g)</Label>
          <Input id="foodProtein" type="number" min={0} step="0.1" value={value.protein} disabled={disabled} onChange={(e) => set('protein', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="foodCarbs">Carbohydrates (g)</Label>
          <Input
            id="foodCarbs"
            type="number"
            min={0}
            step="0.1"
            value={value.carbohydrates}
            disabled={disabled}
            onChange={(e) => set('carbohydrates', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="foodFat">Fat (g)</Label>
          <Input id="foodFat" type="number" min={0} step="0.1" value={value.fat} disabled={disabled} onChange={(e) => set('fat', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="foodFiber">Fiber (g)</Label>
          <Input id="foodFiber" type="number" min={0} step="0.1" value={value.fiber} disabled={disabled} onChange={(e) => set('fiber', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="foodSugar">Sugar (g)</Label>
          <Input id="foodSugar" type="number" min={0} step="0.1" value={value.sugar} disabled={disabled} onChange={(e) => set('sugar', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="foodSodium">Sodium (mg)</Label>
          <Input id="foodSodium" type="number" min={0} step="0.1" value={value.sodium} disabled={disabled} onChange={(e) => set('sodium', e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="foodNotes">Notes</Label>
        <textarea
          id="foodNotes"
          className="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          value={value.notes}
          disabled={disabled}
          onChange={(e) => set('notes', e.target.value)}
        />
      </div>

      <label className="flex items-center gap-1.5 text-sm">
        <Checkbox id="foodIsActive" checked={value.isActive} disabled={disabled} onCheckedChange={(c) => set('isActive', c === true)} />
        Active
      </label>
    </div>
  );
}
