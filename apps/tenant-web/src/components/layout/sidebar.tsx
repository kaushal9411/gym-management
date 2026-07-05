'use client';

import { ChevronsLeft, ChevronsRight } from 'lucide-react';

import { TenantLogo } from '@/features/tenant/components/tenant-logo';
import { useTenant } from '@/features/tenant/tenant-provider';
import { sidebarToggled, mobileSidebarClosed } from '@/features/navigation/store/navigation-slice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { cn } from '@/lib/utils';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { SidebarNav } from './sidebar-nav';

/** Desktop collapsible rail + mobile slide-over, both driven by the `navigation` Redux slice. */
export function Sidebar() {
  const tenant = useTenant();
  const dispatch = useAppDispatch();
  const collapsed = useAppSelector((state) => state.navigation.sidebarCollapsed);
  const mobileOpen = useAppSelector((state) => state.navigation.mobileSidebarOpen);

  return (
    <>
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-background transition-[width] duration-200 md:flex',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <div className={cn('flex h-14 items-center gap-2 border-b px-3', collapsed && 'justify-center px-0')}>
          <TenantLogo size="sm" />
          {!collapsed && <span className="truncate text-sm font-semibold">{tenant.name}</span>}
        </div>

        <SidebarNav collapsed={collapsed} />

        <button
          type="button"
          onClick={() => dispatch(sidebarToggled())}
          className="flex items-center justify-center gap-2 border-t py-3 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          {!collapsed && 'Collapse'}
        </button>
      </aside>

      <Drawer open={mobileOpen} onOpenChange={(open) => !open && dispatch(mobileSidebarClosed())}>
        <DrawerContent side="left" className="w-64 p-0">
          <div className="flex h-14 items-center gap-2 border-b px-3">
            <TenantLogo size="sm" />
            <span className="truncate text-sm font-semibold">{tenant.name}</span>
          </div>
          <SidebarNav collapsed={false} onNavigate={() => dispatch(mobileSidebarClosed())} />
        </DrawerContent>
      </Drawer>
    </>
  );
}
