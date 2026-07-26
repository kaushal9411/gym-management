import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  UserCog,
  Contact,
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
  PieChart,
  Bell,
  Megaphone,
  LifeBuoy,
  Settings,
  Store,
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
  /** Purely presentational sidebar grouping (section header) — never affects access/visibility logic. */
  section?: string;
}

/**
 * Full sidebar catalog for the tenant portal. Filtered at render time by
 * permission + feature flag (see `use-filtered-nav.ts`) — business modules
 * beyond Dashboard/Notifications/Support/Settings don't have pages yet
 * (later prompts build them), but the routing/nav structure is already
 * final so those modules can plug in without touching this file's shape.
 */
export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, section: 'Overview' },
  { key: 'members', label: 'Members', href: '/members', icon: Users, permission: 'members:view', featureFlag: 'members', section: 'People' },
  { key: 'staff', label: 'Staff & Access', href: '/users', icon: UserCog, permission: 'users:read', featureFlag: 'staff', section: 'People' },
  {
    key: 'staff-management',
    label: 'Staff',
    href: '/staff',
    icon: Contact,
    permission: 'staff:view',
    featureFlag: 'staff',
    section: 'People',
  },
  { key: 'branches', label: 'Branches', href: '/branches', icon: Building2, permission: 'branches:view', featureFlag: 'branches', section: 'People' },
  {
    key: 'memberships',
    label: 'Memberships',
    href: '/memberships',
    icon: IdCard,
    permission: 'memberships:manage',
    featureFlag: 'membership_plans',
    section: 'Programs',
  },
  {
    key: 'attendance',
    label: 'Attendance',
    href: '/attendance',
    icon: CalendarCheck,
    permission: 'attendance:view',
    featureFlag: 'attendance',
    section: 'Programs',
  },
  {
    key: 'attendance-history',
    label: 'Attendance History',
    href: '/attendance/history',
    icon: CalendarCheck,
    permission: 'attendance:view',
    featureFlag: 'attendance',
    section: 'Programs',
  },
  {
    key: 'workout-plans',
    label: 'Workout Plans',
    href: '/workout-plans',
    icon: Dumbbell,
    permission: 'workouts:view',
    featureFlag: 'workout_plans',
    section: 'Programs',
  },
  {
    key: 'diet-plans',
    label: 'Diet Plans',
    href: '/diet-plans',
    icon: Apple,
    permission: 'diets:view',
    featureFlag: 'diet_plans',
    section: 'Programs',
  },
  { key: 'payments', label: 'Payments', href: '/payments', icon: CreditCard, permission: 'finance:view', featureFlag: 'payments', section: 'Finance' },
  {
    key: 'income',
    label: 'Income',
    href: '/income',
    icon: TrendingUp,
    permission: 'finance:view',
    featureFlag: 'income',
    section: 'Finance',
  },
  {
    key: 'expenses',
    label: 'Expenses',
    href: '/expenses',
    icon: TrendingDown,
    permission: 'finance:view',
    featureFlag: 'expenses',
    section: 'Finance',
  },
  { key: 'billing', label: 'Billing', href: '/billing', icon: Receipt, permission: 'billing:read', section: 'Finance' },
  { key: 'reports', label: 'Reports', href: '/reports', icon: BarChart3, permission: 'reports:view', featureFlag: 'reports', section: 'Insights' },
  { key: 'analytics', label: 'Analytics', href: '/analytics', icon: PieChart, permission: 'analytics:view', featureFlag: 'reports', section: 'Insights' },
  { key: 'notifications', label: 'Notifications', href: '/notifications', icon: Bell, section: 'Communication' },
  {
    key: 'announcements',
    label: 'Announcements',
    href: '/announcements',
    icon: Megaphone,
    permission: 'announcements:view',
    featureFlag: 'notifications',
    section: 'Communication',
  },
  {
    key: 'gym-settings',
    label: 'Gym Settings',
    href: '/gym-settings/profile',
    icon: Store,
    permission: 'settings:read',
    section: 'Administration',
  },
  { key: 'support', label: 'Support', href: '/support', icon: LifeBuoy, section: 'Administration' },
  { key: 'settings', label: 'Settings', href: '/settings', icon: Settings, permission: 'settings:manage', section: 'Administration' },
];
