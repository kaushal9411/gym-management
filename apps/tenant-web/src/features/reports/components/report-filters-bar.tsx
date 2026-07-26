'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBranches } from '@/features/branch/hooks/use-branches';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
);

export interface ReportFilterValue {
  dateFrom: string;
  dateTo: string;
  branchId: string;
}

interface ReportFiltersBarProps {
  value: ReportFilterValue;
  onChange: (value: ReportFilterValue) => void;
  showDateRange?: boolean;
}

/** Shared filter bar (Date Range + Branch) reused across the Reports Center, Report Viewer, and Analytics Dashboard. */
export function ReportFiltersBar({ value, onChange, showDateRange = true }: ReportFiltersBarProps) {
  const branches = useBranches();
  const set = <K extends keyof ReportFilterValue>(key: K, next: ReportFilterValue[K]) => onChange({ ...value, [key]: next });

  return (
    <div className="flex flex-wrap items-end gap-2">
      {showDateRange ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="reportDateFrom" className="text-xs">
              From
            </Label>
            <Input id="reportDateFrom" type="date" className="h-9" value={value.dateFrom} onChange={(e) => set('dateFrom', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="reportDateTo" className="text-xs">
              To
            </Label>
            <Input id="reportDateTo" type="date" className="h-9" value={value.dateTo} onChange={(e) => set('dateTo', e.target.value)} />
          </div>
        </>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="reportBranch" className="text-xs">
          Branch
        </Label>
        <select id="reportBranch" className={selectClassName} value={value.branchId} onChange={(e) => set('branchId', e.target.value)}>
          <option value="">All branches</option>
          {(branches.data ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
