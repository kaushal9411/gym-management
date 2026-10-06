import { tokenPillStyle } from '@/features/finance/components/finance-badges';
import { cn } from '@/lib/utils';
import type { MessageLogChannel, MessageLogStatus } from '../types';

export const MESSAGE_LOG_STATUS_META: Record<MessageLogStatus, { label: string; color: string }> = {
  SENT: { label: 'Sent', color: 'var(--chart-3)' },
  FAILED: { label: 'Failed', color: 'var(--chart-8)' },
  SKIPPED_DISABLED: { label: 'Skipped — disabled', color: 'var(--muted-foreground)' },
  SKIPPED_QUOTA: { label: 'Skipped — quota', color: 'var(--chart-5)' },
};

export const MESSAGE_LOG_CHANNEL_META: Record<MessageLogChannel, { label: string; color: string }> = {
  EMAIL: { label: 'Email', color: 'var(--chart-1)' },
  SMS: { label: 'SMS', color: 'var(--chart-2)' },
  WHATSAPP: { label: 'WhatsApp', color: 'var(--chart-4)' },
};

export function MessageLogStatusBadge({ status, className }: { status: MessageLogStatus; className?: string }) {
  const meta = MESSAGE_LOG_STATUS_META[status];
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-bold', className)} style={tokenPillStyle(meta.color)}>
      <span className="size-2 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
      {meta.label}
    </span>
  );
}

export function MessageLogChannelBadge({ channel, className }: { channel: MessageLogChannel; className?: string }) {
  const meta = MESSAGE_LOG_CHANNEL_META[channel];
  return (
    <span className={cn('inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-bold', className)} style={tokenPillStyle(meta.color)}>
      {meta.label}
    </span>
  );
}
