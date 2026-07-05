export type AnnouncementAudience = 'ALL' | 'TRIAL' | 'ACTIVE' | 'SPECIFIC';
export type NotificationChannel = 'EMAIL' | 'PUSH' | 'IN_APP';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  isActive: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  expiresAt?: string;
}

export interface AdminNotification {
  id: string;
  title: string;
  body: string;
  channel: NotificationChannel;
  audience: AnnouncementAudience;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface CreateNotificationInput {
  title: string;
  body: string;
  channel: NotificationChannel;
  audience: AnnouncementAudience;
  scheduledAt?: string;
}
