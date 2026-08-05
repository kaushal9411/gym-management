'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarCheck } from 'lucide-react';
import { useMemberAttendance } from '@/features/member-portal/hooks/use-member-portal';

export default function MemberAttendancePage() {
  const { data, isLoading } = useMemberAttendance();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My attendance</h1>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="No visits yet" description="Your check-in history will show up here." />
      ) : (
        <div className="space-y-2">
          {data.items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{item.branch.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.checkInTime).toLocaleString()}
                    {item.checkOutTime ? ` – ${new Date(item.checkOutTime).toLocaleTimeString()}` : ''}
                  </p>
                </div>
                <Badge variant={item.checkOutTime ? 'secondary' : 'success'}>{item.checkOutTime ? 'Completed' : 'Checked in'}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
