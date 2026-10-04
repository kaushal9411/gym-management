import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Shimmer placeholder; `height` in px (or use className). */
export function SkeletonBlock({ height = 120, className }: { height?: number; className?: string }) {
  return <Skeleton className={cn('w-full rounded-xl', className)} style={{ height }} />;
}
