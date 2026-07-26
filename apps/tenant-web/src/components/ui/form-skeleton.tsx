import { Skeleton } from '@/components/ui/skeleton';

interface FormSkeletonProps {
  /** Number of label+input rows. Default 4. */
  fields?: number;
}

/** Label+input skeleton rows — for a detail/edit page's form while its record is still loading (the same shape every "one big form" detail page in this app already renders once loaded). */
export function FormSkeleton({ fields = 4 }: FormSkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}
