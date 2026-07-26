import { Skeleton } from '@/components/ui/skeleton';

interface TableSkeletonProps {
  rows?: number;
}

/** Extracted from `DataTable`'s inline loading state so any other table-shaped view (not just `DataTable`) can reuse the same skeleton. */
export function TableSkeleton({ rows = 4 }: TableSkeletonProps) {
  return (
    <div className="space-y-2.5 rounded-xl border p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}
