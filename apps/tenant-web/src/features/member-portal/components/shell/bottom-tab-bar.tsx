'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Ellipsis } from 'lucide-react';

import { cn } from '@/lib/utils';
import { isNavActive, PORTAL_NAV } from '../../lib/nav';
import { MoreSheet } from './more-sheet';

/** Fixed phone bottom bar (<md): the `bar: true` nav items + "More" (opens `MoreSheet`). Safe-area padded; active tab has a shared-layout pill. */
export function BottomTabBar({ pathname, unread }: { pathname: string; unread: number }) {
  const pillId = React.useId();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const barItems = PORTAL_NAV.filter((i) => i.bar);
  const moreActive = !barItems.some((i) => isNavActive(i, pathname)) && PORTAL_NAV.some((i) => isNavActive(i, pathname));

  const tabCls = 'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none';
  const pill = (
    <motion.span layoutId={pillId} className="absolute inset-x-2 top-1 bottom-1 -z-10 rounded-2xl bg-primary/12" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
  );

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/92 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_-12px_rgb(0_0_0/0.25)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch px-1">
          {barItems.map((item) => {
            const active = isNavActive(item, pathname);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={cn(tabCls, active ? 'text-primary' : 'text-muted-foreground active:text-foreground')}>
                {active ? pill : null}
                <item.icon className="size-[22px]" aria-hidden strokeWidth={active ? 2.4 : 2} />
                <span>{item.shortLabel ?? item.label}</span>
              </Link>
            );
          })}
          <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" className={cn(tabCls, moreActive ? 'text-primary' : 'text-muted-foreground active:text-foreground')}>
            {moreActive ? pill : null}
            <span className="relative">
              <Ellipsis className="size-[22px]" aria-hidden />
              {unread > 0 ? <span className="absolute -right-1 -top-0.5 size-2 rounded-full bg-destructive ring-2 ring-background" /> : null}
            </span>
            <span>More</span>
          </button>
        </div>
      </nav>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} pathname={pathname} unread={unread} />
    </>
  );
}
