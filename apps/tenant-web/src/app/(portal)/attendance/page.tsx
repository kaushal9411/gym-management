'use client';

import * as React from 'react';
import Link from 'next/link';
import { QrCode, UserCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AttendanceMethodBadge, AttendanceStatusBadge } from '@/features/attendance/components/attendance-badges';
import { AttendanceSummaryCards } from '@/features/attendance/components/attendance-summary-cards';
import { AttendanceTrendChart } from '@/features/attendance/components/attendance-trend-chart';
import { useAttendanceSummary, useTodayAttendance } from '@/features/attendance/hooks/use-attendance';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { BranchSelect } from '@/features/members/components/branch-select';

export default function AttendanceDashboardPage() {
  const { hasPermission } = usePermissions();
  const [branchId, setBranchId] = React.useState('');

  const summary = useAttendanceSummary({ branchId: branchId || undefined });
  const today = useTodayAttendance(branchId || undefined);

  const canCheckIn = hasPermission('attendance:checkin');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground">Who&apos;s checked in, and how the gym trends over time.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/attendance/history">History</Link>
          </Button>
          {canCheckIn ? (
            <Button size="sm" asChild>
              <Link href="/attendance/check-in">
                <QrCode className="size-4" /> Check in / out
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="max-w-xs">
        <BranchSelect value={branchId} onChange={setBranchId} />
      </div>

      <AttendanceSummaryCards summary={summary.data} loading={summary.isPending} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AttendanceTrendChart trend={summary.data?.trend} loading={summary.isPending} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="size-4" /> Today&apos;s activity
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 space-y-3 overflow-y-auto">
            {today.isPending ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (today.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No attendance recorded yet today.</p>
            ) : (
              (today.data ?? []).map((record) => (
                <div key={record.id} className="flex items-center justify-between gap-2 border-b pb-2 text-sm last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium">{record.member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {record.checkOutTime ? ` – ${new Date(record.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <AttendanceStatusBadge status={record.status} />
                    <AttendanceMethodBadge method={record.method} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {!summary.isPending && (summary.data?.totalCheckInsToday ?? 0) === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">Tip</Badge> Use &ldquo;Check in / out&rdquo; above to record your first visit of the day.
        </p>
      ) : null}
    </div>
  );
}
