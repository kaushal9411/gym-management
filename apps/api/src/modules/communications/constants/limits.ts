import type { TenantNotificationChannel } from '@prisma/client';

/** Every channel, in the order the UIs list them. */
export const ALL_CHANNELS: readonly TenantNotificationChannel[] = ['PUSH', 'IN_APP', 'EMAIL', 'SMS', 'WHATSAPP'];

/** Channels that go through `checkAndConsumeChannelQuota` (platform ceiling -> tenant toggle -> monthly quota). */
export const PAID_CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP'] as const;
export type PaidChannel = (typeof PAID_CHANNELS)[number];

export function isPaidChannel(channel: TenantNotificationChannel): channel is PaidChannel {
  return (PAID_CHANNELS as readonly string[]).includes(channel);
}

/** Channels a member may opt out of (the in-app inbox is passive and never blockable). */
export const OPT_OUT_CHANNELS = ['PUSH', 'EMAIL', 'SMS', 'WHATSAPP'] as const;

/** Channels a staff test-send can reach (the member inbox is member-only). */
export const TEST_SEND_CHANNELS = ['PUSH', 'EMAIL', 'SMS', 'WHATSAPP'] as const;

export const TITLE_MAX = 200;
export const BODY_MAX = 2000;
export const NAME_MAX = 120;
/** SMS text is `title + "\n" + body`; Kaleyra concatenates up to ~1600 chars, we cap lower to keep cost predictable. */
export const SMS_TEXT_MAX = 1000;

export const MAX_RECIPIENTS = 5000;
export const LARGE_SEND_THRESHOLD = 100;
export const MAX_CAMPAIGNS_PER_HOUR = 10;
export const MAX_SCHEDULE_DAYS = 90;
export const MIN_SCHEDULE_LEAD_MS = 60_000;
export const MAX_PICKED_IDS = MAX_RECIPIENTS;
export const MAX_FILTER_IDS = 50;

/** Recipient-messages handled per queue job. */
export const BATCH_SIZE = 200;
/** A message handed to a channel queue but never finalised within this window is marked FAILED by the sweeper. */
export const DISPATCH_STALE_MINUTES = 30;

/** Quiet hours (member's branch-local clock). Only SMS/WhatsApp are held. */
export const QUIET_START_HOUR = 21;
export const QUIET_END_HOUR = 8;
export const QUIET_HOLD_CHANNELS: readonly TenantNotificationChannel[] = ['SMS', 'WHATSAPP'];

export const WHATSAPP_NOTICE =
  'WhatsApp only delivers free-text messages to members who wrote to your number in the last 24 hours; outside that window an approved message template is required (not set up yet), so those messages are reported as failed.';
export const WHATSAPP_ERROR_HINT =
  ' (WhatsApp delivers free-text only inside the 24-hour window after the member last messaged you; otherwise an approved template is required.)';
