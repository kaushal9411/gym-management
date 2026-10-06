'use client';

import { Panel } from '@/features/dashboard/components/ui';
import { NotificationChannelsEditor } from './controls/notification-channels-editor';

/** Notification Channels tab: per-channel enable + monthly quota ceiling for Email/SMS/WhatsApp, with live usage. */
export function NotificationChannelsTab({ tenantId, canManage }: { tenantId: string; canManage: boolean }) {
  return (
    <Panel title="Notification channels" hint="the ceiling above the tenant's own toggle — changes apply immediately" index={0}>
      <NotificationChannelsEditor tenantId={tenantId} canManage={canManage} />
      <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
        <li>A send only goes out when this ceiling AND the tenant&apos;s own channel toggle both allow it.</li>
        <li>IN_APP and PUSH aren&apos;t shown here — they&apos;re free/platform-configured and never gated.</li>
        <li>Quota resets automatically at the start of each calendar month (UTC).</li>
      </ul>
    </Panel>
  );
}
