import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { accentColor, accentTint, type ReportAccent } from '../../lib/reports-theme';

/** Small rounded label/value pill (e.g. "Peak · Mon"); `accent` tints it. */
export function StatPill({ label, value, icon: Icon, accent = 'analytics', className }: { label?: string; value: React.ReactNode; icon?: LucideIcon; accent?: ReportAccent; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', className)} style={{ backgroundColor: accentTint(accent, 13), color: accentColor(accent) }}>
      {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
      {label ? <span className="opacity-80">{label}</span> : null}
      <span className="font-extrabold tabular-nums">{value}</span>
    </span>
  );
}
