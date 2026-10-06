'use client';

import * as React from 'react';
import { Bell, ScrollText, Settings2 } from 'lucide-react';

import { ReportsHero, type ReportsHeroStat } from '@/features/reports/components/ui';
import { COMM_ACCENT } from '../constants';

/** Hero shared by /notifications, /notifications/settings and /notifications/log: route tabs Inbox / Settings / Message log (Settings and Message log only offered to `notifications:manage`/`notifications:view` respectively). */
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
  showLogTab = true,
}: {
  active: 'inbox' | 'settings' | 'log';
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: string;
  stats?: ReportsHeroStat[];
  statsLoading?: boolean;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  showSettingsTab?: boolean;
  showLogTab?: boolean;
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
        ...(showLogTab ? [{ value: 'log', label: 'Message log', icon: ScrollText, href: '/notifications/log' }] : []),
        ...(showSettingsTab ? [{ value: 'settings', label: 'Settings', icon: Settings2, href: '/notifications/settings' }] : []),
      ]}
    />
  );
}
