import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

/** Loading placeholder shaped like a `SectionCard` (`lines` rows) - or like a `StatTile` with `tile`. */
export function SkeletonCard({ lines = 3, tile, className }: { lines?: number; tile?: boolean; className?: string }) {
  if (tile) {
    return (
      <div className={cn('rounded-2xl border bg-card p-3.5', className)}>
        <Skeleton className="size-9 rounded-xl" />
        <Skeleton className="mt-3 h-3 w-16" />
        <Skeleton className="mt-2 h-6 w-20" />
      </div>
    );
  }
  return (
    <div className={cn('rounded-2xl border bg-card p-4', className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-xl" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** Hero-shaped skeleton. */
export function SkeletonHero() {
  return <Skeleton className="h-56 w-full rounded-3xl md:h-60" />;
}
