'use client';

import { Building2, Check, ChevronsUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { useAppDispatch } from '@/store/hooks';
import { branchSelected } from '@/features/branch/store/branch-slice';

/** Only rendered for tenants with more than one active branch — single-branch gyms don't need the picker. */
export function BranchSelector() {
  const dispatch = useAppDispatch();
  const { branches, currentBranch, currentBranchId } = useCurrentBranch();

  if (branches.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Building2 className="size-4" />
          <span className="max-w-32 truncate">{currentBranch?.name ?? 'Select branch'}</span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Branches</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {branches.map((branch) => (
          <DropdownMenuItem key={branch.id} onClick={() => dispatch(branchSelected(branch.id))} className="gap-2">
            <Check className={branch.id === currentBranchId ? 'size-4 opacity-100' : 'size-4 opacity-0'} />
            <span className="truncate">{branch.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
