'use client';

import { AnnouncementsWidget } from '@/features/dashboard/components/announcements-widget';
import { ChartsGrid } from '@/features/dashboard/components/charts-grid';
import { DateRangeSelector } from '@/features/dashboard/components/date-range-selector';
import { QuickStatistics } from '@/features/dashboard/components/quick-statistics';
import { RecentActivity } from '@/features/dashboard/components/recent-activity';
import { StatsGrid } from '@/features/dashboard/components/stats-grid';
import { UpcomingBirthdays } from '@/features/dashboard/components/upcoming-birthdays';
import { useCurrentUser } from '@/features/auth/hooks/use-current-user';

/**
 * Dashboard foundation: real widgets (Quick Statistics, Recent Activities,
 * Announcements) backed by data that already exists, and honest
 * placeholders for widgets that need modules later prompts will build
 * (Members, Attendance, Payments).
 */
export default function DashboardPage() {
  const user = useCurrentUser();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user?.name}</h1>
          <p className="text-muted-foreground">Here&apos;s what&apos;s happening at your gym today.</p>
        </div>
        <DateRangeSelector />
      </div>

      <StatsGrid />
      <ChartsGrid />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <RecentActivity />
        <AnnouncementsWidget />
        <UpcomingBirthdays />
      </div>

      <QuickStatistics />
    </div>
  );
}
