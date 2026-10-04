'use client';

import { Fragment } from 'react';
import { ChevronRight, LogOut, Menu, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { useHasPermission } from '@/features/auth/hooks/use-auth';
import { useLogout } from '@/features/auth/hooks/use-logout';
import type { DashboardOverview } from '@/features/dashboard/types';
import { EnvBadge } from './env-badge';
import { NAV_LABELS } from './nav-config';

function useCrumbs(pathname: string): Array<{ label: string; href: string }> {
  const parts = pathname.split('/').filter(Boolean);
  return parts.map((p, i) => {
    const href = `/${parts.slice(0, i + 1).join('/')}`;
    const label = i === 0 ? (NAV_LABELS[p] ?? p) : p.length > 20 || /^[0-9a-f-]{8,}$/i.test(p) ? 'Details' : p.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
    return { label, href };
  });
}

export function Topbar({ health, onMenu, onSearch }: { health: DashboardOverview['health'] | undefined; onMenu: () => void; onSearch: () => void }) {
  const pathname = usePathname();
  const crumbs = useCrumbs(pathname);
  const canSearch = useHasPermission('tenants:read');
  const { logout, isLoggingOut } = useLogout();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card px-3 sm:px-6">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenu} aria-label="Open navigation menu">
        <Menu className="size-5" aria-hidden />
      </Button>
      <nav aria-label="Breadcrumb" className="hidden min-w-0 text-[13px] text-muted-foreground sm:block">
        <ol className="flex items-center gap-1.5">
          <li><Link href="/dashboard" className="hover:text-foreground">Admin</Link></li>
          {crumbs.map((c, i) => (
            <Fragment key={c.href}>
              <li aria-hidden><ChevronRight className="size-3.5" /></li>
              <li className="truncate">{i === crumbs.length - 1 ? <b aria-current="page" className="font-semibold text-foreground">{c.label}</b> : <Link href={c.href} className="hover:text-foreground">{c.label}</Link>}</li>
            </Fragment>
          ))}
        </ol>
      </nav>
      {canSearch ? (
        <button
          type="button"
          onClick={onSearch}
          aria-label="Search tenants (Ctrl K)"
          className="ml-auto flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-[10px] border bg-muted/60 px-3 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:max-w-md sm:flex-none sm:basis-[22rem] md:ml-4 lg:flex-1 lg:max-w-[460px]"
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="truncate">Search tenants…</span>
          <kbd className="ml-auto hidden whitespace-nowrap rounded-md border bg-card px-1.5 py-px font-mono text-[11px] lg:inline">Ctrl K</kbd>
        </button>
      ) : null}
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <EnvBadge health={health} />
        <ThemeToggle />
        <Button variant="outline" size="sm" onClick={() => logout()} disabled={isLoggingOut} aria-label="Sign out">
          <LogOut className="size-4" aria-hidden />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
