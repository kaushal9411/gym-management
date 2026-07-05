export type NotificationCategory = 'ANNOUNCEMENT' | 'SYSTEM' | 'SUBSCRIPTION' | 'GENERAL';

export interface TenantNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  sourceNotificationId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResult {
  items: TenantNotification[];
  unreadCount: number;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
