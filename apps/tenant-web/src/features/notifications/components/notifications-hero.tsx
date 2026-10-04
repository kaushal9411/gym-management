'use client';

import * as React from 'react';
import { Bell, Settings2 } from 'lucide-react';

import { ReportsHero, type ReportsHeroStat } from '@/features/reports/components/ui';
import { COMM_ACCENT } from '../constants';

/** Hero shared by /notifications and /notifications/settings: route tabs Inbox / Settings (Settings only offered to `notifications:manage`). */
export function NotificationsHero({
  active,
  title,
  subtitle,
  eyebrow = 'Communication',
  stats,
  statsLoading,
  actions,
  backHref,
  backLabel,
  showSettingsTab = true,
}: {
  active: 'inbox' | 'settings';
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: string;
  stats?: ReportsHeroStat[];
  statsLoading?: boolean;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  showSettingsTab?: boolean;
}) {
  return (
    <ReportsHero
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      accent={COMM_ACCENT}
      icon={Bell}
      backHref={backHref}
      backLabel={backLabel}
      stats={stats}
      statsLoading={statsLoading}
      actions={actions}
      activeTab={active}
      tabs={[
        { value: 'inbox', label: 'Inbox', icon: Bell, href: '/notifications' },
        ...(showSettingsTab ? [{ value: 'settings', label: 'Settings', icon: Settings2, href: '/notifications/settings' }] : []),
      ]}
    />
  );
}
