import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { toneChipStyle, type PortalTone } from './tones';

/** Friendly empty state: icon chip, title, description, optional action node. `compact` for inside cards. */
export function EmptyBlock({
  icon: Icon,
  title,
  description,
  action,
  tone = 'muted',
  compact,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: PortalTone;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'gap-1.5 py-5' : 'gap-2 py-10', className)}>
      {Icon ? (
        <span className="grid size-11 place-items-center rounded-2xl" style={toneChipStyle(tone)}>
          <Icon className="size-5" aria-hidden />
        </span>
      ) : null}
      <p className="text-sm font-semibold">{title}</p>
      {description ? <p className="max-w-xs text-xs text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
