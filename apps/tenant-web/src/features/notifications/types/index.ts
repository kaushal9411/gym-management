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

export interface NotificationListResult {
  items: TenantNotification[];
  unreadCount: number;
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
