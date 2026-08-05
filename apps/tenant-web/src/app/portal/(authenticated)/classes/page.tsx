'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ClassCalendar, startOfWeekUtc, weekDays } from '@/features/classes/components/class-calendar';
import type { ClassSession } from '@/features/classes/types';
import { useBookClass, useCancelMemberBooking, useMemberBookings, useMemberClasses } from '@/features/member-portal/hooks/use-member-portal';

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default function MemberClassesPage() {
  const [weekStart, setWeekStart] = React.useState(() => startOfWeekUtc(new Date()));
  const [selectedSession, setSelectedSession] = React.useState<ClassSession | null>(null);

  const days = weekDays(weekStart);
  const dateFrom = toDateKey(days[0]!);
  const dateTo = toDateKey(days[6]!);

  const sessions = useMemberClasses(dateFrom, dateTo);
  const bookings = useMemberBookings();
  const bookClass = useBookClass();
  const cancelBooking = useCancelMemberBooking();

  const myBookingBySession = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const booking of bookings.data ?? []) {
      if (booking.status === 'BOOKED') map.set(booking.session.id, booking.id);
    }
    return map;
  }, [bookings.data]);

  const selectedBookingId = selectedSession ? myBookingBySession.get(selectedSession.id) : undefined;

  const handleBook = () => {
    if (!selectedSession) return;
    bookClass.mutate(selectedSession.id, {
      onSuccess: () => toast.success('Booked in!'),
      onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Could not book this session.'),
    });
  };

  const handleCancel = () => {
    if (!selectedBookingId) return;
    cancelBooking.mutate(selectedBookingId, {
      onSuccess: () => {
        toast.success('Booking cancelled.');
        setSelectedSession(null);
      },
      onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Could not cancel this booking.'),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Classes</h1>
        <p className="text-sm text-muted-foreground">Book yourself into an upcoming session at your branch.</p>
      </div>

      {sessions.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <ClassCalendar
          weekStart={weekStart}
          onWeekChange={setWeekStart}
          sessions={sessions.data ?? []}
          onSessionClick={setSelectedSession}
          isHighlighted={(session) => myBookingBySession.has(session.id)}
        />
      )}

      <Dialog open={selectedSession !== null} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="max-w-sm">
          {selectedSession ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedSession.groupClass.name}</DialogTitle>
                <DialogDescription>
                  {selectedSession.sessionDate} · {selectedSession.startTime}–{selectedSession.endTime} · {selectedSession.branch.name}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center gap-2">
                <Badge variant={selectedSession.bookedCount >= selectedSession.capacity ? 'outline' : 'secondary'}>
                  {selectedSession.bookedCount}/{selectedSession.capacity} booked
                </Badge>
                {selectedSession.trainer ? <Badge variant="outline">{selectedSession.trainer.name}</Badge> : null}
              </div>

              {selectedBookingId ? (
                <Button variant="destructive" disabled={cancelBooking.isPending} onClick={handleCancel}>
                  {cancelBooking.isPending ? 'Cancelling…' : 'Cancel my booking'}
                </Button>
              ) : selectedSession.status !== 'SCHEDULED' ? (
                <p className="text-sm text-muted-foreground">This session is {selectedSession.status.toLowerCase()}.</p>
              ) : selectedSession.bookedCount >= selectedSession.capacity ? (
                <p className="text-sm text-muted-foreground">This session is fully booked.</p>
              ) : (
                <Button disabled={bookClass.isPending} onClick={handleBook}>
                  {bookClass.isPending ? 'Booking…' : 'Book this class'}
                </Button>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
