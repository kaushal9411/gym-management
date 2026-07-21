import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  UserCog,
  Building2,
  IdCard,
  CalendarCheck,
  Dumbbell,
  Apple,
  CreditCard,
  Receipt,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Bell,
  LifeBuoy,
  Settings,
} from 'lucide-react';

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Permission key(s) required (`resource:action`); array means "any of". Omit for items every role can see. */
  permission?: string | string[];
  /** Module key from `tenant.featureFlags` gating this item by subscription plan. Omit for always-available items. */
  featureFlag?: string;
}

/**
 * Full sidebar catalog for the tenant portal. Filtered at render time by
 * permission + feature flag (see `use-filtered-nav.ts`) — business modules
 * beyond Dashboard/Notifications/Support/Settings don't have pages yet
 * (later prompts build them), but the routing/nav structure is already
 * final so those modules can plug in without touching this file's shape.
 */
export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'members', label: 'Members', href: '/members', icon: Users, permission: 'members:read', featureFlag: 'members' },
  { key: 'staff', label: 'Staff & Access', href: '/users', icon: UserCog, permission: 'users:read', featureFlag: 'staff' },
  { key: 'branches', label: 'Branches', href: '/branches', icon: Building2, permission: 'branches:read', featureFlag: 'branches' },
  {
    key: 'memberships',
    label: 'Memberships',
    href: '/memberships',
    icon: IdCard,
    permission: 'memberships:manage',
    featureFlag: 'membership_plans',
  },
  {
    key: 'attendance',
    label: 'Attendance',
    href: '/attendance',
    icon: CalendarCheck,
    permission: 'attendance:read',
    featureFlag: 'attendance',
  },
  {
    key: 'workout-plans',
    label: 'Workout Plans',
    href: '/workout-plans',
    icon: Dumbbell,
    permission: 'workout-plans:manage',
    featureFlag: 'workout_plans',
  },
  {
    key: 'diet-plans',
    label: 'Diet Plans',
    href: '/diet-plans',
    icon: Apple,
    permission: 'diet-plans:manage',
    featureFlag: 'diet_plans',
  },
  { key: 'payments', label: 'Payments', href: '/payments', icon: CreditCard, permission: 'payments:read', featureFlag: 'payments' },
  {
    key: 'income',
    label: 'Income',
    href: '/income',
    icon: TrendingUp,
    permission: 'reports:view-financial',
    featureFlag: 'income',
  },
  {
    key: 'expenses',
    label: 'Expenses',
    href: '/expenses',
    icon: TrendingDown,
    permission: 'reports:view-financial',
    featureFlag: 'expenses',
  },
  { key: 'reports', label: 'Reports', href: '/reports', icon: BarChart3, permission: 'reports:read', featureFlag: 'reports' },
  { key: 'billing', label: 'Billing', href: '/billing', icon: Receipt, permission: 'billing:read' },
  { key: 'notifications', label: 'Notifications', href: '/notifications', icon: Bell },
  { key: 'support', label: 'Support', href: '/support', icon: LifeBuoy },
  { key: 'settings', label: 'Settings', href: '/settings', icon: Settings, permission: 'settings:manage' },
];
