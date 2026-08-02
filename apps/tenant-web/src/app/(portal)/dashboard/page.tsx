'use client';

import dynamic from 'next/dynamic';
import { Sparkles } from 'lucide-react';

import { CardSkeleton } from '@/components/ui/card-skeleton';
import { AnnouncementsWidget } from '@/features/dashboard/components/announcements-widget';
import { DateRangeSelector } from '@/features/dashboard/components/date-range-selector';
import { QuickStatistics } from '@/features/dashboard/components/quick-statistics';
import { RecentActivity } from '@/features/dashboard/components/recent-activity';
import { StatsGrid } from '@/features/dashboard/components/stats-grid';
import { UpcomingBirthdays } from '@/features/dashboard/components/upcoming-birthdays';
import { useCurrentUser } from '@/features/auth/hooks/use-current-user';
import { useTenant } from '@/features/tenant/tenant-provider';

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
  const tenant = useTenant();
  const bannerUrl = tenant.branding.dashboardBannerUrl;

  return (
    <div className="space-y-6">
      <div
        className={`relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl border p-5 sm:p-6 ${bannerUrl ? 'bg-cover bg-center text-white' : ''}`}
        style={
          bannerUrl
            ? { backgroundImage: `url(${bannerUrl})` }
            : {
                backgroundImage:
                  'linear-gradient(120deg, color-mix(in oklch, var(--primary) 12%, transparent) 0%, color-mix(in oklch, var(--chart-2) 9%, transparent) 60%, color-mix(in oklch, var(--chart-3) 8%, transparent) 100%)',
              }
        }
      >
        {bannerUrl ? (
          // A photo can be any brightness/color — this scrim keeps the
          // heading/date-range controls legible regardless of what was uploaded.
          <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-black/45" />
        ) : null}
        <div className="relative flex items-center gap-3.5">
          <div
            className="hidden size-11 shrink-0 items-center justify-center rounded-xl sm:flex"
            style={
              bannerUrl
                ? { backgroundColor: 'rgba(255,255,255,0.18)', color: '#fff', boxShadow: '0 0 0 1px rgba(255,255,255,0.25)' }
                : {
                    backgroundColor: 'color-mix(in oklch, var(--primary) 16%, transparent)',
                    color: 'var(--primary)',
                    boxShadow: '0 0 0 1px color-mix(in oklch, var(--primary) 18%, transparent)',
                  }
            }
          >
            <Sparkles className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Welcome, {user?.name?.split(' ')[0]}</h1>
            <p className={`mt-1 ${bannerUrl ? 'text-white/85' : 'text-muted-foreground'}`}>Here&apos;s what&apos;s happening at your gym today.</p>
          </div>
        </div>
        <div className="relative">
          <DateRangeSelector />
        </div>
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
