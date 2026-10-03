'use client';

import * as React from 'react';
import Link from 'next/link';
import { QrCode } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { AttendanceHero } from '@/features/attendance/components/attendance-hero';
import { AttendanceInsights, AttendanceKpis } from '@/features/attendance/components/attendance-overview';
import { useAttendanceSummary, useTodayAttendance } from '@/features/attendance/hooks/use-attendance';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useCurrentBranch } from '@/features/branch/hooks/use-branches';
import { BranchSelect } from '@/features/members/components/branch-select';

function toDateStr(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `dateTo` = today, `dateFrom` = 29 days back — a single `getSummary` call carries both today's live
 * figures (always today, regardless of range) and a 30-day trend, which the Insights panels slice
 * client-side into this-week/last-week and weekday comparisons. No new endpoints. */
function useTrendWindow() {
  return React.useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 29);
    return { dateFrom: toDateStr(from), dateTo: toDateStr(to) };
  }, []);
}

export default function AttendanceDashboardPage() {
  const { hasPermission } = usePermissions();
  const { currentBranchId } = useCurrentBranch();
  const [branchId, setBranchId] = React.useState('');
  const { dateFrom, dateTo } = useTrendWindow();

  // Defaults from, and stays in sync with, the header's branch switcher —
  // still locally overridable (e.g. back to "all branches") for this page view.
  React.useEffect(() => {
    setBranchId(currentBranchId ?? '');
  }, [currentBranchId]);

  const summary = useAttendanceSummary({ branchId: branchId || undefined, dateFrom, dateTo });
  const today = useTodayAttendance(branchId || undefined);

  const canCheckIn = hasPermission('attendance:checkin');

  return (
    <div className="w-full space-y-5">
      <AttendanceHero
        currentlyInside={summary.data?.currentlyInside ?? 0}
        loading={summary.isPending}
        actions={
          <>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/attendance/history">History</Link>
            </Button>
            {canCheckIn ? (
              <Button size="sm" asChild data-solid className="border-0 bg-white text-indigo-700 shadow-lg hover:bg-white/90">
                <Link href="/attendance/check-in">
                  <QrCode className="size-4" /> Check in / out
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="max-w-xs">
        <BranchSelect value={branchId} onChange={setBranchId} />
      </div>

      <AttendanceKpis summary={summary.data} loading={summary.isPending} />

      <AttendanceInsights summary={summary.data} today={today.data} loading={summary.isPending || today.isPending} />
    </div>
  );
}
