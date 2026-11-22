'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useFilteredNav } from '@/features/navigation/use-filtered-nav';
import { cn } from '@/lib/utils';

interface SidebarNavProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

/** Per-section icon accent (idle state only — the active item keeps the familiar primary highlight) drawn from the same validated `--chart-*`/semantic tokens used elsewhere, so the menu reads as colorful without competing with the active-item indicator. */
const SECTION_TONE: Record<string, string> = {
  Overview: 'var(--primary)',
  People: 'var(--chart-2)',
  Programs: 'var(--chart-3)',
  Finance: 'var(--success)',
  Insights: 'var(--chart-7)',
  Communication: 'var(--chart-5)',
};

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
      {groups.map((group, i) => {
        const tone = group.section ? SECTION_TONE[group.section] : undefined;
        return (
          <div key={group.section ?? i} className="flex flex-col gap-0.5">
            {group.section && !collapsed ? (
              <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.section}
              </p>
            ) : null}
            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              const open = !collapsed && isActive && !!item.children?.length;
              return (
                <React.Fragment key={item.key}>
                <Link
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
                  <Icon
                    className="size-4.5 shrink-0 transition-colors duration-150"
                    style={!isActive && tone ? { color: tone, opacity: 0.75 } : undefined}
                    aria-hidden
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
                {open ? (
                  <ul className="ml-5 mb-1 mt-0.5 flex flex-col gap-0.5 border-l pl-2" aria-label={`${item.label} sections`}>
                    {item.children!.map((child) => {
                      const childActive = child.href === item.href ? pathname === child.href : pathname === child.href || pathname.startsWith(`${child.href}/`);
                      const ChildIcon = child.icon;
                      return (
                        <li key={child.key}>
                          <Link
                            href={child.href}
                            onClick={onNavigate}
                            aria-current={childActive ? 'page' : undefined}
                            className={cn(
                              'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                              childActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                            )}
                          >
                            <ChildIcon className="size-3.5 shrink-0" aria-hidden />
                            <span className="truncate">{child.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                </React.Fragment>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
