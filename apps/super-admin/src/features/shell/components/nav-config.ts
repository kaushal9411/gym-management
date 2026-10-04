import {
  Bell, Building2, Clock, CreditCard, FileText, Gauge, LifeBuoy, Receipt, ScrollText, Settings, Smartphone, Ticket, ToggleLeft, TrendingUp, Users,
  type LucideIcon,
} from 'lucide-react';

import { ADMIN_ROUTES } from '@/constants/routes';

export type NavBadgeKey = 'tenants' | 'payments' | 'support';
export interface NavItem { href: string; label: string; icon: LucideIcon; permission: string; badge?: NavBadgeKey }
export interface NavGroup { label: string; items: NavItem[] }

/** All 15 portal pages, grouped as in the approved design. `permission` is the backend key that gates the page; Dashboard is never hidden. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: ADMIN_ROUTES.dashboard, label: 'Dashboard', icon: Gauge, permission: 'dashboard:read' },
      { href: ADMIN_ROUTES.tenants, label: 'Tenants', icon: Building2, permission: 'tenants:read', badge: 'tenants' },
    ],
  },
  {
    label: 'Revenue',
    items: [
      { href: ADMIN_ROUTES.plans, label: 'Plans', icon: CreditCard, permission: 'plans:manage' },
      { href: ADMIN_ROUTES.coupons, label: 'Coupons', icon: Ticket, permission: 'coupons:manage' },
      { href: ADMIN_ROUTES.revenue, label: 'Revenue', icon: TrendingUp, permission: 'revenue:read' },
      { href: ADMIN_ROUTES.payments, label: 'Payments', icon: Receipt, permission: 'payments:read', badge: 'payments' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: ADMIN_ROUTES.support, label: 'Support', icon: LifeBuoy, permission: 'support:manage', badge: 'support' },
      { href: ADMIN_ROUTES.notifications, label: 'Notifications', icon: Bell, permission: 'notifications:send' },
      { href: ADMIN_ROUTES.scheduler, label: 'Scheduler', icon: Clock, permission: 'scheduler:view' },
      { href: ADMIN_ROUTES.featureFlags, label: 'Feature flags', icon: ToggleLeft, permission: 'feature-flags:manage' },
      { href: ADMIN_ROUTES.cms, label: 'CMS', icon: FileText, permission: 'cms:manage' },
      { href: ADMIN_ROUTES.appReleases, label: 'App releases', icon: Smartphone, permission: 'app-releases:manage' },
    ],
  },
  {
    label: 'Governance',
    items: [
      { href: ADMIN_ROUTES.roles, label: 'Roles & admins', icon: Users, permission: 'admins:manage' },
      { href: ADMIN_ROUTES.auditLogs, label: 'Audit logs', icon: ScrollText, permission: 'audit:read' },
      { href: ADMIN_ROUTES.settings, label: 'Settings', icon: Settings, permission: 'settings:manage' },
    ],
  },
];

export const NAV_LABELS: Record<string, string> = Object.fromEntries(NAV_GROUPS.flatMap((g) => g.items.map((i) => [i.href.slice(1), i.label])));
