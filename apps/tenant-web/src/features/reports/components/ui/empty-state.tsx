'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

import { cn } from '@/lib/utils';
import { accentChipStyle, type ReportAccent } from '../../lib/reports-theme';

/** Centered empty/error message with icon chip, optional description and action. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  accent = 'analytics',
  compact,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  accent?: ReportAccent;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed text-center', compact ? 'gap-1.5 px-4 py-6' : 'gap-2 px-6 py-12', className)}>
      <span className="flex size-10 items-center justify-center rounded-xl" style={accentChipStyle(accent)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-bold">{title}</p>
      {description ? <p className="max-w-sm text-[13px] text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
