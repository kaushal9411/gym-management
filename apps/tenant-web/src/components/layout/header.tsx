'use client';

import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { BranchSelector } from './branch-selector';
import { GlobalSearch } from './global-search';
import { NotificationPanel } from './notification-panel';
import { PortalBreadcrumbs } from './portal-breadcrumbs';
import { ProfileMenu } from './profile-menu';
import { QuickActionsMenu } from './quick-actions-menu';
import { ThemeToggle } from './theme-toggle';
import { mobileSidebarOpened } from '@/features/navigation/store/navigation-slice';
import { useAppDispatch } from '@/store/hooks';

/** Top header: mobile menu toggle, breadcrumb, global search, quick actions, theme, branch, notifications, profile. */
export function Header() {
  const dispatch = useAppDispatch();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open menu"
        onClick={() => dispatch(mobileSidebarOpened())}
      >
        <Menu className="size-5" />
      </Button>

      <PortalBreadcrumbs />

      <div className="ml-auto flex items-center gap-2">
        <GlobalSearch />
        <QuickActionsMenu />
        <BranchSelector />
        <ThemeToggle />
        <NotificationPanel />
        <ProfileMenu />
      </div>
    </header>
  );
}
