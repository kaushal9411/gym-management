'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useFilteredNav } from '@/features/navigation/use-filtered-nav';
import { cn } from '@/lib/utils';

interface SidebarNavProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

/** Renders the role/permission/feature-flag-filtered nav list, grouped under presentational section headers; shared between the desktop rail and the mobile drawer. */
export function SidebarNav({ collapsed, onNavigate }: SidebarNavProps) {
  const items = useFilteredNav();
  const pathname = usePathname();

  const groups: { section: string | undefined; items: typeof items }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.section === item.section) {
      last.items.push(item);
    } else {
      groups.push({ section: item.section, items: [item] });
    }
  }

  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2.5 py-4">
      {groups.map((group, i) => (
        <div key={group.section ?? i} className="flex flex-col gap-0.5">
          {group.section && !collapsed ? (
            <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.section}
            </p>
          ) : null}
          {group.items.map((item) => {
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
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                  collapsed && 'justify-center px-2',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary transition-all duration-150',
                    isActive ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <Icon className="size-4.5 shrink-0" aria-hidden />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
