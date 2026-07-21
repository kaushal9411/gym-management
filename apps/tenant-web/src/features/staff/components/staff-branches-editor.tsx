'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useBranches } from '@/features/branch/hooks/use-branches';

interface StaffBranchesEditorProps {
  branchIds: string[];
  primaryBranchId: string | null;
  onChange: (next: { branchIds: string[]; primaryBranchId: string | null }) => void;
  disabled?: boolean;
}

/**
 * Staff always belongs to at least one explicit branch (no "all branches"
 * shortcut like generic IAM users) and must have exactly one primary —
 * business rule from the Staff Management module.
 */
export function StaffBranchesEditor({ branchIds, primaryBranchId, onChange, disabled }: StaffBranchesEditorProps) {
  const branchList = useBranches();
  if (branchList.isPending) return <Skeleton className="h-20 w-full" />;
  const available = branchList.data ?? [];

  const toggle = (branchId: string, checked: boolean) => {
    const nextIds = checked ? [...branchIds, branchId] : branchIds.filter((id) => id !== branchId);
    const nextPrimary = !checked && primaryBranchId === branchId ? (nextIds[0] ?? null) : (primaryBranchId ?? nextIds[0] ?? null);
    onChange({ branchIds: nextIds, primaryBranchId: nextPrimary });
  };

  const setPrimary = (branchId: string) => {
    onChange({ branchIds, primaryBranchId: branchId });
  };

  return (
    <div className="space-y-2 rounded-lg border p-3">
      {available.length === 0 ? (
        <p className="text-sm text-muted-foreground">No branches found.</p>
      ) : (
        available.map((branch) => (
          <div key={branch.id} className="flex items-center gap-2">
            <Checkbox
              id={`staff-branch-${branch.id}`}
              checked={branchIds.includes(branch.id)}
              disabled={disabled}
              onCheckedChange={(checked) => toggle(branch.id, checked === true)}
            />
            <Label htmlFor={`staff-branch-${branch.id}`} className="cursor-pointer font-normal">
              {branch.name}
            </Label>
            {branchIds.includes(branch.id) ? (
              <button
                type="button"
                disabled={disabled}
                onClick={() => setPrimary(branch.id)}
                className={
                  primaryBranchId === branch.id
                    ? 'ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground'
                    : 'ml-auto rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent'
                }
              >
                {primaryBranchId === branch.id ? 'Primary' : 'Make primary'}
              </button>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
