'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useMotionSafe } from '@/features/reports/lib/motion';
import { toneChipStyle, toneWash, type PortalTone } from './tones';

/**
 * Titled card that fades up when scrolled into view (plays once - do not wrap
 * in `Reveal`). `icon`+`tone` = header chip, `action` = `{label, href}` link or
 * any node, `flush` removes body padding (for `PortalList`). Body min-width 0
 * so wide content never causes page-level horizontal scroll.
 */
export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  tone = 'primary',
  action,
  flush,
  children,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  tone?: PortalTone;
  action?: { label: string; href: string } | React.ReactNode;
  flush?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const m = useMotionSafe();
  const link = action && typeof action === 'object' && 'href' in (action as object) ? (action as { label: string; href: string }) : null;
  return (
    <motion.section
      variants={m.fadeUp}
      initial={m.initial}
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      className={cn('min-w-0 overflow-hidden rounded-2xl border bg-card shadow-xs', className)}
    >
      <header className="flex items-center gap-3 px-4 py-3.5" style={{ background: toneWash(tone) }}>
        {Icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={toneChipStyle(tone)}>
            <Icon className="size-[18px]" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold leading-tight">{title}</h2>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {link ? (
          <Link href={link.href} className="-mr-2 inline-flex min-h-11 items-center gap-0.5 rounded-lg px-2 text-xs font-semibold text-primary hover:underline">
            {link.label}
            <ChevronRight className="size-3.5" />
          </Link>
        ) : (
          (action as React.ReactNode)
        )}
      </header>
      <div className={cn('min-w-0', flush ? '' : 'p-4 pt-3')}>{children}</div>
    </motion.section>
  );
}
