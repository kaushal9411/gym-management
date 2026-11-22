import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  UserCog,
  Contact,
  Building2,
  IdCard,
  CalendarCheck,
  CalendarRange,
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
  Send,
  LifeBuoy,
  Settings,
  Store,
  Ruler,
  Fingerprint,
  Target,
  BriefcaseBusiness,
  LayoutGrid,
  Wallet,
  CalendarDays,
  UserRound,
  SlidersHorizontal,
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
  /** Optional permission-filtered sub-links shown under the item while its section is open (sidebar only). */
  children?: NavChild[];
}

export interface NavChild {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Any-of when an array. Omit to inherit the parent's visibility. */
  permission?: string | string[];
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
  {
    // No featureFlag on purpose: leads are not a plan module, access is permission-only.
    key: 'leads',
    label: 'Leads',
    href: '/leads',
    icon: Target,
    permission: 'leads:view',
    section: 'People',
  },
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
  {
    // One top-level entry; sub-links are permission-filtered. Visible with ANY hr:* key (managers see the whole set, self-service staff only "My HR") AND the `hr` feature flag. The flag gates the whole group: `use-filtered-nav.ts` filters children only after the parent passes, and `route-features.ts` maps every `/hr/**` path to `hr` by segment-aware prefix match on this entry's href.
    key: 'hr',
    label: 'HR',
    href: '/hr',
    featureFlag: 'hr',
    icon: BriefcaseBusiness,
    permission: ['hr:view', 'hr:attendance_manage', 'hr:leave_manage', 'hr:payroll_manage', 'hr:settings_manage', 'hr:self_attendance', 'hr:self_leave', 'hr:self_payslip'],
    section: 'People',
    children: [
      { key: 'hr-overview', label: 'Overview', href: '/hr', icon: LayoutGrid, permission: 'hr:view' },
      { key: 'hr-employees', label: 'Employees', href: '/hr/employees', icon: Contact, permission: 'hr:view' },
      { key: 'hr-attendance', label: 'Attendance', href: '/hr/attendance', icon: CalendarCheck, permission: 'hr:view' },
      { key: 'hr-leaves', label: 'Leaves', href: '/hr/leaves', icon: CalendarDays, permission: 'hr:leave_manage' },
      { key: 'hr-payroll', label: 'Payroll', href: '/hr/payroll', icon: Wallet, permission: 'hr:payroll_manage' },
      { key: 'hr-setup', label: 'Setup', href: '/hr/setup', icon: SlidersHorizontal, permission: 'hr:view' },
      { key: 'hr-me', label: 'My HR', href: '/hr/me', icon: UserRound, permission: ['hr:self_attendance', 'hr:self_leave', 'hr:self_payslip'] },
    ],
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
    key: 'attendance-devices',
    label: 'Attendance Devices',
    href: '/attendance-devices',
    icon: Fingerprint,
    permission: 'attendance-devices:manage',
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
    key: 'classes',
    label: 'Classes',
    href: '/classes',
    icon: CalendarRange,
    permission: 'classes:view',
    featureFlag: 'live_classes',
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
  {
    // No featureFlag — always-on, same as Dashboard/Notifications/Support
    // (a per-member log, not a plan-tier add-on like Workout/Diet/Classes).
    key: 'measurements',
    label: 'Body Measurements',
    href: '/measurements',
    icon: Ruler,
    permission: 'measurements:view',
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
  { key: 'notifications', label: 'Notifications', href: '/notifications', icon: Bell, featureFlag: 'notifications', section: 'Communication' },
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
    // Campaigns, automations and delivery history. Visible with notifications:view; the Send tab itself needs notifications:send (checked in-page).
    key: 'communications',
    label: 'Communications',
    href: '/communications',
    icon: Send,
    permission: 'notifications:view',
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
