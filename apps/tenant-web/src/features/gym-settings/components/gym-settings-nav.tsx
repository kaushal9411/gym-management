'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/gym-settings/profile', label: 'Gym Profile' },
  { href: '/gym-settings/business', label: 'Business Settings' },
  { href: '/gym-settings/branding', label: 'Branding' },
  { href: '/gym-settings/invoice', label: 'Invoice Settings' },
] as const;

/** Shared secondary nav across the Gym Settings pages (mirrors IamNav / BillingNav). */
export function GymSettingsNav() {
  const pathname = usePathname();
  const { hasPermission } = usePermissions();

  if (!hasPermission('settings:read')) return null;

  return (
    <nav className="flex gap-1 border-b border-border" aria-label="Gym settings sections">
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
