'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Bot, Building2, Palette, Receipt, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { ReportsHero, type ReportsHeroStat } from '@/features/reports/components/ui';
import { useSetupProgress } from './setup-progress';

const TABS: { value: string; label: string; href: string; icon: LucideIcon }[] = [
  { value: 'profile', label: 'Profile', href: '/gym-settings/profile', icon: Building2 },
  { value: 'business', label: 'Business', href: '/gym-settings/business', icon: SlidersHorizontal },
  { value: 'branding', label: 'Branding', href: '/gym-settings/branding', icon: Palette },
  { value: 'invoice', label: 'Invoice', href: '/gym-settings/invoice', icon: Receipt },
  { value: 'security', label: 'Security', href: '/gym-settings/security', icon: ShieldCheck },
  { value: 'ai', label: 'AI', href: '/gym-settings/ai', icon: Bot },
];

/**
 * Hero + route tab bar shared by the six Gym Settings pages (replaces GymSettingsNav).
 * Tab bar and the "Setup complete" stat need `settings:read` (same rule the old nav had).
 */
export function SettingsHero({
  title,
  subtitle,
  icon,
  stats,
  actions,
}: {
  title: string;
  subtitle: React.ReactNode;
  icon: LucideIcon;
  /** Extra page-specific stats (real values only), shown after the setup percentage. */
  stats?: ReportsHeroStat[];
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const { hasPermission } = usePermissions();
  const canRead = hasPermission('settings:read');
  const progress = useSetupProgress();
  const active = TABS.find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))?.value;

  const setupStat: ReportsHeroStat | null = canRead
    ? { label: 'Setup complete', value: progress.loading ? <Skeleton className="h-7 w-16 bg-white/25" /> : progress.percent === null ? '-' : progress.percent, format: 'percent' }
    : null;
  const allStats = [...(setupStat ? [setupStat] : []), ...(stats ?? [])];

  return (
    <ReportsHero
      eyebrow="Administration"
      title={title}
      subtitle={subtitle}
      accent="operations"
      icon={icon}
      stats={allStats.length ? allStats : undefined}
      actions={actions}
      tabs={canRead ? TABS : undefined}
      activeTab={active}
    />
  );
}
