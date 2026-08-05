'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { MemberCheckinSearch } from '@/features/attendance/components/member-checkin-search';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { ClassCalendar, startOfWeekUtc, weekDays } from '@/features/classes/components/class-calendar';
import { toClassError, useBookMember, useCancelBooking, useClassSession, useGenerateSessions, useSessionList } from '@/features/classes/hooks/use-classes';
import type { MemberListItem } from '@/features/members/types';

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default function ClassesCalendarPage() {
  const { hasPermission } = usePermissions();
  const canManageBookings = hasPermission('bookings:manage');
  const canGenerate = hasPermission('classes:update');

  const [weekStart, setWeekStart] = React.useState(() => startOfWeekUtc(new Date()));
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);
  const [addMember, setAddMember] = React.useState<MemberListItem | null>(null);

  const days = weekDays(weekStart);
  const dateFrom = toDateKey(days[0]!);
  const dateTo = toDateKey(days[6]!);

  const sessions = useSessionList({ dateFrom, dateTo });
  const sessionDetail = useClassSession(selectedSessionId);
  const generateSessions = useGenerateSessions();
  const bookMember = useBookMember();
  const cancelBooking = useCancelBooking();

  const handleGenerate = () => {
    generateSessions.mutate(undefined, {
      onSuccess: (result) => toast.success(`${result.created} session(s) generated.`),
      onError: (err) => toast.error(toClassError(err).message),
    });
  };

  const handleAddBooking = () => {
    if (!selectedSessionId || !addMember) return;
    bookMember.mutate(
      { sessionId: selectedSessionId, memberId: addMember.id },
      {
        onSuccess: () => {
          toast.success(`${addMember.name} booked in.`);
          setAddMember(null);
        },
        onError: (err) => toast.error(toClassError(err).message),
      },
    );
  };

  const handleCancelBooking = (bookingId: string, memberName: string) => {
    cancelBooking.mutate(bookingId, {
      onSuccess: () => toast.success(`${memberName}'s booking cancelled.`),
      onError: (err) => toast.error(toClassError(err).message),
    });
  };

  const detail = sessionDetail.data;

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/classes">
          <ArrowLeft className="size-4" /> Back to classes
        </Link>
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Class Calendar</h1>
          <p className="text-muted-foreground">Weekly view of every session — click one to manage its bookings.</p>
        </div>
        {canGenerate ? (
          <Button variant="outline" size="sm" disabled={generateSessions.isPending} onClick={handleGenerate}>
            <RefreshCw className="size-3.5" /> {generateSessions.isPending ? 'Generating…' : 'Regenerate sessions now'}
          </Button>
        ) : null}
      </div>

      <ClassCalendar
        weekStart={weekStart}
        onWeekChange={setWeekStart}
        sessions={sessions.data ?? []}
        loading={sessions.isPending}
        onSessionClick={(session) => setSelectedSessionId(session.id)}
      />

      <Dialog
        open={selectedSessionId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSessionId(null);
            setAddMember(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          {sessionDetail.isPending || !detail ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{detail.groupClass.name}</DialogTitle>
                <DialogDescription>
                  {detail.sessionDate} · {detail.startTime}–{detail.endTime} · {detail.branch.name}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center gap-2">
                <Badge variant={detail.bookedCount >= detail.capacity ? 'outline' : 'secondary'}>
                  {detail.bookedCount}/{detail.capacity} booked
                </Badge>
                {detail.trainer ? <Badge variant="outline">{detail.trainer.name}</Badge> : null}
                {detail.status !== 'SCHEDULED' ? <Badge variant="outline">{detail.status}</Badge> : null}
              </div>

              <div className="max-h-64 space-y-1.5 overflow-y-auto">
                {detail.bookings.filter((b) => b.status === 'BOOKED').length === 0 ? (
                  <p className="text-sm text-muted-foreground">No one is booked in yet.</p>
                ) : (
                  detail.bookings
                    .filter((b) => b.status === 'BOOKED')
                    .map((booking) => (
                      <div key={booking.id} className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                        <span>
                          {booking.member.name} <span className="text-xs text-muted-foreground">({booking.member.memberId})</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{booking.bookedByRole}</Badge>
                          {canManageBookings ? (
                            <button
                              type="button"
                              aria-label={`Cancel ${booking.member.name}'s booking`}
                              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => handleCancelBooking(booking.id, booking.member.name)}
                            >
                              <X className="size-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))
                )}
              </div>

              {canManageBookings && detail.status === 'SCHEDULED' && detail.bookedCount < detail.capacity ? (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-sm font-medium">Book a member in</p>
                  <MemberCheckinSearch onSelect={setAddMember} placeholder="Search member by name, email, or member ID…" />
                  {addMember ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm">
                        Booking <span className="font-medium">{addMember.name}</span>
                      </span>
                      <Button size="sm" disabled={bookMember.isPending} onClick={handleAddBooking}>
                        {bookMember.isPending ? 'Booking…' : 'Confirm booking'}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
