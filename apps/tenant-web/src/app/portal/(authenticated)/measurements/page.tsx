'use client';

import { Ruler } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemberMeasurements } from '@/features/member-portal/hooks/use-member-portal';
import { summarizeMeasurement } from '@/features/measurements/utils';

/** Read-only — a member never edits their own measurements, only a trainer/owner/manager logs them (staff-side Member Detail page). */
export default function MemberMeasurementsPage() {
  const { data: entries, isLoading } = useMemberMeasurements();

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (!entries || entries.length === 0) {
    return <EmptyState icon={Ruler} title="No measurements yet" description="Ask your trainer to log your first check-in." />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Body measurements</h1>
        <p className="text-sm text-muted-foreground">Your progress over time, logged by your trainer.</p>
      </div>

      <div className="space-y-3">
        {entries.map((entry) => (
          <Card key={entry.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base font-medium">
                <span>{new Date(entry.recordedAt).toLocaleDateString()}</span>
                {entry.recordedBy ? <span className="text-xs font-normal text-muted-foreground">by {entry.recordedBy.name}</span> : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-sm">{summarizeMeasurement(entry)}</p>
              {entry.notes ? <p className="text-xs text-muted-foreground">{entry.notes}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
