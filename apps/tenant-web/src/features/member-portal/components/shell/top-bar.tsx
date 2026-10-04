'use client';

import Link from 'next/link';
import { Bell, LogOut, UserRound } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { DownloadAppButton } from '@/features/app-download/download-app-button';
import { TenantLogo } from '@/features/tenant/components/tenant-logo';
import { useTenant } from '@/features/tenant/tenant-provider';
import { MEMBER_PORTAL_ROUTES } from '../../constants';
import { initials } from '../../lib/format';
import { NavBadge } from './nav-badge';

/** Slim sticky phone top bar (<md): tenant logo + name, bell with real unread badge, avatar menu (profile / logout). */
export function TopBar({ name, memberId, photoUrl, unread, onLogout, loggingOut }: { name?: string; memberId?: string; photoUrl?: string | null; unread: number; onLogout: () => void; loggingOut: boolean }) {
  const tenant = useTenant();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl md:hidden">
      <Link href={MEMBER_PORTAL_ROUTES.dashboard} className="flex min-w-0 items-center gap-2.5">
        <TenantLogo size="sm" />
        <span className="truncate text-sm font-semibold tracking-tight">{tenant.name}</span>
      </Link>
      <div className="flex items-center gap-0.5">
        <DownloadAppButton className="size-11" />
        <Link href={MEMBER_PORTAL_ROUTES.notifications} aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'} className="relative grid size-11 place-items-center rounded-full text-muted-foreground transition active:bg-accent">
          <Bell className="size-5" />
          <NavBadge count={unread} className="absolute right-1 top-1" />
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Account menu" className="grid size-11 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="size-8">
              <AvatarImage src={photoUrl ?? undefined} alt={name ?? ''} />
              <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">{initials(name)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-xs font-normal text-muted-foreground">{memberId}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="min-h-11">
              <Link href={MEMBER_PORTAL_ROUTES.profile}>
                <UserRound className="size-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-11 text-destructive focus:text-destructive" disabled={loggingOut} onSelect={onLogout}>
              <LogOut className="size-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
