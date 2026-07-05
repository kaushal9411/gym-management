'use client';

import Link from 'next/link';
import { Bell, HelpCircle, KeyRound, LogOut, Settings, User as UserIcon } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentUser } from '@/features/auth/hooks/use-current-user';
import { useLogout } from '@/features/auth/hooks/use-logout';

function initialsOf(name: string | undefined): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Profile Menu: My Profile, Account Settings, Change Password, Notification Settings, Help Center, Logout. */
export function ProfileMenu() {
  const user = useCurrentUser();
  const { logout, isLoggingOut } = useLogout();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="size-8">
            <AvatarFallback>{initialsOf(user?.name)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">{user?.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="gap-2">
            <UserIcon className="size-4" /> My Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="gap-2">
            <Settings className="size-4" /> Account Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings?tab=password" className="gap-2">
            <KeyRound className="size-4" /> Change Password
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings?tab=notifications" className="gap-2">
            <Bell className="size-4" /> Notification Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/support" className="gap-2">
            <HelpCircle className="size-4" /> Help Center
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={isLoggingOut} onClick={() => logout()} className="gap-2 text-destructive focus:text-destructive">
          <LogOut className="size-4" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
