import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { AttendanceSummary } from '../types';

function formatHour(hour: number | null): string {
  if (hour === null) return '—';
  const period = hour < 12 ? 'AM' : 'PM';
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}:00 ${period}`;
}

interface AttendanceSummaryCardsProps {
  summary: AttendanceSummary | undefined;
  loading?: boolean;
}

export function AttendanceSummaryCards({ summary, loading }: AttendanceSummaryCardsProps) {
  const cards = [
    { label: 'Check-ins today', value: summary?.totalCheckInsToday },
    { label: 'Check-outs today', value: summary?.totalCheckOutsToday },
    { label: 'Currently inside', value: summary?.currentlyInside },
    { label: 'Peak check-in time', value: summary ? formatHour(summary.peakCheckInHour) : undefined, isText: true },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-semibold tracking-tight">{card.isText ? card.value : (card.value ?? 0)}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
