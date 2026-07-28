'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BranchHoliday } from '../types';

interface HolidaysEditorProps {
  value: BranchHoliday[];
  onChange: (value: BranchHoliday[]) => void;
  disabled?: boolean;
}

/** One-off date closures on top of the weekly Operating Hours pattern — a simple add/remove list, no drag-and-drop needed. */
export function HolidaysEditor({ value, onChange, disabled }: HolidaysEditorProps) {
  const [date, setDate] = React.useState('');
  const [label, setLabel] = React.useState('');

  const add = () => {
    if (!date) return;
    onChange([...value, { date, label: label.trim() || undefined }]);
    setDate('');
    setLabel('');
  };

  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">No holidays added yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {value.map((holiday, index) => (
            <li key={`${holiday.date}-${index}`} className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm">
              <span>
                {holiday.date}
                {holiday.label ? ` — ${holiday.label}` : ''}
              </span>
              <Button type="button" variant="ghost" size="icon" className="size-6" disabled={disabled} onClick={() => remove(index)}>
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label htmlFor="holidayDate" className="text-xs text-muted-foreground">
            Date
          </label>
          <Input id="holidayDate" type="date" value={date} disabled={disabled} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label htmlFor="holidayLabel" className="text-xs text-muted-foreground">
            Label (optional)
          </label>
          <Input id="holidayLabel" value={label} disabled={disabled} placeholder="e.g. New Year" onChange={(e) => setLabel(e.target.value)} />
        </div>
        <Button type="button" variant="outline" size="sm" disabled={disabled || !date} onClick={add}>
          <Plus className="size-4" /> Add
        </Button>
      </div>
    </div>
  );
}
