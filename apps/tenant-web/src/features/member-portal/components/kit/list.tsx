'use client';

import * as React from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { toneChipStyle, type PortalTone } from './tones';

/** Divided list container (no padding; use inside `SectionCard flush`). Tables on phones become `PortalList` of `ListRow`s. */
export function PortalList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <ul className={cn('divide-y', className)}>{children}</ul>;
}

/**
 * List row with tap state (>=56px, active press highlight).
 * `icon`+`tone` leading chip (or `leading` node), `title`/`subtitle` (truncate),
 * `trailing` right node (amount/chip), `href` or `onClick` makes it
 * interactive (chevron shown unless `hideChevron`).
 */
export function ListRow({
  icon: Icon,
  tone = 'primary',
  leading,
  title,
  subtitle,
  trailing,
  href,
  onClick,
  hideChevron,
  className,
}: {
  icon?: LucideIcon;
  tone?: PortalTone;
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  hideChevron?: boolean;
  className?: string;
}) {
  const interactive = Boolean(href || onClick);
  const inner = (
    <>
      {leading ??
        (Icon ? (
          <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={toneChipStyle(tone)}>
            <Icon className="size-[18px]" aria-hidden />
          </span>
        ) : null)}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {subtitle ? <span className="block truncate text-xs text-muted-foreground">{subtitle}</span> : null}
      </span>
      {trailing ? <span className="shrink-0 text-right text-sm">{trailing}</span> : null}
      {interactive && !hideChevron ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
    </>
  );
  const cls = cn('flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left', interactive && 'transition-colors active:bg-accent hover:bg-accent/60 focus-visible:outline-none focus-visible:bg-accent', className);
  return (
    <li>
      {href ? (
        <Link href={href} className={cls}>
          {inner}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={cls}>
          {inner}
        </button>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </li>
  );
}

/** Pill chip for statuses: `tone` colours it. */
export function StatusChip({ children, tone = 'muted', className }: { children: React.ReactNode; tone?: PortalTone; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', className)} style={toneChipStyle(tone)}>
      {children}
    </span>
  );
}
