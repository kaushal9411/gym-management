import { cn } from '@/lib/utils';

/** Unread-count pill (hidden at 0, "9+" cap). */
export function NavBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span className={cn('inline-flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-[18px] text-destructive-foreground', className)}>
      {count > 9 ? '9+' : count}
    </span>
  );
}
