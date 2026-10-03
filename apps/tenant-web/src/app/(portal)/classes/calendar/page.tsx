'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { MemberCheckinSearch } from '@/features/attendance/components/member-checkin-search';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { ClassCalendar, startOfWeekUtc, weekDays } from '@/features/classes/components/class-calendar';
import { toClassError, useBookMember, useCancelBooking, useClassSession, useGenerateSessions, useSessionList } from '@/features/classes/hooks/use-classes';
import { accentVar, tint } from '@/features/members/components/detail/detail-ui';
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
    <div className="w-full space-y-5">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/classes">
          <ArrowLeft className="size-4" /> Back to classes
        </Link>
      </Button>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative grid gap-4 overflow-hidden rounded-3xl p-6 text-white shadow-lg lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-7"
        style={{ backgroundImage: 'radial-gradient(900px 320px at 88% -30%, color-mix(in oklch, #c026d3 75%, transparent), transparent 60%), linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 14px)' }} />
        <div className="relative min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">Schedule</p>
          <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight sm:text-4xl">Class Calendar</h1>
          <p className="mt-1 text-white/85">Weekly view of every session — click one to manage its bookings.</p>
        </div>
        {canGenerate ? (
          <div className="relative flex flex-wrap items-center gap-2 [&_button]:border-white/30 [&_button]:bg-white/15 [&_button]:text-white [&_button:hover]:bg-white/25">
            <Button variant="secondary" size="sm" disabled={generateSessions.isPending} onClick={handleGenerate}>
              <RefreshCw className="size-3.5" /> {generateSessions.isPending ? 'Generating…' : 'Regenerate sessions now'}
            </Button>
          </div>
        ) : null}
      </motion.section>

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
        <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
          {sessionDetail.isPending || !detail ? (
            <div className="space-y-3 p-5">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <>
              <div className="relative overflow-hidden p-5 text-white" style={{ backgroundImage: 'linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}>
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 14px)' }} />
                <DialogHeader className="relative text-left">
                  <DialogTitle className="text-white">{detail.groupClass.name}</DialogTitle>
                  <DialogDescription className="text-white/80">
                    {detail.sessionDate} · {detail.startTime}–{detail.endTime} · {detail.branch.name}
                  </DialogDescription>
                </DialogHeader>
                <div className="relative mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
                    {detail.bookedCount}/{detail.capacity} booked
                  </span>
                  {detail.trainer ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">{detail.trainer.name}</span>
                  ) : null}
                  {detail.status !== 'SCHEDULED' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">{detail.status}</span>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div className="max-h-64 space-y-1.5 overflow-y-auto">
                  {detail.bookings.filter((b) => b.status === 'BOOKED').length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">No one is booked in yet.</p>
                  ) : (
                    detail.bookings
                      .filter((b) => b.status === 'BOOKED')
                      .map((booking, i) => (
                        <motion.div
                          key={booking.id}
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: Math.min(i * 0.04, 0.3) }}
                          className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm"
                          style={{ backgroundColor: tint('primary', 6), borderColor: tint('primary', 16) }}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span
                              className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
                              style={{ backgroundImage: `linear-gradient(135deg, ${accentVar('primary')}, var(--chart-7))` }}
                            >
                              {booking.member.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                            </span>
                            <span className="min-w-0 truncate">
                              {booking.member.name} <span className="text-xs text-muted-foreground">({booking.member.memberId})</span>
                            </span>
                          </span>
                          <div className="flex shrink-0 items-center gap-2">
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
                        </motion.div>
                      ))
                  )}
                </div>

                {canManageBookings && detail.status === 'SCHEDULED' && detail.bookedCount < detail.capacity ? (
                  <div className="space-y-2 border-t pt-3">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      <UserPlus className="size-3.5" style={{ color: accentVar('primary') }} /> Book a member in
                    </p>
                    <MemberCheckinSearch onSelect={setAddMember} placeholder="Search member by name, email, or member ID…" />
                    {addMember ? (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm">
                          Booking <span className="font-medium">{addMember.name}</span>
                        </span>
                        <Button
                          size="sm"
                          disabled={bookMember.isPending}
                          onClick={handleAddBooking}
                          className="border-0 text-white shadow-md disabled:opacity-50"
                          style={{ backgroundImage: 'linear-gradient(120deg, var(--success), var(--chart-3))' }}
                        >
                          {bookMember.isPending ? 'Booking…' : 'Confirm booking'}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
