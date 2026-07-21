'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/users', label: 'Users', permission: 'users:read' },
  { href: '/roles', label: 'Roles', permission: 'roles:read' },
  { href: '/permissions', label: 'Permissions', permission: 'permissions:read' },
  { href: '/invitations', label: 'Invitations', permission: 'users:invite' },
] as const;

/** Shared secondary nav across the IAM pages (mirrors the billing tabs pattern). */
export function IamNav() {
  const pathname = usePathname();
  const { hasPermission } = usePermissions();
  const visible = TABS.filter((tab) => hasPermission(tab.permission));

  return (
    <nav className="flex gap-1 border-b border-border" aria-label="Staff & access sections">
      {visible.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
