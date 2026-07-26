import type { ElementType } from 'react';
import { Bell, CalendarCheck, CreditCard, Dumbbell, Megaphone, Settings2, ShieldAlert, User, UserCog, UtensilsCrossed, Wallet } from 'lucide-react';

import type { NotificationCategory, TenantNotification } from './types';

export type NotificationFilterTab = 'unread' | 'read' | NotificationCategory;

export const NOTIFICATION_TABS: Array<{ value: NotificationFilterTab; label: string }> = [
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
  { value: 'ANNOUNCEMENT', label: 'Announcements' },
  { value: 'MEMBER', label: 'Members' },
  { value: 'MEMBERSHIP', label: 'Memberships' },
  { value: 'PAYMENT', label: 'Payments' },
  { value: 'ATTENDANCE', label: 'Attendance' },
  { value: 'WORKOUT', label: 'Workouts' },
  { value: 'DIET', label: 'Diet' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'SYSTEM', label: 'System' },
  { value: 'SUBSCRIPTION', label: 'Subscription' },
];

export const CATEGORY_ICON: Record<NotificationCategory, ElementType> = {
  ANNOUNCEMENT: Megaphone,
  SYSTEM: Settings2,
  SUBSCRIPTION: ShieldAlert,
  GENERAL: Bell,
  MEMBER: User,
  MEMBERSHIP: CreditCard,
  PAYMENT: Wallet,
  ATTENDANCE: CalendarCheck,
  WORKOUT: Dumbbell,
  DIET: UtensilsCrossed,
  STAFF: UserCog,
};

export function matchesNotificationTab(notification: TenantNotification, tab: NotificationFilterTab): boolean {
  if (tab === 'unread') return notification.readAt === null;
  if (tab === 'read') return notification.readAt !== null;
  return notification.category === tab;
}
