'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Bell, ChevronDown, HelpCircle, KeyRound, LogOut, Settings, User as UserIcon, type LucideIcon } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentUser } from '@/features/auth/hooks/use-current-user';
import { useLogout } from '@/features/auth/hooks/use-logout';
import { accentChipStyle, accentHeroGradient, type ReportAccent } from '@/features/reports/lib/reports-theme';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { useTenant } from '@/features/tenant/tenant-provider';

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

interface MenuLink {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  accent: ReportAccent;
}

// Personal links — deliberately NOT permission-gated (trainers/receptionists use them too).
// Notification preferences persist on the profile page (the Settings tab is a read-only preview).
const LINKS: MenuLink[] = [
  { href: '/profile', label: 'My Profile', hint: 'Your details', icon: UserIcon, accent: 'members' },
  { href: '/settings', label: 'Account Settings', hint: 'Security & sessions', icon: Settings, accent: 'operations' },
  { href: '/settings?tab=password', label: 'Change Password', hint: 'Update your password', icon: KeyRound, accent: 'staff' },
  { href: '/profile#notifications', label: 'Notification Settings', hint: 'Alerts & preferences', icon: Bell, accent: 'attendance' },
  { href: '/support', label: 'Help Center', hint: 'Guides & tickets', icon: HelpCircle, accent: 'finance' },
];

/** Profile Menu: gradient identity header, icon-chip links, separated Logout. */
export function ProfileMenu() {
  const user = useCurrentUser();
  const tenant = useTenant();
  const { logout, isLoggingOut } = useLogout();
  const m = useMotionSafe();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open profile menu"
          className="group flex items-center gap-1 rounded-full p-0.5 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent"
        >
          <Avatar className="size-8 ring-2 ring-primary/30 transition-shadow group-hover:ring-primary/60">
            <AvatarFallback className="bg-gradient-to-br from-primary/25 to-primary/5 text-xs font-bold text-primary">{initialsOf(user?.name)}</AvatarFallback>
          </Avatar>
          <ChevronDown className="mr-1 hidden size-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 sm:block" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={8} className="w-72 max-w-[calc(100vw-1rem)] p-0">
        <div className="relative overflow-hidden px-4 py-4 text-white" style={{ backgroundImage: accentHeroGradient('members') }}>
          <div className="flex items-center gap-3">
            <Avatar className="size-12 shrink-0 ring-2 ring-white/60">
              <AvatarFallback className="bg-white/20 text-base font-extrabold text-white">{initialsOf(user?.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold" title={user?.name}>{user?.name}</p>
              <p className="truncate text-xs text-white/80" title={user?.email}>{user?.email}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {(user?.roles ?? []).map((r) => (
              <span key={r} className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold backdrop-blur-sm">{r}</span>
            ))}
            <span className="max-w-full truncate rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-semibold" title={tenant.name}>{tenant.name}</span>
          </div>
        </div>
        <motion.div className="p-1.5" variants={m.staggerContainer(0.035, 0.02)} initial={m.initial} animate="show">
          {LINKS.map((l) => (
            <motion.div key={l.href} variants={m.listItem}>
              <DropdownMenuItem asChild className="gap-3 rounded-lg px-2 py-1.5">
                <Link href={l.href}>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={accentChipStyle(l.accent)}>
                    <l.icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold leading-tight">{l.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{l.hint}</span>
                  </span>
                </Link>
              </DropdownMenuItem>
            </motion.div>
          ))}
          <DropdownMenuSeparator />
          <motion.div variants={m.listItem}>
            <DropdownMenuItem
              disabled={isLoggingOut}
              onClick={() => logout()}
              className="gap-3 rounded-lg px-2 py-1.5 text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                <LogOut className="size-4" aria-hidden />
              </span>
              <span className="text-sm font-semibold">{isLoggingOut ? 'Signing out…' : 'Logout'}</span>
            </DropdownMenuItem>
          </motion.div>
        </motion.div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
