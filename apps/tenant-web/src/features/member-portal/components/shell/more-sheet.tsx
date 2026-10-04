'use client';

import Link from 'next/link';

import { cn } from '@/lib/utils';
import { SheetModal } from '../kit/sheet-modal';
import { isNavActive, PORTAL_NAV, PORTAL_NAV_GROUPS } from '../../lib/nav';
import { NavBadge } from './nav-badge';

/** "More" bottom sheet: every nav item that is not in the bottom bar, grouped. */
export function MoreSheet({ open, onOpenChange, pathname, unread }: { open: boolean; onOpenChange: (o: boolean) => void; pathname: string; unread: number }) {
  const items = PORTAL_NAV.filter((i) => !i.bar);
  return (
    <SheetModal open={open} onOpenChange={onOpenChange} title="More" description="Everything else in your member portal">
      <div className="space-y-4">
        {PORTAL_NAV_GROUPS.map((group) => {
          const groupItems = items.filter((i) => i.group === group);
          if (!groupItems.length) return null;
          return (
            <div key={group}>
              <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group}</p>
              <div className="grid grid-cols-3 gap-2">
                {groupItems.map((item) => {
                  const active = isNavActive(item, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => onOpenChange(false)}
                      className={cn(
                        'relative flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center text-xs font-medium transition active:scale-95',
                        active ? 'border-primary/40 bg-primary/10 text-primary' : 'bg-card text-foreground',
                      )}
                    >
                      <item.icon className="size-6" aria-hidden />
                      <span className="w-full truncate">{item.label}</span>
                      {item.badge === 'unread' ? <NavBadge count={unread} className="absolute right-2 top-2" /> : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </SheetModal>
  );
}
