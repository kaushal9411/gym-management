'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useFilteredNav } from '@/features/navigation/use-filtered-nav';
import { cn } from '@/lib/utils';

interface SidebarNavProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

/** Renders the role/permission/feature-flag-filtered nav list; shared between the desktop rail and the mobile drawer. */
export function SidebarNav({ collapsed, onNavigate }: SidebarNavProps) {
  const items = useFilteredNav();
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-3">
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              collapsed && 'justify-center px-2',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <Icon className="size-4.5 shrink-0" aria-hidden />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
