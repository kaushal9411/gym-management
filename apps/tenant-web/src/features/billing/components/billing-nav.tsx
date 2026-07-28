'use client';

import { RouteTabNav } from '@/components/ui/route-tab-nav';

const TABS = [
  { href: '/billing', label: 'Overview' },
  { href: '/billing/invoices', label: 'Invoices' },
  { href: '/billing/history', label: 'Payment history' },
  { href: '/billing/address', label: 'Billing address' },
] as const;

export function BillingNav() {
  return <RouteTabNav tabs={[...TABS]} aria-label="Billing sections" />;
}
