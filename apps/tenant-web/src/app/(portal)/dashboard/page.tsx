'use client';

import dynamic from 'next/dynamic';

import { Skeleton } from '@/components/ui/skeleton';
import { AnnouncementsWidget } from '@/features/dashboard/components/announcements-widget';
import { DashboardHero } from '@/features/dashboard/components/dashboard-hero';
import { BranchPanel, HealthPanel, PlanPanel, StaffPanel } from '@/features/dashboard/components/insight-panels';
import { KpiStrip } from '@/features/dashboard/components/kpi-strip';
import { ActivityPanel, ExpiringPanel, OutstandingPanel } from '@/features/dashboard/components/list-panels';
import { MembersPanel } from '@/features/dashboard/components/members-panel';
import { UpcomingBirthdays } from '@/features/dashboard/components/upcoming-birthdays';
import { OnboardingChecklistCard } from '@/features/onboarding-checklist/components/onboarding-checklist-card';

// Recharts is a large dependency — the four chart panels load as their own chunk instead of inflating the dashboard route's main bundle.
const chartLoading = () => <Skeleton className="h-[360px] w-full rounded-2xl" />;
const MoneyChartPanel = dynamic(() => import('@/features/dashboard/components/chart-panels').then((m) => m.MoneyChartPanel), { ssr: false, loading: chartLoading });
const AttendanceChartPanel = dynamic(() => import('@/features/dashboard/components/chart-panels').then((m) => m.AttendanceChartPanel), { ssr: false, loading: chartLoading });
const NewMembersChartPanel = dynamic(() => import('@/features/dashboard/components/chart-panels').then((m) => m.NewMembersChartPanel), { ssr: false, loading: chartLoading });

/** Tints the header of the legacy Card-based widgets (announcements, birthdays) to match the new panels. Full class names, so Tailwind can see them. */
const TINT_AMBER =
  '[&>div]:h-full [&>div]:overflow-hidden [&>div>div:first-child]:border-b [&>div>div:first-child]:bg-gradient-to-r [&>div>div:first-child]:from-amber-500/15 [&>div>div:first-child]:to-transparent [&>div>div:nth-child(2)]:pt-5';
const TINT_ROSE =
  '[&>div]:h-full [&>div]:overflow-hidden [&>div>div:first-child]:border-b [&>div>div:first-child]:bg-gradient-to-r [&>div>div:first-child]:from-rose-500/15 [&>div>div:first-child]:to-transparent [&>div>div:nth-child(2)]:pt-5';

/** Each grid cell hides itself when its panel renders nothing (no permission), so the grid never shows an empty slot. */
const CELL = 'min-w-0 empty:hidden';

export default function DashboardPage() {
  return (
    <div className="w-full space-y-5">
      <DashboardHero />
      <OnboardingChecklistCard />
      <KpiStrip />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className={`${CELL} lg:col-span-8`}>
          <MoneyChartPanel />
        </div>
        <div className={`${CELL} lg:col-span-4`}>
          <MembersPanel />
        </div>

        <div className={`${CELL} lg:col-span-6`}>
          <AttendanceChartPanel />
        </div>
        <div className={`${CELL} lg:col-span-6`}>
          <NewMembersChartPanel />
        </div>

        <div className={`${CELL} lg:col-span-4`}>
          <ExpiringPanel />
        </div>
        <div className={`${CELL} lg:col-span-4`}>
          <OutstandingPanel />
        </div>
        <div className={`${CELL} lg:col-span-4`}>
          <ActivityPanel />
        </div>

        <div className={`${CELL} lg:col-span-5`}>
          <BranchPanel />
        </div>
        <div className={`${CELL} lg:col-span-3`}>
          <StaffPanel />
        </div>
        <div className={`${CELL} lg:col-span-4`}>
          <HealthPanel />
        </div>

        <div className={`${CELL} ${TINT_AMBER} lg:col-span-4`}>
          <AnnouncementsWidget />
        </div>
        <div className={`${CELL} ${TINT_ROSE} lg:col-span-4`}>
          <UpcomingBirthdays />
        </div>
        <div className={`${CELL} lg:col-span-4`}>
          <PlanPanel />
        </div>
      </div>
    </div>
  );
}
