'use client';

import * as React from 'react';
import { BellOff } from 'lucide-react';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { MessageLogDetailDialog } from '@/features/notifications/components/message-log-detail-dialog';
import { MessageLogTable } from '@/features/notifications/components/message-log-table';
import { NotificationsHero } from '@/features/notifications/components/notifications-hero';
import { useMessageLog } from '@/features/notifications/hooks/use-notifications';
import type { MessageLogChannel, MessageLogItem, MessageLogStatus } from '@/features/notifications/types';
import { EmptyState, FilterChips } from '@/features/reports/components/ui';
import { COMM_ACCENT } from '@/features/notifications/constants';

const PAGE_SIZE = 20;

const CHANNEL_OPTIONS = [
  { value: '', label: 'All channels' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'SMS', label: 'SMS' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
];
const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'SENT', label: 'Sent' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'SKIPPED_DISABLED', label: 'Skipped — disabled' },
  { value: 'SKIPPED_QUOTA', label: 'Skipped — quota' },
];

export default function MessageLogPage() {
  const { hasPermission } = usePermissions();
  const canView = hasPermission('notifications:view');
  const canManage = hasPermission('notifications:manage');

  const [channel, setChannel] = React.useState<'' | MessageLogChannel>('');
  const [status, setStatus] = React.useState<'' | MessageLogStatus>('');
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<MessageLogItem | null>(null);

  const { data, isLoading, error, refetch } = useMessageLog({
    channel: channel || undefined,
    status: status || undefined,
    page,
    limit: PAGE_SIZE,
  });

  if (!canView) {
    return <EmptyState icon={BellOff} title="No access to the message log" description="You don't have permission to view notifications." className="mt-10" />;
  }

  return (
    <div className="space-y-5">
      <NotificationsHero
        active="log"
        title="Message log"
        subtitle="Every Email, SMS and WhatsApp notification actually sent for your gym, with its delivery status and full content."
        showSettingsTab={canManage}
      />

      <div className="flex flex-wrap items-center gap-4">
        <FilterChips
          accent={COMM_ACCENT}
          options={CHANNEL_OPTIONS}
          value={channel}
          onChange={(v) => {
            setChannel(v as '' | MessageLogChannel);
            setPage(1);
          }}
        />
        <FilterChips
          accent={COMM_ACCENT}
          options={STATUS_OPTIONS}
          value={status}
          onChange={(v) => {
            setStatus(v as '' | MessageLogStatus);
            setPage(1);
          }}
        />
      </div>

      <MessageLogTable
        data={data}
        loading={isLoading}
        error={error}
        onRetry={() => void refetch()}
        page={page}
        onPage={setPage}
        pageSize={PAGE_SIZE}
        onSelect={setSelected}
      />

      <MessageLogDetailDialog item={selected} onOpenChange={(open) => { if (!open) setSelected(null); }} />
    </div>
  );
}
