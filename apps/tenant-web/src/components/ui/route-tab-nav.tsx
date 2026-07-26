'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

export interface RouteTab {
  href: string;
  label: string;
}

interface RouteTabNavProps {
  tabs: RouteTab[];
  className?: string;
  'aria-label': string;
}

/**
 * Shared underline nav for URL-driven route tabs (IAM's Users/Roles/Permissions/
 * Invitations, Gym Settings' Profile/Business/Branding/Invoice, Billing's tabs).
 * Deliberately Link-based, not a Radix Tabs panel-switcher — each "tab" here is
 * its own route/page, so real navigation (and a real active URL) is correct.
 */
export function RouteTabNav({ tabs, className, ...props }: RouteTabNavProps) {
  const pathname = usePathname();

  return (
    <nav className={cn('flex gap-1 overflow-x-auto border-b border-border', className)} {...props}>
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150',
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
