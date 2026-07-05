'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const TABS = [
  { href: '/billing', label: 'Overview' },
  { href: '/billing/invoices', label: 'Invoices' },
  { href: '/billing/history', label: 'Payment history' },
  { href: '/billing/address', label: 'Billing address' },
] as const;

export function BillingNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-border" aria-label="Billing sections">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
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
    </nav>
  );
}
