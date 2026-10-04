'use client';

import * as React from 'react';
import { BellOff, CheckCheck } from 'lucide-react';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { HeroButton } from '@/features/finance/components/payments/payments-hero';
import { NotificationInbox } from '@/features/notifications/components/notification-inbox';
import { NotificationInsights } from '@/features/notifications/components/notification-insights';
import { NotificationKpis } from '@/features/notifications/components/notification-kpis';
import { NotificationPeriodBar } from '@/features/notifications/components/notification-period-bar';
import { NotificationsHero } from '@/features/notifications/components/notifications-hero';
import { useNotificationControls } from '@/features/notifications/hooks/use-notification-controls';
import { useMarkAllNotificationsRead, useNotificationStats } from '@/features/notifications/hooks/use-notifications';
import { EmptyState } from '@/features/reports/components/ui';

export default function NotificationsPage() {
  const { hasPermission } = usePermissions();
  const canView = hasPermission('notifications:view');
  const canManage = hasPermission('notifications:manage');
  const controls = useNotificationControls('month');
  const stats = useNotificationStats(controls.params, canView && controls.rangeReady);
  const markAllRead = useMarkAllNotificationsRead();

  if (!canView) {
    return <EmptyState icon={BellOff} title="No access to notifications" description="You don't have permission to view notifications." className="mt-10" />;
  }

  const s = stats.data;
  const unread = s?.kpis.unread.value;
  const sparkline = s?.daily.map((d) => d.total);
  // Hero stat "Unread" falls back to nothing (loading skeleton) until stats land; the inbox tabs show the live unread count independently.
  return (
    <div className="space-y-5">
      <NotificationsHero
        active="inbox"
        title="Notifications"
        subtitle="Everything sent to your gym, in one place. Read status is shared by your whole team."
        statsLoading={stats.isPending && stats.fetchStatus !== 'idle'}
        stats={
          stats.isError
            ? undefined
            : [
                { label: 'Unread', value: unread ?? 0 },
                { label: 'Received this period', value: s?.kpis.total.value ?? 0 },
                { label: 'Read rate', value: (s?.kpis.readRate.value ?? 0) * 100, format: 'percent' },
              ]
        }
        showSettingsTab={canManage}
        actions={
          <HeroButton onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending || unread === 0}>
            <CheckCheck className="size-4" /> Mark all read
          </HeroButton>
        }
      />

      <NotificationPeriodBar
        period={controls.period}
        onPeriod={controls.changePeriod}
        customFrom={controls.custom.from}
        customTo={controls.custom.to}
        onCustom={controls.setDates}
        compare={controls.compare}
        onCompare={controls.setCompare}
      />

      {/* Stats failure is shown once, quietly, in the chart cards; zeroed KPI tiles would be misleading. */}
      {stats.isError ? null : <NotificationKpis stats={s} loading={stats.isPending && stats.fetchStatus !== 'idle'} compare={controls.compare} sparkline={sparkline} />}

      <NotificationInsights stats={s} loading={stats.isPending && stats.fetchStatus !== 'idle'} error={stats.isError} compare={controls.compare} previousLabel={controls.previousLabel} />

      <NotificationInbox stats={s} canDelete={canManage} />
    </div>
  );
}
