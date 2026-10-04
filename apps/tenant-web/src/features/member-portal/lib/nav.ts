import { Bell, CalendarCheck, CalendarRange, CreditCard, Dumbbell, Landmark, LayoutDashboard, Wallet, Receipt, Ruler, Salad, UserRound, type LucideIcon } from 'lucide-react';

import { MEMBER_PORTAL_ROUTES } from '../constants';

export type PortalNavGroup = 'Overview' | 'Training' | 'Account';

export interface PortalNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group: PortalNavGroup;
  /** Shown in the phone bottom tab bar (keep to 4; the rest go under "More"). */
  bar?: boolean;
  /** Short label for the bottom bar (defaults to `label`). */
  shortLabel?: string;
  /** Renders the live unread-notification count next to the item. */
  badge?: 'unread';
  /** Extra path prefixes that also mark this item active. */
  also?: string[];
}

/**
 * THE single source of truth for portal navigation (desktop rail, bottom
 * tab bar and the "More" sheet all derive from it). To add a page: append
 * an entry here (order within a group = display order; `bar: true` only for
 * the 4 primary phone tabs). Nothing else needs to change.
 */
export const PORTAL_NAV: PortalNavItem[] = [
  { href: MEMBER_PORTAL_ROUTES.dashboard, label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard, group: 'Overview', bar: true },
  { href: MEMBER_PORTAL_ROUTES.notifications, label: 'Notifications', icon: Bell, group: 'Overview', badge: 'unread' },
  { href: MEMBER_PORTAL_ROUTES.attendance, label: 'Attendance', icon: CalendarCheck, group: 'Training', bar: true },
  { href: MEMBER_PORTAL_ROUTES.workout, label: 'Workout', icon: Dumbbell, group: 'Training', bar: true },
  { href: MEMBER_PORTAL_ROUTES.classes, label: 'Classes', icon: CalendarRange, group: 'Training', bar: true },
  { href: MEMBER_PORTAL_ROUTES.diet, label: 'Diet', icon: Salad, group: 'Training' },
  { href: MEMBER_PORTAL_ROUTES.measurements, label: 'Measurements', icon: Ruler, group: 'Training' },
  { href: MEMBER_PORTAL_ROUTES.renew, label: 'Renew', icon: CreditCard, group: 'Account' },
  { href: MEMBER_PORTAL_ROUTES.invoices, label: 'Invoices', icon: Receipt, group: 'Account' },
  { href: MEMBER_PORTAL_ROUTES.payments, label: 'Payments', icon: Wallet, group: 'Account' },
  { href: MEMBER_PORTAL_ROUTES.gym, label: 'My gym', icon: Landmark, group: 'Account' },
  { href: MEMBER_PORTAL_ROUTES.profile, label: 'Profile', icon: UserRound, group: 'Account' },
];

export const PORTAL_NAV_GROUPS: PortalNavGroup[] = ['Overview', 'Training', 'Account'];

export function isNavActive(item: PortalNavItem, pathname: string): boolean {
  return [item.href, ...(item.also ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function findActiveNav(pathname: string): PortalNavItem | undefined {
  return PORTAL_NAV.find((i) => isNavActive(i, pathname));
}
