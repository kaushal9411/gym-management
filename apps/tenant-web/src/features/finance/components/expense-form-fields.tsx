'use client';

import * as React from 'react';
import { FileText, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fileToDataUrl, fileToRawDataUrl } from '@/lib/image-to-data-url';
import { cn } from '@/lib/utils';
import type { ExpenseCategory } from '../types';

const selectClassName = cn(
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
);

const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;

export interface ExpenseFormState {
  category: ExpenseCategory;
  amount: string;
  expenseDate: string;
  description: string;
  receiptFileName: string;
  receiptDataUrl: string;
}

export const DEFAULT_EXPENSE_FORM_STATE: ExpenseFormState = {
  category: 'RENT',
  amount: '',
  expenseDate: new Date().toISOString().slice(0, 10),
  description: '',
  receiptFileName: '',
  receiptDataUrl: '',
};

interface ExpenseFormFieldsProps {
  value: ExpenseFormState;
  onChange: (value: ExpenseFormState) => void;
  disabled?: boolean;
}

export function ExpenseFormFields({ value, onChange, disabled }: ExpenseFormFieldsProps) {
  const set = <K extends keyof ExpenseFormState>(key: K, next: ExpenseFormState[K]) => onChange({ ...value, [key]: next });
  const [uploading, setUploading] = React.useState(false);

  const handleReceiptFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = file.type.startsWith('image/') ? await fileToDataUrl(file, 1280) : await fileToRawDataUrl(file, MAX_RECEIPT_BYTES);
      onChange({ ...value, receiptFileName: file.name, receiptDataUrl: dataUrl });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't read that file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="expenseCategory">Category</Label>
          <select
            id="expenseCategory"
            className={selectClassName}
            value={value.category}
            disabled={disabled}
            onChange={(e) => set('category', e.target.value as ExpenseCategory)}
          >
            <option value="RENT">Rent</option>
            <option value="SALARY">Salary</option>
            <option value="UTILITIES">Utilities</option>
            <option value="EQUIPMENT">Equipment</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="MARKETING">Marketing</option>
            <option value="OFFICE_SUPPLIES">Office Supplies</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="expenseAmount">Amount</Label>
          <Input id="expenseAmount" type="number" min={0} step="0.01" value={value.amount} disabled={disabled} onChange={(e) => set('amount', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expenseDate">Date</Label>
          <Input id="expenseDate" type="date" value={value.expenseDate} disabled={disabled} onChange={(e) => set('expenseDate', e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="expenseDescription">Description</Label>
        <textarea
          id="expenseDescription"
          className="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          value={value.description}
          disabled={disabled}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Receipt</Label>
        {value.receiptFileName ? (
          <div className="flex items-center gap-2 rounded-lg border p-2.5">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-sm">{value.receiptFileName}</span>
            {!disabled ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...value, receiptFileName: '', receiptDataUrl: '' })}>
                Remove
              </Button>
            ) : null}
          </div>
        ) : (
          <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:border-input">
            <Upload className="size-4" />
            {uploading ? 'Uploading…' : 'Upload receipt (image or PDF)'}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              disabled={disabled || uploading}
              onChange={(e) => {
                void handleReceiptFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
