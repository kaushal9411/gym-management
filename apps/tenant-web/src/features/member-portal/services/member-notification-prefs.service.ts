import type { MemberNotificationPreferences } from '@/features/communications/types';
import { memberApiClient } from './member-api-client';

interface Envelope<T> {
  success: boolean;
  data: T;
  message: string;
}

export type PrefChannel = MemberNotificationPreferences['channels'][number]['channel'];

/** `GET`/`PUT /portal/notification-preferences` (member plane, `memberApiClient` only). */
export const memberNotificationPrefsService = {
  async get(): Promise<MemberNotificationPreferences> {
    const res = await memberApiClient.get<Envelope<MemberNotificationPreferences>>('/portal/notification-preferences');
    return res.data.data;
  },
  async update(channels: Array<{ channel: PrefChannel; promotionalOptOut: boolean }>): Promise<MemberNotificationPreferences> {
    const res = await memberApiClient.put<Envelope<MemberNotificationPreferences>>('/portal/notification-preferences', { channels });
    return res.data.data;
  },
};
