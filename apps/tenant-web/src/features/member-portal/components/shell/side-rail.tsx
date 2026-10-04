'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { LogOut } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DownloadAppButton } from '@/features/app-download/download-app-button';
import { TenantLogo } from '@/features/tenant/components/tenant-logo';
import { useTenant } from '@/features/tenant/tenant-provider';
import { cn } from '@/lib/utils';
import { initials } from '../../lib/format';
import { isNavActive, PORTAL_NAV, PORTAL_NAV_GROUPS } from '../../lib/nav';
import { toneChipStyle } from '../kit/tones';
import { NavBadge } from './nav-badge';

/** Sticky desktop rail (>=md): tenant header, grouped nav (icon chips, shared-layout active indicator, unread badge), member card with app download + logout. */
export function SideRail({ pathname, name, memberId, photoUrl, unread, onLogout, loggingOut }: { pathname: string; name?: string; memberId?: string; photoUrl?: string | null; unread: number; onLogout: () => void; loggingOut: boolean }) {
  const tenant = useTenant();
  const indicatorId = React.useId();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-background md:flex">
      <div className="relative flex h-16 items-center gap-2.5 overflow-hidden border-b px-4">
        <span aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ background: 'linear-gradient(135deg, color-mix(in oklab, var(--primary) 14%, transparent), transparent 70%)' }} />
        <TenantLogo size="sm" className="relative" />
        <span className="relative truncate text-sm font-semibold tracking-tight">{tenant.name}</span>
      </div>
      <nav aria-label="Member portal" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {PORTAL_NAV_GROUPS.map((group) => {
          const items = PORTAL_NAV.filter((i) => i.group === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">{group}</p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = isNavActive(item, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn('group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors', active ? 'text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}
                    >
                      {active ? <motion.span layoutId={indicatorId} className="absolute inset-0 -z-0 rounded-xl bg-primary/10" transition={{ type: 'spring', stiffness: 420, damping: 34 }} /> : null}
                      {active ? <motion.span layoutId={`${indicatorId}-bar`} className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-primary" /> : null}
                      <span className="relative grid size-8 shrink-0 place-items-center rounded-lg transition-colors group-hover:bg-background" style={active ? toneChipStyle('primary') : undefined}>
                        <item.icon className="size-[18px]" aria-hidden />
                      </span>
                      <span className="relative flex-1 truncate">{item.label}</span>
                      {item.badge === 'unread' ? <NavBadge count={unread} className="relative" /> : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="m-3 flex items-center gap-2.5 rounded-2xl border bg-card p-2.5">
        <Avatar className="size-9">
          <AvatarImage src={photoUrl ?? undefined} alt={name ?? ''} />
          <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{memberId}</p>
        </div>
        <DownloadAppButton className="size-8 shrink-0" />
        <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Log out" onClick={onLogout} disabled={loggingOut}>
          <LogOut className="size-4" />
        </Button>
      </div>
    </aside>
  );
}
