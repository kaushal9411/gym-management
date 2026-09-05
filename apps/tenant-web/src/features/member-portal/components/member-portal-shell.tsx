'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarCheck, CalendarRange, Dumbbell, LayoutDashboard, LogOut, Menu, Receipt, Ruler, Salad, UserRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { DownloadAppButton } from '@/features/app-download/download-app-button';
import { TenantLogo } from '@/features/tenant/components/tenant-logo';
import { useTenant } from '@/features/tenant/tenant-provider';
import { cn } from '@/lib/utils';
import { useMemberAuth, useMemberLogout } from '../hooks/use-member-auth';
import { MEMBER_PORTAL_ROUTES } from '../constants';

const TABS = [
  { href: MEMBER_PORTAL_ROUTES.dashboard, label: 'Dashboard', icon: LayoutDashboard },
  { href: MEMBER_PORTAL_ROUTES.attendance, label: 'Attendance', icon: CalendarCheck },
  { href: MEMBER_PORTAL_ROUTES.workout, label: 'Workout', icon: Dumbbell },
  { href: MEMBER_PORTAL_ROUTES.diet, label: 'Diet', icon: Salad },
  { href: MEMBER_PORTAL_ROUTES.measurements, label: 'Measurements', icon: Ruler },
  { href: MEMBER_PORTAL_ROUTES.classes, label: 'Classes', icon: CalendarRange },
  { href: MEMBER_PORTAL_ROUTES.invoices, label: 'Invoices', icon: Receipt },
  { href: MEMBER_PORTAL_ROUTES.profile, label: 'Profile', icon: UserRound },
] as const;

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 py-4">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            onClick={onNavigate}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
              isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-all duration-150',
                isActive ? 'opacity-100' : 'opacity-0',
              )}
            />
            <tab.icon className="size-4.5 shrink-0" aria-hidden />
            <span className="truncate">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Sidebar shell (desktop rail + mobile slide-over), same visual language as
 * the staff `Sidebar`/`SidebarNav` (active-item accent bar, icon+label
 * rows) — deliberately not wired to the `navigation` Redux slice those use
 * (no collapse state, no permission/feature-flag filtering: the member auth
 * plane has no RBAC and only ever has these 8 fixed tabs), so this stays a
 * small self-contained component with local `useState` for the mobile
 * drawer instead.
 */
export function MemberPortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tenant = useTenant();
  const { member } = useMemberAuth();
  const logout = useMemberLogout();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-background md:flex">
        <div className="flex h-16 items-center gap-2.5 border-b px-4">
          <TenantLogo size="sm" />
          <span className="truncate text-sm font-semibold tracking-tight">{tenant.name}</span>
        </div>
        <NavList pathname={pathname} />
        <div className="flex items-center gap-2 border-t p-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{member?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{member?.memberId}</p>
          </div>
          <DownloadAppButton className="size-8 shrink-0" />
          <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Log out" onClick={() => logout.mutate()} disabled={logout.isPending}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </aside>

      <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
        <DrawerContent side="left" className="w-64 p-0">
          <div className="flex h-16 items-center gap-2.5 border-b px-4">
            <TenantLogo size="sm" />
            <span className="truncate text-sm font-semibold tracking-tight">{tenant.name}</span>
          </div>
          <NavList pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          <div className="flex items-center gap-2 border-t p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{member?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{member?.memberId}</p>
            </div>
            <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Log out" onClick={() => logout.mutate()} disabled={logout.isPending}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 md:hidden">
          <Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
            <Menu className="size-5" />
          </Button>
          <div className="text-center">
            <p className="text-sm font-semibold">{member?.name}</p>
            <p className="text-xs text-muted-foreground">{member?.memberId}</p>
          </div>
          <DownloadAppButton />
        </header>
        <main className="flex-1 bg-muted/20 px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
