import type { ElementType } from 'react';
import { Bell, CalendarCheck, CreditCard, Dumbbell, Megaphone, Settings2, ShieldAlert, User, UserCog, UtensilsCrossed, Wallet } from 'lucide-react';

import type { ReportAccent } from '@/features/reports/lib/reports-theme';
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

/** Local 'communication' accent: the kit has no such accent and the foundation files are not ours to edit, so reuse the violet/magenta `analytics` palette (same hero gradient family as Payments). */
export const COMM_ACCENT: ReportAccent = 'analytics';

export const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  ANNOUNCEMENT: 'Announcements',
  SYSTEM: 'System',
  SUBSCRIPTION: 'Subscription',
  GENERAL: 'General',
  MEMBER: 'Members',
  MEMBERSHIP: 'Memberships',
  PAYMENT: 'Payments',
  ATTENDANCE: 'Attendance',
  WORKOUT: 'Workouts',
  DIET: 'Diet',
  STAFF: 'Staff',
};

/** Theme-token colour per category (chart tokens, same hues the rest of the redesign uses: members indigo, payments teal, attendance orange, staff magenta). */
export const CATEGORY_COLOR: Record<NotificationCategory, string> = {
  ANNOUNCEMENT: 'var(--chart-7)',
  SYSTEM: 'var(--chart-6)',
  SUBSCRIPTION: 'var(--chart-8)',
  GENERAL: 'var(--muted-foreground)',
  MEMBER: 'var(--chart-1)',
  MEMBERSHIP: 'var(--chart-4)',
  PAYMENT: 'var(--chart-3)',
  ATTENDANCE: 'var(--chart-2)',
  WORKOUT: 'var(--chart-5)',
  DIET: 'var(--success)',
  STAFF: 'var(--chart-5)',
};

export const NOTIFICATION_CATEGORIES = Object.keys(CATEGORY_LABEL) as NotificationCategory[];

/** 'Today' / 'Yesterday' / 'Mon, 5 Oct' for the day-grouped feed (local time). */
export function dayGroupLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}
