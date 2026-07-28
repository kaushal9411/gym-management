'use client';

import { useBranches } from '@/features/branch/hooks/use-branches';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-10 w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-xs transition-all duration-150',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50',
);

interface BranchSelectProps {
  id?: string;
  value: string;
  onChange: (branchId: string) => void;
  disabled?: boolean;
}

export function BranchSelect({ id, value, onChange, disabled }: BranchSelectProps) {
  const branches = useBranches();
  return (
    <select id={id} className={selectClassName} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select a branch…</option>
      {(branches.data ?? []).map((branch) => (
        <option key={branch.id} value={branch.id}>
          {branch.name}
        </option>
      ))}
    </select>
  );
}
