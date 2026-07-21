'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useBranches } from '@/features/branch/hooks/use-branches';

export interface BranchAssignment {
  branchId: string;
  isPrimary?: boolean;
  expiresAt?: string;
}

interface BranchAccessEditorProps {
  allBranches: boolean;
  branches: BranchAssignment[];
  onChange: (next: { allBranches: boolean; branches: BranchAssignment[] }) => void;
  disabled?: boolean;
}

/** All-branches toggle + per-branch selection with a primary marker. */
export function BranchAccessEditor({ allBranches, branches, onChange, disabled }: BranchAccessEditorProps) {
  const branchList = useBranches();
  if (branchList.isPending) return <Skeleton className="h-20 w-full" />;
  const available = branchList.data ?? [];

  const toggleBranch = (branchId: string, checked: boolean) => {
    const next = checked ? [...branches, { branchId }] : branches.filter((b) => b.branchId !== branchId);
    onChange({ allBranches, branches: next });
  };

  const setPrimary = (branchId: string) => {
    onChange({ allBranches, branches: branches.map((b) => ({ ...b, isPrimary: b.branchId === branchId })) });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Checkbox
          id="all-branches"
          checked={allBranches}
          disabled={disabled}
          onCheckedChange={(checked) => onChange({ allBranches: checked === true, branches })}
        />
        <Label htmlFor="all-branches" className="cursor-pointer font-normal">
          Access to all branches (including future ones)
        </Label>
      </div>

      {!allBranches && (
        <div className="space-y-2 rounded-lg border p-3">
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">No branches found.</p>
          ) : (
            available.map((branch) => {
              const assignment = branches.find((b) => b.branchId === branch.id);
              return (
                <div key={branch.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`branch-${branch.id}`}
                    checked={!!assignment}
                    disabled={disabled}
                    onCheckedChange={(checked) => toggleBranch(branch.id, checked === true)}
                  />
                  <Label htmlFor={`branch-${branch.id}`} className="cursor-pointer font-normal">
                    {branch.name}
                  </Label>
                  {assignment ? (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => setPrimary(branch.id)}
                      className={
                        assignment.isPrimary
                          ? 'ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground'
                          : 'ml-auto rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent'
                      }
                    >
                      {assignment.isPrimary ? 'Primary' : 'Make primary'}
                    </button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
