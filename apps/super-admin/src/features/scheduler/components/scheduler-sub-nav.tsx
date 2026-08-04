'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ADMIN_ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils';

const TABS = [
  { href: ADMIN_ROUTES.scheduler, label: 'Dashboard', exact: true },
  { href: `${ADMIN_ROUTES.scheduler}/jobs`, label: 'Jobs', exact: false },
  { href: `${ADMIN_ROUTES.scheduler}/queues`, label: 'Queue Monitor', exact: true },
  { href: `${ADMIN_ROUTES.scheduler}/failed`, label: 'Failed Jobs', exact: true },
  { href: `${ADMIN_ROUTES.scheduler}/history`, label: 'Job History', exact: true },
] as const;

export function SchedulerSubNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 border-b">
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
