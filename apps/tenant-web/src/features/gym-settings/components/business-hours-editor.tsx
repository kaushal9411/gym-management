'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BusinessHours, Weekday } from '../types';

const DAYS: Array<{ key: Weekday; label: string }> = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

interface BusinessHoursEditorProps {
  value: BusinessHours;
  onChange: (value: BusinessHours) => void;
  disabled?: boolean;
}

export function BusinessHoursEditor({ value, onChange, disabled }: BusinessHoursEditorProps) {
  const dayFor = (key: Weekday) => value[key] ?? { open: '06:00', close: '22:00', closed: false };

  const update = (key: Weekday, patch: Partial<{ open: string; close: string; closed: boolean }>) => {
    onChange({ ...value, [key]: { ...dayFor(key), ...patch } });
  };

  return (
    <div className="space-y-2">
      {DAYS.map(({ key, label }) => {
        const day = dayFor(key);
        return (
          <div key={key} className="grid grid-cols-[100px_1fr_auto_1fr_auto] items-center gap-3">
            <Label className="text-sm">{label}</Label>
            <Input
              type="time"
              aria-label={`${label} opening time`}
              value={day.open ?? ''}
              disabled={disabled || day.closed}
              onChange={(e) => update(key, { open: e.target.value })}
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="time"
              aria-label={`${label} closing time`}
              value={day.close ?? ''}
              disabled={disabled || day.closed}
              onChange={(e) => update(key, { close: e.target.value })}
            />
            <span className="flex items-center gap-2">
              <Checkbox
                id={`closed-${key}`}
                checked={day.closed}
                disabled={disabled}
                onCheckedChange={(checked) => update(key, { closed: checked === true })}
              />
              <Label htmlFor={`closed-${key}`} className="cursor-pointer text-xs font-normal text-muted-foreground">
                Closed
              </Label>
            </span>
          </div>
        );
      })}
    </div>
  );
}
