'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Gauge,
  Building2,
  CreditCard,
  Ticket,
  Receipt,
  TrendingUp,
  LifeBuoy,
  ToggleLeft,
  FileText,
  Bell,
  Settings,
  ScrollText,
  Users,
  LogOut,
  Clock,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { ADMIN_ROUTES } from '@/constants/routes';
import { RequireAuth } from '@/features/auth/guards/require-auth';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useLogout } from '@/features/auth/hooks/use-logout';
import { cn } from '@/lib/utils';

/** Per-item icon accent (idle state only — the active item keeps the familiar primary highlight), drawn from the CVD-validated `--chart-*`/semantic tokens. Roles/Audit Logs/Settings are deliberately left neutral (undefined tone), matching the "admin stays neutral" convention. */
const NAV_ITEMS = [
  { href: ADMIN_ROUTES.dashboard, label: 'Dashboard', icon: Gauge, tone: undefined },
  { href: ADMIN_ROUTES.tenants, label: 'Tenants', icon: Building2, tone: 'var(--chart-2)' },
  { href: ADMIN_ROUTES.plans, label: 'Plans', icon: CreditCard, tone: 'var(--chart-7)' },
  { href: ADMIN_ROUTES.coupons, label: 'Coupons', icon: Ticket, tone: 'var(--chart-5)' },
  { href: ADMIN_ROUTES.payments, label: 'Payments', icon: Receipt, tone: 'var(--success)' },
  { href: ADMIN_ROUTES.revenue, label: 'Revenue', icon: TrendingUp, tone: 'var(--chart-3)' },
  { href: ADMIN_ROUTES.support, label: 'Support', icon: LifeBuoy, tone: 'var(--chart-4)' },
  { href: ADMIN_ROUTES.featureFlags, label: 'Feature Flags', icon: ToggleLeft, tone: 'var(--chart-7)' },
  { href: ADMIN_ROUTES.cms, label: 'CMS', icon: FileText, tone: 'var(--chart-5)' },
  { href: ADMIN_ROUTES.notifications, label: 'Notifications', icon: Bell, tone: 'var(--chart-2)' },
  { href: ADMIN_ROUTES.scheduler, label: 'Scheduler', icon: Clock, tone: 'var(--chart-4)' },
  { href: ADMIN_ROUTES.roles, label: 'Roles & Admins', icon: Users, tone: undefined },
  { href: ADMIN_ROUTES.auditLogs, label: 'Audit Logs', icon: ScrollText, tone: undefined },
  { href: ADMIN_ROUTES.settings, label: 'Settings', icon: Settings, tone: undefined },
] as const;

function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { admin } = useAuth();
  const { logout, isLoggingOut } = useLogout();

  return (
    <div className="flex min-h-dvh bg-muted/30">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-background sm:flex">
        <div className="flex h-14 items-center border-b px-4 font-semibold">FitCloud Admin</div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-opacity duration-150',
                    active ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <Icon
                  className="size-4 shrink-0 transition-colors duration-150"
                  style={!active && item.tone ? { color: item.tone, opacity: 0.75 } : undefined}
                  aria-hidden
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-background px-4">
          <span className="text-sm text-muted-foreground sm:hidden">FitCloud Admin</span>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <span className="text-sm text-muted-foreground">
              {admin?.name} <span className="text-xs">({admin?.role})</span>
            </span>
            <Button variant="outline" size="sm" onClick={() => logout()} disabled={isLoggingOut}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <PortalShell>{children}</PortalShell>
    </RequireAuth>
  );
}
