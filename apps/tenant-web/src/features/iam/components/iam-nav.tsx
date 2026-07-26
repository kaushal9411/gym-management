'use client';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { RouteTabNav } from '@/components/ui/route-tab-nav';

const TABS = [
  { href: '/users', label: 'Users', permission: 'users:read' },
  { href: '/roles', label: 'Roles', permission: 'roles:read' },
  { href: '/permissions', label: 'Permissions', permission: 'permissions:read' },
  { href: '/invitations', label: 'Invitations', permission: 'users:invite' },
] as const;

/** Shared secondary nav across the IAM pages (mirrors the billing tabs pattern). */
export function IamNav() {
  const { hasPermission } = usePermissions();
  const visible = TABS.filter((tab) => hasPermission(tab.permission));

  return <RouteTabNav tabs={visible} aria-label="Staff & access sections" />;
}
