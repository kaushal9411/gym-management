export type NotificationCategory =
  | 'ANNOUNCEMENT'
  | 'SYSTEM'
  | 'SUBSCRIPTION'
  | 'GENERAL'
  | 'MEMBER'
  | 'MEMBERSHIP'
  | 'PAYMENT'
  | 'ATTENDANCE'
  | 'WORKOUT'
  | 'DIET'
  | 'STAFF';

export interface TenantNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  sourceNotificationId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListParams {
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
  category?: NotificationCategory;
  search?: string;
}

export interface NotificationListResult {
  items: TenantNotification[];
  unreadCount: number;
  /** Tab counts for the current category/search filters (ignores `unreadOnly`). Absent until the API supports it. */
  counts?: { all: number; unread: number };
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CreateNotificationInput {
  category: NotificationCategory;
  title: string;
  body: string;
}

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'PUSH' | 'SMS' | 'WHATSAPP';

export type NotificationTemplateType =
  | 'MEMBERSHIP_EXPIRY'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'MEMBERSHIP_RENEWAL'
  | 'NEW_MEMBER_REGISTRATION'
  | 'ATTENDANCE_CONFIRMATION'
  | 'WORKOUT_ASSIGNMENT'
  | 'DIET_ASSIGNMENT'
  | 'WELCOME_MESSAGE'
  | 'BIRTHDAY_WISHES';

export interface NotificationTemplate {
  type: NotificationTemplateType;
  label: string;
  description: string;
  channels: NotificationChannel[];
  titleTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
  isCustomized: boolean;
}

export interface UpdateNotificationTemplateInput {
  channels: NotificationChannel[];
  titleTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
}

export interface NotificationStatsParams {
  dateFrom: string;
  dateTo: string;
}

interface StatsRange {
  from: string;
  to: string;
}

export interface NotificationStats {
  range: StatsRange;
  previousRange: StatsRange;
  kpis: {
    total: { value: number; previous: number };
    unread: { value: number };
    read: { value: number; previous: number };
    /** 0..1 */
    readRate: { value: number; previous: number };
  };
  daily: Array<{ date: string; total: number; read: number; previousTotal: number }>;
  categories: Array<{ category: NotificationCategory; count: number; unread: number; previousCount: number }>;
  hourly: Array<{ hour: number; count: number }>;
}
