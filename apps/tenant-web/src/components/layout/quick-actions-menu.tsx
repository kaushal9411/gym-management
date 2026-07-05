'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFilteredNav } from '@/features/navigation/use-filtered-nav';

const QUICK_ACTION_KEYS = ['members', 'attendance', 'payments', 'expenses'];

/** Shortcuts into the modules the current user can already see in the sidebar — no module-specific "create" logic yet. */
export function QuickActionsMenu() {
  const items = useFilteredNav().filter((item) => QUICK_ACTION_KEYS.includes(item.key));
  if (items.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" />
          Quick Add
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => (
          <DropdownMenuItem key={item.key} asChild>
            <Link href={item.href} className="gap-2">
              <item.icon className="size-4" />
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
