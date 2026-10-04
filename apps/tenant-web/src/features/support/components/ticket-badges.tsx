import { cn } from '@/lib/utils';
import { PRIORITY_META, STATUS_META, tint } from '../lib/ticket-meta';
import type { TicketPriority, TicketStatus } from '../types';

/** Coloured pill (inline-flex span, safe inside <p>); tint + text come from the status colour token. */
export function TicketStatusBadge({ status, className }: { status: TicketStatus; className?: string }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold', className)}
      style={{ backgroundColor: tint(meta.color, 15), color: `color-mix(in oklch, ${meta.color} 75%, var(--foreground))` }}
    >
      <Icon className="size-3" aria-hidden />
      {meta.label}
    </span>
  );
}

export function TicketPriorityBadge({ priority, className }: { priority: TicketPriority; className?: string }) {
  const meta = PRIORITY_META[priority];
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold', className)}
      style={{ borderColor: tint(meta.color, 35), color: `color-mix(in oklch, ${meta.color} 75%, var(--foreground))` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
      {meta.label}
    </span>
  );
}
