'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
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
    <div className="space-y-1.5">
      {DAYS.map(({ key, label }) => {
        const day = dayFor(key);
        return (
          <div
            key={key}
            className={cn(
              'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-transparent px-2.5 py-2 transition-colors duration-150 sm:grid sm:grid-cols-[100px_1fr_auto_1fr_auto]',
              day.closed ? 'bg-muted/30' : 'hover:bg-accent/40 hover:border-border',
            )}
          >
            <Label className="w-full text-sm font-medium sm:w-auto">{label}</Label>
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:contents">
              <Input
                type="time"
                aria-label={`${label} opening time`}
                value={day.open ?? ''}
                disabled={disabled || day.closed}
                onChange={(e) => update(key, { open: e.target.value })}
                className="min-w-0 flex-1 sm:flex-initial"
              />
              <span className="shrink-0 text-xs text-muted-foreground">to</span>
              <Input
                type="time"
                aria-label={`${label} closing time`}
                value={day.close ?? ''}
                disabled={disabled || day.closed}
                onChange={(e) => update(key, { close: e.target.value })}
                className="min-w-0 flex-1 sm:flex-initial"
              />
            </div>
            <span className="flex shrink-0 items-center gap-2">
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
