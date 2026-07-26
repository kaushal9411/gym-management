'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { IncomeCategory } from '../types';

const selectClassName = cn(
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
);

export interface IncomeFormState {
  category: IncomeCategory;
  amount: string;
  incomeDate: string;
  description: string;
}

export const DEFAULT_INCOME_FORM_STATE: IncomeFormState = {
  category: 'MEMBERSHIP_FEE',
  amount: '',
  incomeDate: new Date().toISOString().slice(0, 10),
  description: '',
};

interface IncomeFormFieldsProps {
  value: IncomeFormState;
  onChange: (value: IncomeFormState) => void;
  disabled?: boolean;
}

export function IncomeFormFields({ value, onChange, disabled }: IncomeFormFieldsProps) {
  const set = <K extends keyof IncomeFormState>(key: K, next: IncomeFormState[K]) => onChange({ ...value, [key]: next });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="incomeCategory">Category</Label>
          <select id="incomeCategory" className={selectClassName} value={value.category} disabled={disabled} onChange={(e) => set('category', e.target.value as IncomeCategory)}>
            <option value="MEMBERSHIP_FEE">Membership Fee</option>
            <option value="PERSONAL_TRAINING">Personal Training</option>
            <option value="PRODUCT_SALES">Product Sales</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="incomeAmount">Amount</Label>
          <Input id="incomeAmount" type="number" min={0} step="0.01" value={value.amount} disabled={disabled} onChange={(e) => set('amount', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="incomeDate">Date</Label>
          <Input id="incomeDate" type="date" value={value.incomeDate} disabled={disabled} onChange={(e) => set('incomeDate', e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="incomeDescription">Description</Label>
        <textarea
          id="incomeDescription"
          className="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          value={value.description}
          disabled={disabled}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>
    </div>
  );
}
