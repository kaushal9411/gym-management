'use client';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { RouteTabNav } from '@/components/ui/route-tab-nav';

const TABS = [
  { href: '/gym-settings/profile', label: 'Gym Profile' },
  { href: '/gym-settings/business', label: 'Business Settings' },
  { href: '/gym-settings/branding', label: 'Branding' },
  { href: '/gym-settings/invoice', label: 'Invoice Settings' },
  { href: '/gym-settings/ai', label: 'AI Assistant' },
] as const;

/** Shared secondary nav across the Gym Settings pages (mirrors IamNav / BillingNav). */
export function GymSettingsNav() {
  const { hasPermission } = usePermissions();

  if (!hasPermission('settings:read')) return null;

  return <RouteTabNav tabs={[...TABS]} aria-label="Gym settings sections" />;
}
