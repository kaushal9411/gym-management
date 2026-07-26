import { cn } from '@/lib/utils';

/** Shimmer sweep instead of a flat pulse — see `@keyframes shimmer` in globals.css. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-muted',
        'before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-linear-to-r before:from-transparent before:via-foreground/8 before:to-transparent',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
