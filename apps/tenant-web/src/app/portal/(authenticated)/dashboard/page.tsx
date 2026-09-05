'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarCheck, CalendarRange, Dumbbell, Receipt, Wallet } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartWrapper } from '@/components/ui/chart-wrapper';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { StatisticCard } from '@/components/ui/statistic-card';
import { MEMBER_PORTAL_ROUTES } from '@/features/member-portal/constants';
import {
  useMemberAttendance,
  useMemberBookings,
  useMemberClasses,
  useMemberInvoices,
  useMemberProfile,
  useMemberWorkout,
} from '@/features/member-portal/hooks/use-member-portal';
import type { MemberPortalAttendanceItem, MemberPortalInvoice } from '@/features/member-portal/services/member-portal.service';
import { memberPortalService } from '@/features/member-portal/services/member-portal.service';

const AXIS_TICK = { fill: 'var(--muted-foreground)', fontSize: 12 };
const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-md)',
    fontSize: 12,
  },
  labelStyle: { color: 'var(--foreground)', fontWeight: 500, marginBottom: 2 },
  cursor: { fill: 'var(--accent)', opacity: 0.4 },
};

const INVOICE_STATUS_VARIANT: Record<string, 'success' | 'secondary' | 'destructive'> = {
  PAID: 'success',
  UNPAID: 'secondary',
  OVERDUE: 'destructive',
};

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Same last-30-days-fill-with-zero shape as the staff dashboard's ChartsGrid (`label`/`date`/`value`) — one visit-count bucket per day, built client-side since the member-portal API returns a flat paginated list, not a pre-aggregated series. */
function buildAttendanceSeries(items: MemberPortalAttendanceItem[]): { date: string; label: string; value: number }[] {
  const days: { date: string; label: string; value: number }[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const key = toDateKey(new Date(now.getTime() - i * 86_400_000));
    days.push({ date: key, label: key.slice(5), value: 0 });
  }
  const indexByDate = new Map(days.map((d, idx) => [d.date, idx]));
  for (const item of items) {
    const idx = indexByDate.get(item.attendanceDate.slice(0, 10));
    if (idx !== undefined) days[idx]!.value += 1;
  }
  return days;
}

function daysUntil(dateIso: string): number {
  return Math.ceil((new Date(dateIso).getTime() - Date.now()) / 86_400_000);
}

export default function MemberDashboardPage() {
  const { data: profile, isLoading: loadingProfile } = useMemberProfile();
  const { data: attendance, isLoading: loadingAttendance } = useMemberAttendance(1, 90);
  const { data: workout } = useMemberWorkout();
  const { data: invoices } = useMemberInvoices(1, 20);
  const weekFrom = React.useMemo(() => new Date(), []);
  const weekTo = React.useMemo(() => new Date(weekFrom.getTime() + 7 * 86_400_000), [weekFrom]);
  const { data: upcomingSessions } = useMemberClasses(toDateKey(weekFrom), toDateKey(weekTo));
  const { data: bookings } = useMemberBookings();
  const [exporting, setExporting] = React.useState(false);

  if (loadingProfile || !profile) return <Skeleton className="h-64 w-full rounded-xl" />;

  const handleExport = async () => {
    setExporting(true);
    try {
      await memberPortalService.downloadGdprExport(profile.memberId);
    } catch {
      toast.error('Could not download your data — please try again.');
    } finally {
      setExporting(false);
    }
  };

  const attendanceChartData = buildAttendanceSeries(attendance?.items ?? []);
  const totalVisits = attendance?.total ?? 0;

  const completedExercises = workout?.progress.filter((p) => p.status === 'COMPLETED').length ?? 0;
  const totalExercises = workout?.workoutPlan.exercises.length ?? 0;
  const workoutPercent = totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : null;

  const outstandingInvoices = (invoices?.items ?? []).filter((i) => i.status !== 'PAID');
  const outstandingTotal = outstandingInvoices.reduce((sum, i) => sum + Number(i.totalAmount), 0);

  const bookedSessionIds = new Set((bookings ?? []).filter((b) => b.status === 'BOOKED').map((b) => b.session.id));
  const myUpcomingSessions = (upcomingSessions ?? [])
    .filter((s) => bookedSessionIds.has(s.id))
    .sort((a, b) => `${a.sessionDate}${a.startTime}`.localeCompare(`${b.sessionDate}${b.startTime}`))
    .slice(0, 3);

  const recentInvoices = (invoices?.items ?? []).slice(0, 4);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-6">
          <Avatar className="size-16">
            <AvatarImage src={profile.profilePhotoUrl ?? undefined} alt={profile.name} />
            <AvatarFallback>{profile.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold">{profile.name}</p>
            <p className="text-sm text-muted-foreground">
              {profile.memberId} · {profile.branch.name}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant={profile.status === 'ACTIVE' ? 'success' : 'secondary'}>{profile.status}</Badge>
              {profile.currentMembership ? (
                <Badge variant="outline">{profile.currentMembership.planName}</Badge>
              ) : null}
              {profile.trainer ? <Badge variant="outline">Trainer: {profile.trainer.name}</Badge> : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatisticCard
          label="Membership"
          value={profile.currentMembership ? `${Math.max(daysUntil(profile.currentMembership.endDate), 0)}d left` : 'None'}
          icon={CalendarRange}
          tone="violet"
        />
        <StatisticCard label="Total visits" value={totalVisits} icon={CalendarCheck} tone="aqua" />
        <StatisticCard
          label="Workout progress"
          value={workoutPercent !== null ? `${workoutPercent}%` : '—'}
          icon={Dumbbell}
          tone="orange"
        />
        <StatisticCard
          label="Outstanding"
          value={outstandingTotal > 0 ? `₹${outstandingTotal.toLocaleString('en-IN')}` : 'All paid'}
          icon={Wallet}
          tone={outstandingTotal > 0 ? 'warning' : 'success'}
        />
      </div>

      <ChartWrapper
        title="Attendance"
        description="Your check-ins over the last 30 days"
        loading={loadingAttendance}
        empty={!loadingAttendance && attendanceChartData.every((d) => d.value === 0)}
        emptyMessage="No visits recorded in this period yet."
        height={220}
      >
        <AreaChart data={attendanceChartData}>
          <defs>
            <linearGradient id="fill-member-attendance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={28} />
          <Tooltip {...TOOLTIP_STYLE} labelFormatter={(label, payload) => payload[0]?.payload.date ?? label} />
          <Area dataKey="value" name="Check-ins" stroke="var(--chart-1)" strokeWidth={2} fill="url(#fill-member-attendance)" />
        </AreaChart>
      </ChartWrapper>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My check-in QR code</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            {profile.qrCodeImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- QR code is a data-URL/object-storage URL, not an optimizable static asset (same convention as the staff-side QR display).
              <img src={profile.qrCodeImageUrl} alt="Check-in QR code" className="size-40" />
            ) : (
              <p className="text-sm text-muted-foreground">No QR code on file.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Upcoming classes</CardTitle>
            <Link href={MEMBER_PORTAL_ROUTES.classes} className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {myUpcomingSessions.length === 0 ? (
              <EmptyState icon={CalendarRange} title="Nothing booked" description="Book a class for the week ahead." className="border-0 py-8" />
            ) : (
              <div className="space-y-2">
                {myUpcomingSessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{s.groupClass.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.sessionDate} · {s.startTime}–{s.endTime}
                      </p>
                    </div>
                    <Badge variant="secondary">Booked</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Recent payment history</CardTitle>
          <Link href={MEMBER_PORTAL_ROUTES.invoices} className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {recentInvoices.length === 0 ? (
            <EmptyState icon={Receipt} title="No invoices yet" description="Your invoices will show up here once you're billed." className="border-0 py-8" />
          ) : (
            <div className="space-y-2">
              {recentInvoices.map((inv: MemberPortalInvoice) => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(inv.invoiceDate).toLocaleDateString()} · ₹{Number(inv.totalAmount).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <Badge variant={INVOICE_STATUS_VARIANT[inv.status] ?? 'secondary'}>{inv.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My data</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">Download everything on file for you — profile, attendance, plans, invoices, and bookings — as a JSON file.</p>
          <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={exporting} onClick={handleExport}>
            {exporting ? 'Preparing…' : 'Download my data'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
