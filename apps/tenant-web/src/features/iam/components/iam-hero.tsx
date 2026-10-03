'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { cn } from '@/lib/utils';
import { useRoles, useUserStats } from '../hooks/use-iam';

const TABS = [
  { href: '/users', label: 'Users', permission: 'users:read' },
  { href: '/roles', label: 'Roles', permission: 'roles:read' },
  { href: '/permissions', label: 'Permissions', permission: 'permissions:read' },
  { href: '/invitations', label: 'Invitations', permission: 'users:invite' },
] as const;

interface IamHeroProps {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}

/** Shared gradient header + tab bar for the four Staff & Access pages (Users, Roles, Permissions, Invitations). */
export function IamHero({ title, subtitle, actions }: IamHeroProps) {
  const pathname = usePathname();
  const { hasPermission } = usePermissions();
  const { currentBranchId } = useCurrentBranch();
  // Tab counts are decoration: only fetch what this user is allowed to read, so a restricted user never triggers a 403.
  const stats = useUserStats(currentBranchId ?? undefined, { enabled: hasPermission('users:read') });
  const roles = useRoles({ enabled: hasPermission('roles:read') });

  const counts: Record<string, number | undefined> = {
    '/users': stats.data?.total,
    '/roles': roles.data?.length,
    '/invitations': stats.data?.pendingInvitations,
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative flex flex-col gap-4 overflow-hidden rounded-3xl px-6 pt-6 text-white shadow-lg sm:px-7"
      style={{ backgroundImage: 'radial-gradient(900px 320px at 88% -30%, color-mix(in oklch, #c026d3 75%, transparent), transparent 60%), linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 14px)' }} />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">Administration</p>
          <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-1 text-white/85">{subtitle}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 [&_a]:border-white/30 [&_button:not([data-solid])]:border-white/30 [&_button:not([data-solid])]:bg-white/15 [&_button:not([data-solid])]:text-white [&_button:not([data-solid]):hover]:bg-white/25">{actions}</div> : null}
      </div>

      <nav aria-label="Staff & access sections" className="relative -mb-px flex gap-1 overflow-x-auto">
        {TABS.filter((t) => hasPermission(t.permission)).map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
          const count = counts[t.href];
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex items-center gap-2 whitespace-nowrap rounded-t-xl px-4 py-2.5 text-[13.5px] font-bold transition-colors',
                active ? 'bg-background text-primary' : 'text-white/80 hover:bg-white/10 hover:text-white',
              )}
            >
              {t.label}
              {count !== undefined ? (
                <b className={cn('rounded-full px-2 text-[11px] tabular-nums', active ? 'bg-primary/15 text-primary' : 'bg-white/20')}>{count}</b>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </motion.section>
  );
}
