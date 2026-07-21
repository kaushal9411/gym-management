'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { EmploymentType, SalaryType, WorkStatus } from '../types';

const selectClassName = cn(
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
);

const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

export interface EmploymentInfoValue {
  employmentType: EmploymentType;
  salaryType: SalaryType;
  salaryAmount: string;
  shift: string;
  weeklyOff: string;
  workStatus: WorkStatus;
}

interface EmploymentInfoFieldsProps {
  value: EmploymentInfoValue;
  onChange: (value: EmploymentInfoValue) => void;
  disabled?: boolean;
}

/** Employment Information section — shared by Create Staff and Edit Staff. */
export function EmploymentInfoFields({ value, onChange, disabled }: EmploymentInfoFieldsProps) {
  const set = <K extends keyof EmploymentInfoValue>(key: K, next: EmploymentInfoValue[K]) =>
    onChange({ ...value, [key]: next });

  const selectedOffDays = value.weeklyOff ? value.weeklyOff.split(',').filter(Boolean) : [];
  const toggleOffDay = (day: string, checked: boolean) => {
    const next = checked ? [...selectedOffDays, day] : selectedOffDays.filter((d) => d !== day);
    set('weeklyOff', next.join(','));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="employmentType">Employment type</Label>
          <select
            id="employmentType"
            className={selectClassName}
            value={value.employmentType}
            disabled={disabled}
            onChange={(e) => set('employmentType', e.target.value as EmploymentType)}
          >
            <option value="FULL_TIME">Full-time</option>
            <option value="PART_TIME">Part-time</option>
            <option value="CONTRACT">Contract</option>
            <option value="INTERN">Intern</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="salaryType">Salary type</Label>
          <select
            id="salaryType"
            className={selectClassName}
            value={value.salaryType}
            disabled={disabled}
            onChange={(e) => set('salaryType', e.target.value as SalaryType)}
          >
            <option value="MONTHLY">Monthly</option>
            <option value="HOURLY">Hourly</option>
            <option value="DAILY">Daily</option>
            <option value="PER_SESSION">Per session</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="salaryAmount">Salary amount</Label>
          <Input
            id="salaryAmount"
            type="number"
            min={0}
            step="0.01"
            value={value.salaryAmount}
            disabled={disabled}
            onChange={(e) => set('salaryAmount', e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="shift">Shift</Label>
          <Input
            id="shift"
            placeholder="e.g. Morning (6am–2pm)"
            value={value.shift}
            disabled={disabled}
            onChange={(e) => set('shift', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="workStatus">Work status</Label>
          <select
            id="workStatus"
            className={selectClassName}
            value={value.workStatus}
            disabled={disabled}
            onChange={(e) => set('workStatus', e.target.value as WorkStatus)}
          >
            <option value="WORKING">Working</option>
            <option value="ON_LEAVE">On leave</option>
            <option value="NOTICE_PERIOD">Notice period</option>
            <option value="TERMINATED">Terminated</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Weekly off</Label>
        <div className="flex flex-wrap gap-3 rounded-lg border p-3">
          {WEEKDAYS.map((day) => (
            <div key={day} className="flex items-center gap-1.5">
              <Checkbox
                id={`weekly-off-${day}`}
                checked={selectedOffDays.includes(day)}
                disabled={disabled}
                onCheckedChange={(checked) => toggleOffDay(day, checked === true)}
              />
              <Label htmlFor={`weekly-off-${day}`} className="cursor-pointer text-xs font-normal capitalize">
                {day.slice(0, 3).toLowerCase()}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
