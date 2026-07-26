import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface CardSkeletonProps {
  /** Number of body lines to render below the title. Default 3. */
  lines?: number;
}

/** A Card-shaped skeleton — for a stat card, a detail panel, or any card-based section still loading. */
export function CardSkeleton({ lines = 3 }: CardSkeletonProps) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-1/3" />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full last:w-2/3" />
        ))}
      </CardContent>
    </Card>
  );
}
