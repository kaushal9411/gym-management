'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarCheck, CalendarRange, Dumbbell, LayoutDashboard, LogOut, Receipt, Salad } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMemberAuth, useMemberLogout } from '../hooks/use-member-auth';
import { MEMBER_PORTAL_ROUTES } from '../constants';

const TABS = [
  { href: MEMBER_PORTAL_ROUTES.dashboard, label: 'Dashboard', icon: LayoutDashboard },
  { href: MEMBER_PORTAL_ROUTES.attendance, label: 'Attendance', icon: CalendarCheck },
  { href: MEMBER_PORTAL_ROUTES.workout, label: 'Workout', icon: Dumbbell },
  { href: MEMBER_PORTAL_ROUTES.diet, label: 'Diet', icon: Salad },
  { href: MEMBER_PORTAL_ROUTES.classes, label: 'Classes', icon: CalendarRange },
  { href: MEMBER_PORTAL_ROUTES.invoices, label: 'Invoices', icon: Receipt },
];

/**
 * Deliberately simple — not a reuse of the staff `AppShell`/`nav-config.ts`
 * (confirmed staff-only scope during research). A member only ever needs a
 * handful of tabs, no permission/feature-flag gating (the member auth plane
 * has no RBAC), no branch switcher, no notification bell.
 */
export function MemberPortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { member } = useMemberAuth();
  const logout = useMemberLogout();

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold">{member?.name}</p>
            <p className="text-xs text-muted-foreground">{member?.memberId}</p>
          </div>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => logout.mutate()} disabled={logout.isPending}>
            <LogOut className="size-4" /> Log out
          </Button>
        </div>
        <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4 pb-2">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <tab.icon className="size-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
