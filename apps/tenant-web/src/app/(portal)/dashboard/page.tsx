'use client';

import dynamic from 'next/dynamic';

import { CardSkeleton } from '@/components/ui/card-skeleton';
import { AnnouncementsWidget } from '@/features/dashboard/components/announcements-widget';
import { DateRangeSelector } from '@/features/dashboard/components/date-range-selector';
import { QuickStatistics } from '@/features/dashboard/components/quick-statistics';
import { RecentActivity } from '@/features/dashboard/components/recent-activity';
import { StatsGrid } from '@/features/dashboard/components/stats-grid';
import { UpcomingBirthdays } from '@/features/dashboard/components/upcoming-birthdays';
import { useCurrentUser } from '@/features/auth/hooks/use-current-user';

// Global Loading & Performance Optimization (Prompt 23) — Recharts is a
// large dependency; splitting it into its own chunk (loaded in parallel
// with, not inside, the dashboard route's main bundle) rather than
// statically importing it keeps the dashboard's initial JS smaller.
const ChartsGrid = dynamic(() => import('@/features/dashboard/components/charts-grid').then((m) => m.ChartsGrid), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  ),
});

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
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Welcome, {user?.name?.split(' ')[0]}</h1>
          <p className="mt-1 text-muted-foreground">Here&apos;s what&apos;s happening at your gym today.</p>
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
