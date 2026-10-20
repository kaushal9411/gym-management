import type { TenantNotificationChannel } from '@prisma/client';

import { toE164 } from '../../../infrastructure/sms/phone.util';
import { OPT_OUT_CHANNELS, QUIET_HOLD_CHANNELS } from '../constants/limits';
import type { MemberProfile } from '../repositories/audience.repository';
import type { RecipientSeed } from '../repositories/campaign.repository';

import { channelLabel } from './delivery-error.util';
import { quietHoldUntil } from './quiet-hours.util';

const VALID_E164 = /^\+[1-9]\d{7,14}$/;

/** Normalised E.164 for a stored phone, or `null` when it cannot be a real number. */
export function normalisePhone(phone: string | null): string | null {
  if (!phone) return null;
  const e164 = toE164(phone);
  return VALID_E164.test(e164) ? e164 : null;
}

export function isOptedOut(profile: Pick<MemberProfile, 'optedOut'>, channel: TenantNotificationChannel): boolean {
  return (OPT_OUT_CHANNELS as readonly string[]).includes(channel) && profile.optedOut.has(channel);
}

/** Why a member cannot be reached on a channel, or `null` when they can. */
export function contactProblem(profile: Pick<MemberProfile, 'email' | 'phone' | 'deviceTokens'>, channel: TenantNotificationChannel): string | null {
  switch (channel) {
    case 'IN_APP':
      return null;
    case 'PUSH':
      return profile.deviceTokens.length ? null : 'No registered device - the member has not signed in to the mobile app.';
    case 'EMAIL':
      return profile.email ? null : 'No email address on file.';
    default:
      return normalisePhone(profile.phone) ? null : profile.phone ? 'The phone number on file is not valid.' : 'No phone number on file.';
  }
}

/**
 * The initial state of one (member, channel) message when a campaign starts: skipped (opted out / no contact) or
 * queued - and, for SMS / WhatsApp with quiet hours on, held until 08:00 in the member's own branch timezone.
 */
export function decideSeed(profile: MemberProfile, channel: TenantNotificationChannel, holdQuietHours: boolean, now: Date): RecipientSeed {
  if (isOptedOut(profile, channel)) {
    return { memberId: profile.id, channel, status: 'SKIPPED_OPTED_OUT', error: `Member opted out of ${channelLabel(channel)} promotions.` };
  }
  const problem = contactProblem(profile, channel);
  if (problem) return { memberId: profile.id, channel, status: 'SKIPPED_NO_CONTACT', error: problem };
  const deliverAfter = holdQuietHours && QUIET_HOLD_CHANNELS.includes(channel) ? quietHoldUntil(now, profile.timezone) : null;
  return { memberId: profile.id, channel, status: 'QUEUED', deliverAfter };
}
