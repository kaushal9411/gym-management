'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { useBranches } from '@/features/branch/hooks/use-branches';
import { cn } from '@/lib/utils';
import type { BranchAssignment } from './branch-access-editor';

interface BranchAccessCardsProps {
  allBranches: boolean;
  branches: BranchAssignment[];
  onChange: (next: { allBranches: boolean; branches: BranchAssignment[] }) => void;
  disabled?: boolean;
}

/** Same value shape and behavior as `BranchAccessEditor` (all-branches switch, per-branch selection, primary marker), as segmented toggle + branch tiles. The edit page keeps using `BranchAccessEditor`. */
export function BranchAccessCards({ allBranches, branches, onChange, disabled }: BranchAccessCardsProps) {
  const branchList = useBranches();
  const available = branchList.data ?? [];

  const toggleBranch = (branchId: string, checked: boolean) =>
    onChange({ allBranches, branches: checked ? [...branches, { branchId }] : branches.filter((b) => b.branchId !== branchId) });
  const setPrimary = (branchId: string) => onChange({ allBranches, branches: branches.map((b) => ({ ...b, isPrimary: b.branchId === branchId })) });

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-xl border bg-muted/50 p-0.5" role="group" aria-label="Branch access">
        {([[true, 'All branches'], [false, 'Selected branches']] as const).map(([value, label]) => (
          <button
            key={label}
            type="button"
            disabled={disabled}
            aria-pressed={allBranches === value}
            onClick={() => onChange({ allBranches: value, branches })}
            className={cn('rounded-[10px] px-4 py-1.5 text-sm font-bold transition-all', allBranches === value ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          >
            {label}
          </button>
        ))}
      </div>

      {allBranches ? (
        <p className="text-[13px] text-muted-foreground">Access to every branch, including ones you add later.</p>
      ) : branchList.isPending ? (
        <Skeleton className="h-20 w-full rounded-2xl" />
      ) : available.length === 0 ? (
        <p className="text-sm text-muted-foreground">No branches found.</p>
      ) : (
        <div className="grid gap-2">
          {available.map((branch, i) => {
            const assignment = branches.find((b) => b.branchId === branch.id);
            const on = !!assignment;
            return (
              <motion.div key={branch.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }} className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={on}
                  onClick={() => toggleBranch(branch.id, !on)}
                  className="flex flex-1 items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left transition-all hover:translate-x-0.5 disabled:opacity-50"
                  style={{ borderColor: on ? 'var(--warning)' : 'var(--border)', backgroundColor: on ? 'color-mix(in oklch, var(--warning) 9%, transparent)' : undefined }}
                >
                  <span className="grid size-[22px] place-items-center rounded-[7px] border-2 text-white transition-colors" style={on ? { backgroundColor: 'var(--warning)', borderColor: 'var(--warning)' } : undefined}>
                    {on ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  <b className="text-sm font-semibold">{branch.name}</b>
                </button>
                {on ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setPrimary(branch.id)}
                    className={cn('shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition-colors', assignment?.isPrimary ? 'border-transparent text-white' : 'text-muted-foreground hover:bg-accent')}
                    style={assignment?.isPrimary ? { backgroundColor: 'var(--warning)' } : undefined}
                  >
                    {assignment?.isPrimary ? 'Primary' : 'Make primary'}
                  </button>
                ) : null}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
